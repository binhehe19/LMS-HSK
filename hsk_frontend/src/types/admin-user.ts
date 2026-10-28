// DTO danh sách người dùng cho bộ chọn người nhận thông báo (core/types/admin-user.type.ts của HSK cũ, chỉ phần màn thông báo dùng).
// CHƯA đối chiếu với backend mới (xem docs/api-requirements/notifications.md mục 5): hợp đồng GIẢ ĐỊNH lấy từ code cũ.
export interface AdminUser {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string | null;
  roles: string[];
  /** "ACTIVE", "INACTIVE", "BLOCKED", ... */
  status?: string;
}

export interface AdminUserListResponse {
  items: AdminUser[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface AdminUserQuery {
  /** Trang bắt đầu từ 0 */
  page?: number;
  size?: number;
  search?: string;
  role?: string;
}
