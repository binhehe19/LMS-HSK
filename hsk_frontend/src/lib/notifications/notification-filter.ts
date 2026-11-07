// Lọc/phân trang thông báo PHÍA CLIENT. Backend chung (repo-notification, Go) chỉ có `GET /notifications?page&size` — không lọc theo trạng thái đọc hay
// khoảng ngày như HSK cũ; khi người dùng đặt bộ lọc, client lấy toàn bộ trang rồi lọc ở đây (lib/api/notification-client.ts). Hàm thuần, test được.
import type { NotificationFilters, NotificationResponse } from "@/types/notification";

export function hasActiveFilters(filters: Pick<NotificationFilters, "readStatus" | "fromDate" | "toDate">): boolean {
  return (filters.readStatus !== undefined && filters.readStatus !== "ALL") || !!filters.fromDate || !!filters.toDate;
}

export function matchesFilters(n: NotificationResponse, filters: Pick<NotificationFilters, "readStatus" | "fromDate" | "toDate">): boolean {
  if (filters.readStatus === "READ" && !n.read) return false;
  if (filters.readStatus === "UNREAD" && n.read) return false;
  const created = Date.parse(n.createdAt);
  if (filters.fromDate) {
    const from = Date.parse(filters.fromDate);
    if (Number.isFinite(from) && !(Number.isFinite(created) && created >= from)) return false;
  }
  if (filters.toDate) {
    const to = Date.parse(filters.toDate);
    if (Number.isFinite(to) && !(Number.isFinite(created) && created <= to)) return false;
  }
  return true;
}

/** Cắt trang (page từ 0) sau khi lọc; trả về cùng hình dạng trang của backend. */
export function paginateFiltered<T>(items: T[], page: number, size: number): { items: T[]; totalElements: number; totalPages: number; page: number; size: number } {
  const safeSize = Math.max(1, size);
  const safePage = Math.max(0, page);
  return { items: items.slice(safePage * safeSize, safePage * safeSize + safeSize), totalElements: items.length, totalPages: Math.ceil(items.length / safeSize), page: safePage, size: safeSize };
}
