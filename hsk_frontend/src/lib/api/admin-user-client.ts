// Client ĐỌC danh sách người dùng cho bộ chọn người nhận thông báo (màn Admin). Cùng khuôn với ticket-client.ts.
//
// NEXT_PUBLIC_ADMIN_USER_API_BASE_PATH là GỐC của danh sách người dùng quản trị (HSK cũ: `/id/admin/users`, thuộc dịch vụ định danh, KHÔNG
// thuộc dịch vụ thông báo nên không dùng chung biến với notification-client). Để trống = chưa tích hợp (WAITING FOR BACKEND): bộ chọn người
// nhận hiện trạng thái chờ, không có dữ liệu giả. Client này chỉ có thao tác đọc.
"use client";

import { createApiClient } from "@/lib/api/api-client";
import type { AdminUserListResponse, AdminUserQuery } from "@/types/admin-user";

function getAdminUserApiBase(): string | null {
  const base = process.env.NEXT_PUBLIC_ADMIN_USER_API_BASE_PATH?.trim().replace(/\/+$/, "");
  return base || null;
}

const client = createApiClient(getAdminUserApiBase);

/** Đúng thứ tự và điều kiện tham số của adminUserService.getUsers cũ (không gửi search/role rỗng). */
export function fetchAdminUsers(query: AdminUserQuery = {}): Promise<AdminUserListResponse> {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.append("page", String(query.page));
  if (query.size !== undefined) params.append("size", String(query.size));
  if (query.search) params.append("search", query.search);
  if (query.role) params.append("role", query.role);
  return client.get<AdminUserListResponse>(`?${params.toString()}`);
}
