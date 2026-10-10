"use client";

import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getGradingAttempt, listStudentAttempts } from "@/lib/api/quiz-grading-client";
import { modulesFromSummaries } from "@/lib/grading/grading-workspace-model";
import type { GradingAttemptDetailResponse, GradingStudentModuleResponse } from "@/types/grading";

export interface StudentGradingData {
  /** Mỗi bài làm đã nộp của học viên trong buổi (thứ tự theo API; màn hình sắp lại theo module). */
  modules: GradingStudentModuleResponse[];
  /** Chi tiết (câu hỏi, đáp án, điểm) theo attemptId. */
  details: Record<string, GradingAttemptDetailResponse>;
}

/**
 * Tải toàn bộ bài làm của một học viên trong buổi rồi chi tiết từng bài (loadAll của GradingWorkspacePage cũ: 1 + N lời gọi, N = số bài đã nộp).
 * `params = null` (khoá URL thiếu/không hợp lệ) => KHÔNG gọi API. Khác bản cũ có chủ đích: một chi tiết lỗi => cả màn ở trạng thái lỗi (có "Thử lại")
 * thay vì âm thầm bỏ bài đó khỏi danh sách; tóm tắt không phải mảng => lỗi hợp đồng.
 */
export function useStudentGrading(params: { classId: string; scheduleId: string; userId: string } | null) {
  return useKeyedFetch<StudentGradingData>(params === null ? null : `grading:${params.classId}:${params.scheduleId}:${params.userId}`, async () => {
    const { classId, scheduleId, userId } = params as { classId: string; scheduleId: string; userId: string };
    try {
      const summaries = await listStudentAttempts(scheduleId, userId, classId);
      if (!Array.isArray(summaries)) throw new ApiError("Dữ liệu trả về không đúng định dạng danh sách bài làm.", 200);
      const detailList = await Promise.all(summaries.map((s) => getGradingAttempt(s.attemptId)));
      const details: Record<string, GradingAttemptDetailResponse> = {};
      summaries.forEach((s, i) => {
        const detail = detailList[i];
        if (!detail || typeof detail !== "object") throw new ApiError("Dữ liệu chi tiết bài làm không đúng định dạng.", 200);
        details[s.attemptId] = { ...detail, attemptId: detail.attemptId || s.attemptId };
      });
      return { modules: modulesFromSummaries(summaries, details), details };
    } catch (error) {
      if (!(error instanceof ApiNotConfiguredError)) toast.error((error instanceof ApiError && error.message) || "Không tải được danh sách bài làm"); // như bản cũ
      throw error;
    }
  });
}
