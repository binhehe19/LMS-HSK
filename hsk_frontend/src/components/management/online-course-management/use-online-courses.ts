"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useKeyedFetch, type FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { useWriteGate } from "@/hooks/use-write-gate";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { deleteOnlineCourse, getOnlineCourse, getOnlineCourseFullDetail, getOnlineSyllabus, getOnlineSyncJob, listOnlineCourses, startOnlineSync, updateOnlineCourse } from "@/lib/api/online-course-client";
import { writeErrorMessage } from "@/lib/api/write-error-message";
import { mergeCourseDetail, pickSyllabusDescription, toUpsertPayload, validateCourseForm, type CourseFormValues } from "@/lib/online-course/online-course-model";
import type { OnlineCourseDetail, OnlineCourseSummary, OnlineSystemSyncJob } from "@/types/online-course";

/** Chu kỳ và số lần hỏi trạng thái đồng bộ, như pollSyncJobUntilDone của bản cũ (3 giây × 120 lần = 6 phút). */
export const SYNC_POLL_MS = 3000;
export const SYNC_MAX_POLLS = 120;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Lỗi của một bước được giữ lại để báo khi mọi bước đều thất bại; dịch vụ chưa cấu hình thì ném ngay (WAITING FOR BACKEND). */
async function attempt<T>(work: () => Promise<T>): Promise<{ data: T | null; error: unknown }> {
  try {
    return { data: await work(), error: null };
  } catch (error) {
    if (error instanceof ApiNotConfiguredError) throw error;
    return { data: null, error };
  }
}

/**
 * Chi tiết khoá học theo chuỗi dự phòng của openDetail cũ: GET /courses/{id} + GET /courses/{id}/full-detail (gộp, full-detail ưu tiên), rồi
 * GET /syllabuses/{id} nếu vẫn chưa có mô tả giáo trình. Bản cũ nuốt lỗi từng bước và chỉ toast chung; ở đây hai bước đầu cùng lỗi => lỗi hiển thị.
 */
export async function loadCourseDetail(courseId: string): Promise<OnlineCourseDetail> {
  const [detail, full] = await Promise.all([attempt(() => getOnlineCourse(courseId)), attempt(() => getOnlineCourseFullDetail(courseId))]);
  const merged = mergeCourseDetail(detail.data, full.data);
  if (!merged) {
    const error = detail.error ?? full.error;
    throw error instanceof ApiError ? error : new ApiError("Không thể tải chi tiết khóa học", 200);
  }
  if (!merged.syllabus_description && merged.syllabusId) {
    const syllabus = await attempt(() => getOnlineSyllabus(merged.syllabusId as string));
    const description = pickSyllabusDescription(syllabus.data);
    if (description) return { ...merged, syllabus_description: description };
  }
  return merged;
}

/**
 * Logic màn Quản lý khoá học trực tuyến: danh sách, chi tiết (modal), sửa/xoá, đồng bộ CMS có theo dõi tiến trình.
 * Khác bản cũ có chủ đích: lỗi tải danh sách là trạng thái màn (bản cũ: toast + lưới rỗng); sau ghi thành công TẢI LẠI từ máy chủ; thao tác ghi qua
 * write gate "online-course" (bị chặn => toast "chưa tích hợp", không "thành công giả"); chống bấm đúp bằng khoá đồng bộ + `busy`.
 */
export function useOnlineCourses() {
  const { enabled: writeEnabled, demo } = useWriteGate("online-course");
  const list = useKeyedFetch<OnlineCourseSummary[]>("online-courses", async () => {
    const data = await listOnlineCourses();
    if (!Array.isArray(data)) throw new ApiError("Dữ liệu trả về không đúng định dạng danh sách khóa học.", 200, "CONTRACT");
    return data;
  });

  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = async <T,>(fallback: string, work: () => Promise<T>): Promise<T | null> => {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    try {
      return await work();
    } catch (error) {
      toast.error(writeErrorMessage(error, fallback));
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  // ---- chi tiết ----
  const [detailCourse, setDetailCourse] = useState<OnlineCourseSummary | null>(null);
  const detailId = detailCourse?.id ?? null;
  const detail = useKeyedFetch<OnlineCourseDetail>(detailId === null ? null : `course-detail:${detailId}`, () => loadCourseDetail(detailId as string));

  // ---- sửa / xoá ----
  const update = async (course: OnlineCourseSummary, values: CourseFormValues): Promise<boolean> => {
    const invalid = validateCourseForm(values);
    if (invalid) {
      toast.error(invalid);
      return false;
    }
    const result = await run("Lưu thất bại", () => updateOnlineCourse(course.id, toUpsertPayload(values), demo));
    if (result === null) return false;
    toast.success("Cập nhật thành công");
    list.reload();
    return true;
  };

  const remove = async (course: OnlineCourseSummary): Promise<boolean> => {
    const result = await run("Xóa thất bại", async () => {
      await deleteOnlineCourse(course.id, demo);
      return true;
    });
    if (result === null) return false;
    toast.success("Xóa thành công");
    list.reload();
    return true;
  };

  // ---- đồng bộ CMS ----
  const [syncJob, setSyncJob] = useState<OnlineSystemSyncJob | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);

  const pollSync = async (jobId: string) => {
    try {
      for (let attemptNo = 0; attemptNo < SYNC_MAX_POLLS; attemptNo += 1) {
        await delay(SYNC_POLL_MS);
        if (!alive.current) return;
        const job = await getOnlineSyncJob(jobId).catch(() => null);
        if (!alive.current) return;
        if (!job) continue; // như bản cũ: một lần hỏi lỗi thì hỏi lại
        setSyncJob(job);
        const status = String(job.status || "").toUpperCase();
        if (status === "SUCCESS") {
          toast.success("Đồng bộ dữ liệu đã hoàn tất");
          list.reload();
          return;
        }
        if (status === "FAILED") {
          toast.error(job.message || "Đồng bộ dữ liệu thất bại");
          return;
        }
      }
      toast.info("Đồng bộ vẫn đang chạy nền, vui lòng kiểm tra lại sau vài phút");
    } finally {
      if (alive.current) setSyncing(false);
    }
  };

  /** Đang đồng bộ thì chỉ mở lại modal theo dõi (bản cũ). */
  const startSync = async () => {
    if (syncing) {
      setSyncModalOpen(true);
      return;
    }
    setSyncJob(null);
    setSyncModalOpen(true);
    setSyncing(true);
    const job = await run("Không thể bắt đầu đồng bộ dữ liệu", () => startOnlineSync(demo));
    if (!job?.jobId) {
      setSyncing(false);
      setSyncModalOpen(false);
      return;
    }
    setSyncJob(job);
    void pollSync(job.jobId);
  };

  const state: FetchState<OnlineCourseSummary[]> = list.state;
  const courses = state.kind === "ok" ? state.data : (list.lastData ?? []);

  return {
    state,
    /** Dữ liệu đang hiển thị: kết quả mới nhất, hoặc kết quả trước đó trong lúc tải lại. */
    courses,
    refreshing: state.kind === "loading" && list.lastData !== null,
    reload: list.reload,
    writeEnabled,
    busy,
    update,
    remove,
    detailCourse,
    detailState: detail.state,
    openDetail: (course: OnlineCourseSummary) => setDetailCourse(course),
    closeDetail: () => setDetailCourse(null),
    retryDetail: detail.reload,
    syncJob,
    syncing,
    syncModalOpen,
    startSync,
    closeSyncModal: () => setSyncModalOpen(false),
  };
}

export type OnlineCourses = ReturnType<typeof useOnlineCourses>;
