"use client";

import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { listSyllabuses } from "@/lib/api/lms-syllabus-client";
import type { SyllabusSummaryResponse } from "@/types/lms";

/**
 * Danh sách giáo trình từ backend chung (repo-lms, chỉ đọc). `enabled = false` (đang xem chi tiết) => không gọi; quay về danh sách thì dùng lại kết quả cũ.
 * Bản cũ biến lỗi thành toast + dropdown "Chưa có syllabus" (che lỗi); ở đây toast như cũ nhưng trạng thái lỗi hiển thị rõ, có "Thử lại".
 */
export function useSyllabusList(enabled: boolean) {
  return useKeyedFetch<SyllabusSummaryResponse[]>(enabled ? "syllabuses" : null, async () => {
    try {
      return await listSyllabuses(); // đã kiểm tra là mảng trong client
    } catch (error) {
      if (!(error instanceof ApiNotConfiguredError)) toast.error((error instanceof ApiError && error.message) || "Không thể tải danh sách syllabus");
      throw error;
    }
  });
}
