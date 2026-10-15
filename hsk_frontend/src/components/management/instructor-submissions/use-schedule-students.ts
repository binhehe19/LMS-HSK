"use client";

import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { isLmsApiConfigured } from "@/lib/api/lms-client";
import { listLmsScheduleStudents } from "@/lib/api/lms-grading-source";
import { listScheduleStudents } from "@/lib/api/quiz-grading-client";
import type { GradingStudentResponse } from "@/types/grading";

/**
 * Tải học viên của một buổi kèm bài tập đã giao/đã nộp. `params = null` (classId/scheduleId thiếu hoặc không hợp lệ) => KHÔNG gọi API.
 * Khác HSK cũ có chủ đích: bản cũ gọi thêm N+1 `getGradingAttempt` cho từng bài đã nộp để tính lại `score`/`totalScore` phía client (classGradingApi.getStudents
 * → enrichModuleScores); hợp đồng mới yêu cầu backend trả sẵn `modules[].score` và `totalScore` đúng (mock đã làm vậy) nên chỉ MỘT lời gọi.
 * `waiting` = dịch vụ quiz chưa cấu hình; `error` = đã gọi nhưng thất bại (403 khi buổi/lớp không thuộc giảng viên, 404 buổi không tồn tại...).
 */
export function useScheduleStudents(params: { classId: string; scheduleId: string } | null) {
  return useKeyedFetch<GradingStudentResponse[]>(params === null ? null : `students:${params.classId}:${params.scheduleId}`, async () => {
    try {
      const { scheduleId, classId } = params as { classId: string; scheduleId: string };
      const data = await (isLmsApiConfigured() ? listLmsScheduleStudents(classId, scheduleId) : listScheduleStudents(scheduleId, classId));
      if (!Array.isArray(data)) throw new ApiError("Dữ liệu trả về không đúng định dạng danh sách học viên.", 200);
      return data;
    } catch (error) {
      if (!(error instanceof ApiNotConfiguredError)) toast.error((error instanceof ApiError && error.message) || "Không tải được danh sách học viên"); // như bản cũ
      throw error;
    }
  });
}
