import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiNotConfiguredError } from "@/lib/api/api-client";
import { fetchCampaigns, fetchNotifications, getUnreadCount, markAllNotificationsRead, markNotificationRead } from "@/lib/api/notification-client";
import { hasActiveFilters, matchesFilters, paginateFiltered } from "@/lib/notifications/notification-filter";
import type { NotificationResponse } from "@/types/notification";

const noti = (id: string, read: boolean, createdAt: string): NotificationResponse => ({ id, action: "ASSESSMENT_GRADED", title: id, message: "", payload: null, read, seen: read, createdAt, readAt: null, seenAt: null });
const raw = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: status === 204 ? {} : { "content-type": "application/json" } });
const page = (items: NotificationResponse[], pageNo: number, totalPages: number, unreadCount = 3) => ({ items, totalElements: items.length * totalPages, totalPages, page: pageNo, size: 100, unreadCount });

describe("notification-client — hợp đồng repo-notification (backend chung, JSON trần)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH", "/api/notification");
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "/api/hsk");
  });

  it("không bộ lọc: GET /notifications?page&size đúng một lần, trả nguyên trang của server", async () => {
    fetchMock.mockResolvedValue(raw({ items: [noti("a", false, "2026-10-27T01:00:00Z")], totalElements: 1, totalPages: 1, page: 0, size: 10, unreadCount: 1 }));
    const res = await fetchNotifications({ page: 0, size: 10, readStatus: "ALL" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[0]).toBe("/api/notification/notifications?page=0&size=10");
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].credentials).toBe("include");
    expect(res.items.map((n) => n.id)).toEqual(["a"]);
    expect(res.unreadCount).toBe(1);
  });

  it("có bộ lọc: lấy mọi trang (size 100) rồi lọc + cắt trang ở client vì server không lọc", async () => {
    const all = [noti("a", false, "2026-10-27T01:00:00Z"), noti("b", true, "2026-10-26T01:00:00Z"), noti("c", false, "2026-10-20T01:00:00Z")];
    fetchMock.mockImplementation((url: string) => {
      const p = Number(new URL(url, "http://x").searchParams.get("page"));
      return Promise.resolve(raw(page(p === 0 ? all.slice(0, 2) : all.slice(2), p, 2, 2)));
    });
    const res = await fetchNotifications({ readStatus: "UNREAD", page: 0, size: 10 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("/api/notification/notifications?page=0&size=100");
    expect(res.items.map((n) => n.id)).toEqual(["a", "c"]);
    expect(res.totalElements).toBe(2);
    expect(res.unreadCount).toBe(2);
  });

  it("size vượt 100 bị kẹp về 100 (giới hạn của backend chung)", async () => {
    fetchMock.mockResolvedValue(raw(page([], 0, 0)));
    await fetchNotifications({ page: 0, size: 500 });
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("/api/notification/notifications?page=0&size=100");
  });

  it("unread-count: nhận {unreadCount} của backend chung và số trần của HSK cũ", async () => {
    fetchMock.mockResolvedValueOnce(raw({ unreadCount: 7 }));
    expect(await getUnreadCount()).toBe(7);
    fetchMock.mockResolvedValueOnce(raw({ success: true, data: 4 }));
    expect(await getUnreadCount()).toBe(4);
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("/api/notification/notifications/unread-count");
  });

  it("đánh dấu đã đọc: POST /notifications/{id}/read, chấp nhận 204 không thân", async () => {
    fetchMock.mockResolvedValue(raw(undefined, 204));
    await expect(markNotificationRead("n 1")).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/notification/notifications/n%201/read");
    expect(init.method).toBe("POST");
  });

  it("đọc tất cả: backend chung không có read/all => lấy mọi trang rồi POST read từng thông báo chưa đọc", async () => {
    const all = [noti("a", false, "2026-10-27T01:00:00Z"), noti("b", true, "2026-10-26T01:00:00Z"), noti("c", false, "2026-10-20T01:00:00Z")];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST") return Promise.resolve(raw(undefined, 204));
      return Promise.resolve(raw(page(all, 0, 1, 2)));
    });
    await markAllNotificationsRead();
    const posts = fetchMock.mock.calls.filter((c) => (c[1] as RequestInit)?.method === "POST").map((c) => c[0]);
    expect(posts.sort()).toEqual(["/api/notification/notifications/a/read", "/api/notification/notifications/c/read"]);
  });

  it("chiến dịch (hợp đồng đề xuất) đi qua hsk-client, không qua dịch vụ thông báo của backend chung", async () => {
    fetchMock.mockResolvedValue(raw({ success: true, data: { items: [], totalElements: 0, totalPages: 0, page: 0, size: 10 } }));
    await fetchCampaigns(0, 10);
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("/api/hsk/notification/admin/campaigns?page=0&size=10");
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "");
    await expect(fetchCampaigns()).rejects.toBeInstanceOf(ApiNotConfiguredError);
  });

  it("chưa cấu hình dịch vụ thông báo => ApiNotConfiguredError, không gọi mạng", async () => {
    vi.stubEnv("NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH", "");
    await expect(getUnreadCount()).rejects.toBeInstanceOf(ApiNotConfiguredError);
    await expect(fetchNotifications()).rejects.toBeInstanceOf(ApiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("notification-filter (hàm thuần)", () => {
  const items = [noti("a", false, "2026-10-27T01:00:00Z"), noti("b", true, "2026-10-26T01:00:00Z"), noti("c", false, "2026-10-20T01:00:00Z"), { ...noti("d", true, "không phải ngày") }];

  it("hasActiveFilters", () => {
    expect(hasActiveFilters({ readStatus: "ALL" })).toBe(false);
    expect(hasActiveFilters({ readStatus: "READ" })).toBe(true);
    expect(hasActiveFilters({ readStatus: "ALL", fromDate: "2026-10-01T00:00:00Z" })).toBe(true);
  });

  it("lọc theo trạng thái đọc và khoảng ngày (createdAt không hợp lệ bị loại khi có khoảng ngày)", () => {
    expect(items.filter((n) => matchesFilters(n, { readStatus: "UNREAD" })).map((n) => n.id)).toEqual(["a", "c"]);
    expect(items.filter((n) => matchesFilters(n, { readStatus: "READ" })).map((n) => n.id)).toEqual(["b", "d"]);
    expect(items.filter((n) => matchesFilters(n, { readStatus: "ALL", fromDate: "2026-10-25T00:00:00Z" })).map((n) => n.id)).toEqual(["a", "b"]);
    expect(items.filter((n) => matchesFilters(n, { readStatus: "ALL", toDate: "2026-10-21T00:00:00Z" })).map((n) => n.id)).toEqual(["c"]);
  });

  it("cắt trang sau lọc", () => {
    expect(paginateFiltered([1, 2, 3, 4, 5], 1, 2)).toEqual({ items: [3, 4], totalElements: 5, totalPages: 3, page: 1, size: 2 });
    expect(paginateFiltered([], 0, 10)).toEqual({ items: [], totalElements: 0, totalPages: 0, page: 0, size: 10 });
  });
});
