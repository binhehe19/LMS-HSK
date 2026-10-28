// Client cho dịch vụ thông báo của backend chung (repo-notification, Go — `/api/notification/*` sau Traefik). Hợp đồng THẬT (đọc source 2026-10-27):
//   GET  /notifications?page&size (size ≤ 100)  → {items, totalElements, totalPages, page, size, unreadCount}   (JSON trần, không bọc {success,data})
//   GET  /notifications/unread-count            → {unreadCount}
//   POST /notifications/{id}/read | /{id}/seen  → 204
//   POST /notifications/seen/all                → 204   (KHÔNG có "đọc tất cả")
// Khác HSK cũ: không lọc theo trạng thái đọc/khoảng ngày ở server => khi có bộ lọc, client lấy toàn bộ trang rồi lọc (notification-filter.ts);
// "đánh dấu tất cả đã đọc" = đọc từng thông báo chưa đọc. Trạng thái: AVAILABLE (chưa xác minh trên môi trường thật).
// NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH trống = chưa tích hợp (WAITING FOR BACKEND): chuông vẫn hiện nhưng không có số đếm và không có dữ liệu giả.
//
// Chiến dịch của Admin (lịch sử, gửi) KHÔNG có trong backend chung: hợp đồng đề xuất kế thừa HSK cũ, đi qua hsk-client (/notification/admin/campaigns).
"use client";

import { createApiClient } from "@/lib/api/api-client";
import { getCampaignSendAvailability } from "@/lib/api/campaign-send-gate";
import { hskClient } from "@/lib/api/hsk-client";
import { hasActiveFilters, matchesFilters, paginateFiltered } from "@/lib/notifications/notification-filter";
import type { CampaignPageResponse, CampaignResponse, NotificationPageResponse, NotificationResponse, SendCampaignRequest, UnreadCountResponse } from "@/types/notification";

function getNotificationApiBase(): string | null {
  const base = process.env.NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH?.trim().replace(/\/+$/, "");
  return base || null;
}

const client = createApiClient(getNotificationApiBase);

export interface FetchNotificationsParams {
  readStatus?: "ALL" | "READ" | "UNREAD";
  /** ISO-8601 */
  fromDate?: string;
  toDate?: string;
  page?: number;
  size?: number;
}

/** Giới hạn của backend chung (size tối đa 100) và số trang tối đa client chịu lấy khi phải lọc phía client. */
const SERVER_MAX_PAGE_SIZE = 100;
const MAX_PAGES_WHEN_FILTERING = 10;

function normalizePage(raw: unknown): NotificationPageResponse {
  const p = (raw ?? {}) as Partial<NotificationPageResponse>;
  return {
    items: Array.isArray(p.items) ? p.items : [],
    totalElements: Number(p.totalElements) || 0,
    totalPages: Number(p.totalPages) || 0,
    page: Number(p.page) || 0,
    size: Number(p.size) || 0,
    unreadCount: Number(p.unreadCount) || 0,
  };
}

function fetchPage(page: number, size: number): Promise<NotificationPageResponse> {
  return client.get<NotificationPageResponse>(`/notifications?page=${page}&size=${Math.min(Math.max(1, size), SERVER_MAX_PAGE_SIZE)}`).then(normalizePage);
}

/** Lấy mọi trang (tối đa MAX_PAGES_WHEN_FILTERING × 100) để lọc phía client; `truncated` khi còn trang chưa lấy. */
async function fetchAll(): Promise<{ items: NotificationResponse[]; unreadCount: number; truncated: boolean }> {
  const items: NotificationResponse[] = [];
  let unreadCount = 0;
  for (let page = 0; page < MAX_PAGES_WHEN_FILTERING; page++) {
    const res = await fetchPage(page, SERVER_MAX_PAGE_SIZE);
    items.push(...res.items);
    unreadCount = res.unreadCount;
    if (page + 1 >= res.totalPages || res.items.length === 0) return { items, unreadCount, truncated: false };
  }
  return { items, unreadCount, truncated: true };
}

/**
 * Danh sách thông báo theo bộ lọc/trang (page từ 0). Không có bộ lọc => một trang của server; có bộ lọc => lấy mọi trang rồi lọc + cắt trang ở client.
 */
export async function fetchNotifications(params: FetchNotificationsParams = {}): Promise<NotificationPageResponse> {
  const page = params.page ?? 0;
  const size = params.size ?? 20;
  const filters = { readStatus: params.readStatus ?? "ALL", fromDate: params.fromDate, toDate: params.toDate } as const;
  if (!hasActiveFilters(filters)) return fetchPage(page, size);
  const all = await fetchAll();
  const matched = all.items.filter((n) => matchesFilters(n, filters));
  return { ...paginateFiltered(matched, page, size), unreadCount: all.unreadCount };
}

export async function getUnreadCount(): Promise<number> {
  const data = await client.get<UnreadCountResponse | number>("/notifications/unread-count");
  const n = typeof data === "number" ? data : Number((data as UnreadCountResponse | null)?.unreadCount);
  return Number.isFinite(n) ? n : 0;
}

/** POST /notifications/{id}/read → 204 (không có thân). */
export async function markNotificationRead(id: string): Promise<void> {
  await client.post<unknown>(`/notifications/${encodeURIComponent(id)}/read`);
}

/** Backend chung không có "đọc tất cả": đọc lần lượt từng thông báo chưa đọc (theo nhóm 5 để không dội server). */
export async function markAllNotificationsRead(): Promise<void> {
  const all = await fetchAll();
  const unread = all.items.filter((n) => !n.read).map((n) => n.id);
  for (let i = 0; i < unread.length; i += 5) {
    await Promise.all(unread.slice(i, i + 5).map((id) => markNotificationRead(id)));
  }
}

// ---- Admin: chiến dịch thông báo (màn /admin/settings/notifications) — hợp đồng ĐỀ XUẤT qua hsk-client, backend chung chưa có ----

/** Lịch sử chiến dịch (chỉ đọc). Bản cũ: GET /notification/admin/campaigns?page=&size= */
export function fetchCampaigns(page = 0, size = 10): Promise<CampaignPageResponse> {
  return hskClient.get<CampaignPageResponse>(`/notification/admin/campaigns?page=${page}&size=${size}`);
}

/** Ném khi thao tác gửi bị công tắc an toàn chặn: KHÔNG có request nào được tạo. */
export class CampaignSendDisabledError extends Error {
  constructor() {
    super("Gửi chiến dịch thông báo chưa được tích hợp (WAITING FOR BACKEND).");
    this.name = "CampaignSendDisabledError";
  }
}

/** Gửi chiến dịch NGAY (thao tác ghi). Bị chặn ở đây — lớp cuối cùng — nếu công tắc gửi chưa mở (campaign-send-gate.ts; `demoActive` = chế độ xem trước cục bộ). */
export async function sendCampaign(request: SendCampaignRequest, demoActive = false): Promise<CampaignResponse> {
  if (getCampaignSendAvailability(demoActive) !== "enabled") throw new CampaignSendDisabledError();
  return hskClient.post<CampaignResponse>("/notification/admin/campaigns/send-now", request);
}
