"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useKeyedFetch, type FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { useWriteGate } from "@/hooks/use-write-gate";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import {
  activateTeacher,
  blockTeacher,
  createTeacher,
  fetchTeacherJobStatus,
  fetchTeachers,
  importTeachers,
  resendTeacherAccountEmail,
  updateTeacher,
} from "@/lib/api/teacher-management-client";
import { WriteDisabledError } from "@/lib/api/write-gate";
import { buildCreatePayload, buildUpdatePayload, emailFailureMessage, isValidEmail, validateTeacherForm, type TeacherFormValues } from "@/lib/teacher-management/teacher-form";
import type { TeacherCreateResult, TeacherImportResult, TeacherJobStatus, TeacherUser } from "@/types/teacher-management";

/** Chu kỳ hỏi trạng thái tiến trình nền, như `setInterval(loadImportStatus, 5000)` của bản cũ. */
const JOB_STATUS_POLL_MS = 5000;

export const WRITE_NOT_INTEGRATED_MESSAGE = "Thao tác chưa được tích hợp với backend (WAITING FOR BACKEND).";

/** Thông điệp lỗi cho một thao tác ghi: công tắc đóng / chưa cấu hình => "chưa tích hợp"; lỗi API => thông điệp của nó; khác => câu của bản cũ. */
export function writeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof WriteDisabledError || error instanceof ApiNotConfiguredError) return WRITE_NOT_INTEGRATED_MESSAGE;
  if (error instanceof ApiError) return error.message;
  return fallback;
}

/**
 * Logic màn "Quản lý giảng viên" (chế độ Admin của teacher-management-page.tsx cũ): danh sách, trạng thái tiến trình nền, và các thao tác ghi.
 *
 * Khác bản cũ có chủ đích:
 * - Sau mỗi thao tác ghi thành công, TẢI LẠI danh sách từ máy chủ thay vì vá mảng trong bộ nhớ (máy chủ là nguồn sự thật; bảng giữ dữ liệu
 *   cũ và hiện `loading` của antd Table trong lúc tải lại nên không nhấp nháy).
 * - Lỗi tải danh sách là trạng thái `error`/`waiting` của màn (bản cũ: toast rồi bảng rỗng). Phản hồi không phải mảng cũng là lỗi.
 * - Thao tác ghi đi qua write gate: nút khoá khi công tắc đóng; nếu vẫn gọi được, client ném WriteDisabledError => toast "chưa tích hợp",
 *   không có "thành công giả". Chống bấm đúp bằng khoá đồng bộ (ref) + cờ `busy`.
 */
export function useTeacherManagement() {
  const { enabled: writeEnabled, demo } = useWriteGate("teacher-management");
  const list = useKeyedFetch<TeacherUser[]>("teachers", async () => {
    const data = await fetchTeachers();
    // Bản cũ bóc mảng từ mọi hình dạng rồi im lặng coi là rỗng; ở đây sai hợp đồng = lỗi hiển thị được.
    if (!Array.isArray(data)) throw new ApiError("Dữ liệu trả về không đúng định dạng danh sách giảng viên.", 200, "CONTRACT");
    return data;
  });

  const [jobStatus, setJobStatus] = useState<TeacherJobStatus | null>(null);
  const [jobTick, setJobTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const lock = useRef(false);

  // Hỏi trạng thái tiến trình nền ngay và mỗi 5 giây; dịch vụ chưa cấu hình => dừng (không có gì để hỏi); lỗi khác => giữ giá trị cũ, không toast.
  useEffect(() => {
    let cancelled = false;
    let stopped = false;
    const tick = async () => {
      try {
        const status = await fetchTeacherJobStatus();
        if (!cancelled) setJobStatus(status);
      } catch (error) {
        if (error instanceof ApiNotConfiguredError) stopped = true;
      }
    };
    void tick();
    const timer = window.setInterval(() => {
      if (stopped) window.clearInterval(timer);
      else void tick();
    }, JOB_STATUS_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [jobTick]);

  const refreshJobStatus = useCallback(() => setJobTick((n) => n + 1), []);

  /** Chạy một thao tác ghi với khoá chống trùng và toast lỗi thống nhất; trả null khi bị bỏ qua hoặc lỗi. */
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

  const create = async (values: TeacherFormValues): Promise<TeacherCreateResult | null> => {
    const invalid = validateTeacherForm(values, "create");
    if (invalid) {
      toast.error(invalid);
      return null;
    }
    const result = await run("Không thể tạo giảng viên", () => createTeacher(buildCreatePayload(values), demo));
    if (!result) return null;
    if (result.emailStatus === "SUCCESS") toast.success("Tạo giảng viên thành công. Mật khẩu đã được gửi qua email.");
    else toast.warning(`Tạo giảng viên thành công nhưng gửi email thất bại${result.emailStatusReason ? `: ${result.emailStatusReason}` : ""}`);
    list.reload();
    return result;
  };

  const update = async (teacher: TeacherUser, values: TeacherFormValues): Promise<boolean> => {
    const invalid = validateTeacherForm(values, "edit");
    if (invalid) {
      toast.error(invalid);
      return false;
    }
    const result = await run("Không thể cập nhật giảng viên", () => updateTeacher(teacher.id, buildUpdatePayload(values), demo));
    if (!result) return false;
    toast.success("Cập nhật giảng viên thành công");
    list.reload();
    return true;
  };

  const block = async (teacher: TeacherUser): Promise<boolean> => {
    const result = await run("Không thể khóa tài khoản giảng viên", () => blockTeacher(teacher.id, demo));
    if (!result) return false;
    toast.success("Đã khóa quyền truy cập tài khoản giảng viên");
    list.reload();
    return true;
  };

  const unblock = async (teacher: TeacherUser): Promise<boolean> => {
    const result = await run("Không thể mở khóa tài khoản giảng viên", () => activateTeacher(teacher.id, demo));
    if (!result) return false;
    toast.success("Đã mở khóa tài khoản giảng viên");
    list.reload();
    return true;
  };

  const resendEmail = async (teacherId: string): Promise<TeacherCreateResult | null> => {
    const result = await run("Không thể gửi lại email tài khoản giảng viên", () => resendTeacherAccountEmail(teacherId, demo));
    if (!result) return null;
    if (result.emailStatus === "SUCCESS") toast.success("Đã gửi lại email tài khoản giảng viên.");
    else toast.error(emailFailureMessage(result.emailStatusReason));
    list.reload();
    return result;
  };

  /** "Đổi email & gửi lại" của modal Tài khoản mới: cập nhật email rồi gửi lại, hai bước như bản cũ. */
  const changeEmailAndResend = async (teacherId: string, email: string): Promise<TeacherCreateResult | null> => {
    const newEmail = email.trim();
    if (!isValidEmail(newEmail)) {
      toast.error("Email không hợp lệ");
      return null;
    }
    const result = await run("Không thể cập nhật email", async () => {
      await updateTeacher(teacherId, { email: newEmail }, demo);
      return resendTeacherAccountEmail(teacherId, demo);
    });
    if (!result) return null;
    if (result.emailStatus === "SUCCESS") toast.success("Đã cập nhật email và gửi lại thông tin tài khoản.");
    else toast.error(emailFailureMessage(result.emailStatusReason));
    list.reload();
    return result;
  };

  const importFile = async (file: File): Promise<TeacherImportResult | null> => {
    if (jobStatus?.inProgress) {
      toast.warning("Đang có tiến trình import giáo viên, vui lòng chờ hoàn tất rồi thử lại");
      return null;
    }
    setImporting(true);
    try {
      const result = await run("Không thể nhập danh sách từ Excel", () => importTeachers(file, demo));
      if (!result) return null;
      const skipped = result.skippedCount ?? 0;
      if (result.createdCount > 0) toast.success(`Đã nhập thành công ${result.createdCount} giảng viên từ Excel`);
      if (skipped > 0) {
        const firstReason = result.skippedReasons?.[0];
        toast.warning(`Bỏ qua ${skipped} dòng không import được${firstReason ? `: ${firstReason}` : ""}`);
      }
      if (result.createdCount === 0 && skipped === 0) toast.error("Không có dòng dữ liệu hợp lệ để import");
      if (result.createdCount > 0) list.reload();
      return result;
    } finally {
      setImporting(false);
      refreshJobStatus();
    }
  };

  const state: FetchState<TeacherUser[]> = list.state;
  const teachers = state.kind === "ok" ? state.data : (list.lastData ?? []);

  return {
    state,
    /** Dữ liệu đang hiển thị: kết quả mới nhất, hoặc kết quả trước đó trong lúc tải lại. */
    teachers,
    refreshing: state.kind === "loading" && list.lastData !== null,
    reload: list.reload,
    jobStatus,
    importInProgress: jobStatus?.inProgress === true,
    refreshJobStatus,
    busy,
    importing,
    writeEnabled,
    demo,
    create,
    update,
    block,
    unblock,
    resendEmail,
    changeEmailAndResend,
    importFile,
  };
}
