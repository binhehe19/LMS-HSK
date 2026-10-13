"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { InstructorLessonDetailView, type LessonDetailActions } from "@/components/management/instructor-lesson-detail/instructor-lesson-detail-view";
import { useLessonDetail } from "@/components/management/instructor-lesson-detail/use-lesson-detail";
import { confirmAction } from "@/components/shared/confirm-action";
import { useWriteGate } from "@/hooks/use-write-gate";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { saveLessonDetail } from "@/lib/api/quiz-grading-client";
import { WriteDisabledError } from "@/lib/api/write-gate";
import { checkGradingParams, readText } from "@/lib/grading/grading-params";
import * as model from "@/lib/grading/lesson-detail-model";
import type { LessonDetailResponse } from "@/types/grading";

const errorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof WriteDisabledError || error instanceof ApiNotConfiguredError) return "Lưu chi tiết bài học chưa được tích hợp với backend (WAITING FOR BACKEND).";
  return (error instanceof ApiError && error.message) || fallback;
};

/**
 * Màn "Chi tiết bài học" của một buổi (HSK cũ: LessonDetailPage). Query giữ nguyên hợp đồng cũ: classId, courseId, scheduleId, title.
 * Bản nháp chỉnh sửa và mục đang mở gắn với đúng đối tượng dữ liệu đã tải: tải lại => bản mới => bản nháp cũ tự hết hiệu lực (không cần effect reset).
 * Thao tác GHI (Lưu thay đổi) đi qua công tắc "lesson-detail": đóng => bố cục "Chỉ xem" (như HSK cũ không mock).
 */
export function InstructorLessonDetailPageContent() {
  const params = useSearchParams();
  const { enabled, demo } = useWriteGate("lesson-detail");

  const check = checkGradingParams({ classId: params.get("classId"), scheduleId: params.get("scheduleId") });
  const courseId = readText(params.get("courseId"));
  const title = readText(params.get("title"));
  const classId = check.kind === "ok" ? check.classId : readText(params.get("classId"));
  const scheduleId = check.kind === "ok" ? check.scheduleId : readText(params.get("scheduleId"));

  const { state, reload } = useLessonDetail(check.kind === "ok" ? { classId: check.classId, scheduleId: check.scheduleId, title } : null);
  const base = state.kind === "ok" ? state.data : null;

  const [draft, setDraft] = useState<{ base: LessonDetailResponse | null; detail: LessonDetailResponse }>();
  const detail = draft && draft.base === base ? draft.detail : base;
  const update = (fn: (d: LessonDetailResponse) => LessonDetailResponse) =>
    setDraft((prev) => {
      const current = prev && prev.base === base ? prev.detail : base;
      return current ? { base, detail: fn(current) } : prev;
    });

  // Bản cũ mở chủ đề đầu tiên ngay sau khi tải (setOpenId trong effect); ở đây suy ra từ dữ liệu cho tới khi người dùng bấm.
  const [openState, setOpenState] = useState<{ base: LessonDetailResponse | null; id: string | null }>();
  const openId = openState && openState.base === base ? openState.id : (base?.modules[0]?.id ?? null);
  const toggleOpen = (id: string) => setOpenState({ base, id: openId === id ? null : id });

  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!enabled || !detail || saving) return;
    setSaving(true);
    try {
      const saved = await saveLessonDetail(scheduleId, classId, detail, demo);
      // Backend là nguồn sự thật sau khi lưu; phản hồi không đúng hình dạng thì giữ bản đang hiển thị.
      setDraft({ base, detail: saved && typeof saved === "object" && Array.isArray(saved.modules) ? saved : detail });
      toast.success("Đã lưu chi tiết bài học");
    } catch (error) {
      toast.error(errorMessage(error, "Lưu thất bại"));
    } finally {
      setSaving(false);
    }
  };

  // Xoá qua xác nhận (khác bản cũ: xoá ngay). Chỉ xoá trong bản nháp; có hiệu lực khi "Lưu thay đổi".
  const removeModule = async (mi: number) => {
    const m = detail?.modules[mi];
    if (!m) return;
    const ok = await confirmAction({ title: "Xóa chủ đề", content: `Xóa chủ đề "${m.label || "Chủ đề"}" cùng toàn bộ bài tập bên trong? Thay đổi chỉ có hiệu lực sau khi bấm "Lưu thay đổi".`, okText: "Xóa", danger: true });
    if (ok) update((d) => model.removeModule(d, mi));
  };
  const removeExercise = async (mi: number, ei: number) => {
    const ex = detail?.modules[mi]?.exercises?.[ei];
    if (!ex) return;
    const ok = await confirmAction({ title: "Xóa bài tập", content: `Xóa bài tập "${ex.name || `Bài quiz ${ei + 1}`}" cùng các câu hỏi bên trong? Thay đổi chỉ có hiệu lực sau khi bấm "Lưu thay đổi".`, okText: "Xóa", danger: true });
    if (ok) update((d) => model.removeExercise(d, mi, ei));
  };

  const actions: LessonDetailActions = {
    updateModule: (mi, field, value) => update((d) => model.updateModule(d, mi, field, value)),
    toggleLock: (mi) => update((d) => model.toggleLock(d, mi)),
    removeModule,
    addModule: () => update((d) => model.addModule(d, `lm-${Date.now()}`)),
    updateExercise: (mi, ei, field, value) => update((d) => model.updateExercise(d, mi, ei, field, value)),
    addExercise: (mi) => update((d) => model.addExercise(d, mi)),
    removeExercise,
    setExerciseAudio: (mi, ei, audioName) => update((d) => model.setExerciseAudio(d, mi, ei, audioName)),
    updateQuestion: (mi, ei, qi, field, value) => update((d) => model.updateQuestion(d, mi, ei, qi, field, value)),
    addQuestion: (mi, ei) => update((d) => model.addQuestion(d, mi, ei)),
    removeQuestion: (mi, ei, qi) => update((d) => model.removeQuestion(d, mi, ei, qi)),
    updateOptionLabel: (mi, ei, qi, oi, label) => update((d) => model.updateOptionLabel(d, mi, ei, qi, oi, label)),
    setCorrectOption: (mi, ei, qi, oi) => update((d) => model.setCorrectOption(d, mi, ei, qi, oi)),
    addOption: (mi, ei, qi) => update((d) => model.addOption(d, mi, ei, qi)),
    removeOption: (mi, ei, qi, oi) => update((d) => model.removeOption(d, mi, ei, qi, oi)),
  };

  return (
    <InstructorLessonDetailView
      state={state}
      paramNotice={check.kind === "notice" ? check.notice : null}
      classId={classId}
      courseId={courseId}
      title={title}
      detail={check.kind === "ok" ? detail : null}
      editable={enabled}
      saving={saving}
      openId={openId}
      onToggleOpen={toggleOpen}
      onSave={save}
      onRetry={reload}
      actions={actions}
    />
  );
}
