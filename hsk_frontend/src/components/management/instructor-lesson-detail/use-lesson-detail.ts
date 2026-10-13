"use client";

import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getLessonDetail } from "@/lib/api/quiz-grading-client";
import type { LessonDetailResponse } from "@/types/grading";

/**
 * Tải nội dung bài tập của một buổi (một endpoint gộp thay cho 3 lời gọi onl-learning + quiz của HSK cũ, xem docs/api-requirements/instructor-grading.md).
 * `params = null` (classId/scheduleId thiếu hoặc không hợp lệ) => KHÔNG gọi API. `title` tham gia khoá vì backend dùng nó làm `lessonTitle` khi chưa có bản lưu.
 */
export function useLessonDetail(params: { classId: string; scheduleId: string; title: string } | null) {
  return useKeyedFetch<LessonDetailResponse>(params === null ? null : `lesson-detail:${params.classId}:${params.scheduleId}:${params.title}`, async () => {
    const { classId, scheduleId, title } = params as { classId: string; scheduleId: string; title: string };
    try {
      const data = await getLessonDetail(scheduleId, classId, title);
      if (!data || typeof data !== "object" || !Array.isArray(data.modules)) throw new ApiError("Dữ liệu trả về không đúng định dạng chi tiết bài học.", 200);
      return data;
    } catch (error) {
      if (!(error instanceof ApiNotConfiguredError)) toast.error((error instanceof ApiError && error.message) || "Không tải được chi tiết bài học"); // như bản cũ
      throw error;
    }
  });
}
