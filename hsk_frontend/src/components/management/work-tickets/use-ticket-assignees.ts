"use client";

import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { ApiError } from "@/lib/api/api-client";
import { getTicketAssignees } from "@/lib/api/ticket-client";
import type { TicketAssigneeOptionResponse } from "@/types/ticket";

/**
 * Người có thể được giao việc cho modal tạo/sửa. Chỉ tải khi `wanted` (lần đầu mở modal) rồi giữ kết quả — bản cũ tải ngay khi vào trang và
 * nuốt lỗi thành danh sách rỗng; ở đây lỗi/chưa cấu hình hiện rõ trong cột chọn người (kèm Thử lại).
 */
export function useTicketAssignees(wanted: boolean) {
  return useKeyedFetch<TicketAssigneeOptionResponse[]>(wanted ? "ticket-assignees" : null, async () => {
    const data = await getTicketAssignees();
    if (!Array.isArray(data)) throw new ApiError("Dữ liệu người được giao không đúng định dạng danh sách.", 200);
    return data;
  });
}
