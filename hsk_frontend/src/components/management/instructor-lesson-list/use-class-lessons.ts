"use client";

import { toast } from "sonner";
// Dùng chung bộ tải theo khoá của M3B.4 (khoá = classId: đổi lớp => bỏ phản hồi của lớp cũ, không lẫn dữ liệu giữa các lớp).
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { listClassSchedules } from "@/lib/api/quiz-grading-client";
import type { GradingScheduleResponse } from "@/types/grading";

/**
 * Tải buổi học của một lớp. `classId = null` (thiếu/không hợp lệ) => KHÔNG gọi API.
 * `waiting` = dịch vụ quiz chưa cấu hình (WAITING FOR BACKEND); `error` = đã gọi nhưng thất bại (kể cả 403 khi lớp không thuộc giảng viên).
 * Bản cũ biến mọi lỗi thành toast + bảng "Chưa có bài học" (che lỗi); ở đây toast như cũ nhưng trạng thái lỗi được hiển thị rõ.
 */
export function useClassLessons(classId: string | null) {
  return useKeyedFetch<GradingScheduleResponse[]>(classId === null ? null : `lessons:${classId}`, async () => {
    try {
      const data = await listClassSchedules(classId as string);
      if (!Array.isArray(data)) throw new ApiError("Dữ liệu trả về không đúng định dạng danh sách bài học.", 200);
      return data;
    } catch (error) {
      if (!(error instanceof ApiNotConfiguredError)) toast.error((error instanceof ApiError && error.message) || "Không tải được danh sách bài học"); // như bản cũ
      throw error;
    }
  });
}
