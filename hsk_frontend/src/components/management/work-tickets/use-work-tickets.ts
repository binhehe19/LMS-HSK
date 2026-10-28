"use client";

import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getTickets } from "@/lib/api/ticket-client";
import type { TicketResponse } from "@/types/ticket";

/** Admin lấy 100 ticket đầu (getTickets(0, 100) của màn cũ); giảng viên 50 (fetchMyTickets). Giới hạn này là hành vi cũ, xem docs/api-requirements/work-tickets.md. */
export const MANAGER_TICKET_PAGE_SIZE = 100;
export const INSTRUCTOR_TICKET_PAGE_SIZE = 50;

/**
 * Tải danh sách ticket. `waiting` = dịch vụ ticket chưa cấu hình (WAITING FOR BACKEND); `error` = đã gọi nhưng thất bại.
 * Bản cũ toast lỗi rồi hiện bảng rỗng (che lỗi); ở đây toast như cũ nhưng trạng thái lỗi được hiển thị rõ, không có "bảng rỗng giả".
 */
export function useWorkTickets(size: number) {
  return useKeyedFetch<TicketResponse[]>(`work-tickets:${size}`, async () => {
    try {
      return await getTickets(0, size);
    } catch (error) {
      if (!(error instanceof ApiNotConfiguredError)) toast.error((error instanceof ApiError && error.message) || "Không thể tải danh sách ticket");
      throw error;
    }
  });
}
