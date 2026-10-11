"use client";

import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { listScheduleStudents } from "@/lib/api/quiz-grading-client";
import type { GradingStudentResponse } from "@/types/grading";

/**
 * Học viên của buổi học cho màn danh sách Phân tích học tập. `params = null` (URL thiếu/không hợp lệ) => KHÔNG gọi API. Khoá = lớp + buổi: đổi buổi => bỏ
 * phản hồi cũ. Bản cũ biến mọi lỗi thành toast + "Chưa có học viên" (che lỗi); ở đây toast như cũ nhưng trạng thái lỗi được hiển thị rõ, chưa cấu hình => waiting.
 */
export function useScheduleStudents(params: { scheduleId: string; classId: string } | null) {
  const scheduleId = params?.scheduleId ?? "";
  const classId = params?.classId ?? "";
  return useKeyedFetch<GradingStudentResponse[]>(params === null ? null : `la-students:${classId}:${scheduleId}`, async () => {
    try {
      const data = await listScheduleStudents(scheduleId, classId);
      if (!Array.isArray(data)) throw new ApiError("Dữ liệu trả về không đúng định dạng danh sách học viên.", 200);
      return data;
    } catch (error) {
      if (!(error instanceof ApiNotConfiguredError)) toast.error((error instanceof ApiError && error.message) || "Không tải được danh sách học viên");
      throw error;
    }
  });
}
