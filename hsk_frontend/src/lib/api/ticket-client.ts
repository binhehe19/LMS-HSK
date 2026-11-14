// Client ĐỌC danh sách ticket: dùng để xét quyền sửa nội dung của giảng viên (hooks/use-content-access.ts) và toast chào mừng ở sidebar.
// Hai màn phân công công việc và mọi thao tác ghi ticket đã gỡ. NEXT_PUBLIC_TICKET_API_BASE_PATH là GỐC của danh sách ticket; để trống =
// chưa tích hợp: không hiện toast, giảng viên chỉ xem được nội dung (fail-closed), không có dữ liệu giả.
"use client";

import { createApiClient } from "@/lib/api/api-client";
import { toTicketList } from "@/lib/tickets/ticket-stats";
import type { TicketResponse } from "@/types/ticket";

function getTicketApiBase(): string | null {
  const base = process.env.NEXT_PUBLIC_TICKET_API_BASE_PATH?.trim().replace(/\/+$/, "");
  return base || null;
}

const client = createApiClient(getTicketApiBase);

/** Danh sách ticket (Admin: mọi ticket; giảng viên: ticket của mình — backend quyết định theo principal). Nhận mảng trần/`content`/`items`. */
export async function getTickets(page = 0, size = 100): Promise<TicketResponse[]> {
  return toTicketList(await client.get<unknown>(`?page=${page}&size=${size}`));
}
