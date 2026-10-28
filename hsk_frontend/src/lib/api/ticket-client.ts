// Client cho dịch vụ ticket "phân công công việc" (toast chào mừng ở sidebar + hai màn /admin/tickets, /instructor/instructor-tickets).
// WAITING FOR BACKEND: đường dẫn kế thừa ticket.service.ts của HSK cũ (gốc `/id/tickets`, dịch vụ định danh) theo HỢP ĐỒNG ĐỀ XUẤT ở
// docs/api-requirements/work-tickets.md; backend chung LMS_IELTS chưa có endpoint tương đương. NEXT_PUBLIC_TICKET_API_BASE_PATH là GỐC của danh sách
// ticket; để trống = chưa tích hợp: không hiện toast, màn hình hiện WAITING FOR BACKEND, không có dữ liệu giả.
//
// Thao tác GHI đi qua công tắc an toàn (lib/api/write-gate.ts, miền "work-tickets"): chỉ chạy trong chế độ demo cục bộ hoặc khi
// NEXT_PUBLIC_WRITE_WORK_TICKETS=enabled; ngoài ra hàm ném WriteDisabledError và KHÔNG tạo request.
"use client";

import { createApiClient } from "@/lib/api/api-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import { toTicketList } from "@/lib/tickets/ticket-stats";
import type { TicketAssigneeOptionResponse, TicketCreateRequest, TicketResponse, TicketUpdateRequest } from "@/types/ticket";

function getTicketApiBase(): string | null {
  const base = process.env.NEXT_PUBLIC_TICKET_API_BASE_PATH?.trim().replace(/\/+$/, "");
  return base || null;
}

const client = createApiClient(getTicketApiBase);
const enc = encodeURIComponent;

/** Danh sách ticket (Admin: mọi ticket; giảng viên: ticket của mình — backend quyết định theo principal). Nhận mảng trần/`content`/`items`. */
export async function getTickets(page = 0, size = 100): Promise<TicketResponse[]> {
  return toTicketList(await client.get<unknown>(`?page=${page}&size=${size}`));
}

/** Người có thể được giao việc (giảng viên/CTV...). `q` lọc theo tên/email phía máy chủ; bỏ trống = toàn bộ (bản cũ gọi không có `q`). */
export function getTicketAssignees(q?: string): Promise<TicketAssigneeOptionResponse[]> {
  const keyword = q?.trim();
  return client.get<TicketAssigneeOptionResponse[]>(keyword ? `/assignees?q=${enc(keyword)}` : "/assignees");
}

// ---- thao tác GHI (write gate "work-tickets"); `async` để lỗi công tắc cũng là promise bị reject ----

/** Admin tạo một ticket (một người × một module); màn Admin gọi lặp cho từng tổ hợp như bản cũ. */
export async function createTicket(body: TicketCreateRequest, demoActive: boolean): Promise<TicketResponse> {
  assertWriteEnabled("work-tickets", demoActive);
  return client.post<TicketResponse>("", body);
}

/** Admin sửa ticket đang mở. */
export async function updateTicket(id: string, body: TicketUpdateRequest, demoActive: boolean): Promise<TicketResponse> {
  assertWriteEnabled("work-tickets", demoActive);
  return client.put<TicketResponse>(`/${enc(id)}`, body);
}

/** Admin xoá ticket đã đóng. */
export async function deleteTicket(id: string, demoActive: boolean): Promise<void> {
  assertWriteEnabled("work-tickets", demoActive);
  await client.delete<unknown>(`/${enc(id)}`);
}

/** Admin đóng ticket (thu hồi quyền sửa nội dung của module tương ứng). */
export async function closeTicket(id: string, demoActive: boolean): Promise<void> {
  assertWriteEnabled("work-tickets", demoActive);
  await client.post<unknown>(`/${enc(id)}/close`);
}

/** Giảng viên báo cáo hoàn thành ticket của CHÍNH mình (OPEN → DONE). */
export async function doneTicket(id: string, demoActive: boolean): Promise<void> {
  assertWriteEnabled("work-tickets", demoActive);
  await client.post<unknown>(`/${enc(id)}/done`);
}
