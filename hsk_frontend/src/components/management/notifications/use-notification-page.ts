"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { NOTIFICATIONS_UPDATED_EVENT } from "@/components/management/notifications/use-unread-count";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api/notification-client";
import { pickNotificationTarget } from "@/lib/notifications/notification-target";
import { clampedPageOrNull } from "@/lib/notifications/pagination";
import type { NotificationFilters, NotificationResponse } from "@/types/notification";

/**
 * Trạng thái danh sách. `waiting` = dịch vụ thông báo chưa được cấu hình (WAITING FOR BACKEND), khác `error` (đã gọi nhưng thất bại).
 * Không có dữ liệu mẫu thay thế khi chưa có/lỗi: view hiện khối thông báo, không hiện danh sách giả.
 */
export type NotificationPageState =
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "waiting" }
  | { kind: "error"; message: string };

const PAGE_SIZE = 10; // như useNotificationList của HSK cũ (size: 10)
const INITIAL_FILTERS: NotificationFilters = { page: 0, size: PAGE_SIZE, readStatus: "ALL" };

/**
 * Logic của màn "Thông báo của tôi". Tương đương features/notifications/hooks/use-notification-list.ts của HSK cũ:
 * tải theo bộ lọc, nghe sự kiện `notifications-updated` (chuông ở sidebar), đánh dấu đã đọc từng/tất cả, bấm vào thông báo => đánh dấu + điều hướng.
 * Khác bản cũ có chủ đích: (1) trạng thái waiting/error tách bạch (bản cũ chỉ hiện toast rồi danh sách rỗng), (2) bỏ qua phản hồi cũ khi
 * bộ lọc đã đổi, (3) KHÔNG phát sự kiện `exercise-graded` (chỉ phục vụ màn học viên, màn quản lý không có người nghe).
 */
export function useNotificationPage(onNavigate: (url: string) => void) {
  const [state, setState] = useState<NotificationPageState>({ kind: "loading" });
  const [items, setItems] = useState<NotificationResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filters, setFilters] = useState<NotificationFilters>(INITIAL_FILTERS);
  const [reloadTick, setReloadTick] = useState(0);

  // Tải theo bộ lọc/trang và mỗi lần reloadTick đổi. Cleanup huỷ phản hồi cũ (đổi bộ lọc giữa chừng, rời trang).
  useEffect(() => {
    let cancelled = false;
    fetchNotifications(filters)
      .then((page) => {
        if (cancelled) return;
        // Trang hiện tại không còn hợp lệ (dữ liệu giảm sau khi đọc/lọc/xoá ở nơi khác): nhảy về trang cuối còn dữ liệu thay vì hiện trang trống.
        const lastValid = clampedPageOrNull(filters.page, page?.totalElements ?? 0, filters.size);
        if (lastValid !== null) {
          setFilters((prev) => (prev.page === filters.page ? { ...prev, page: lastValid } : prev));
          return;
        }
        setItems(Array.isArray(page?.items) ? page.items : []);
        setTotalElements(page?.totalElements ?? 0);
        setUnreadCount(page?.unreadCount ?? 0);
        setState({ kind: "ok" });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setItems([]);
        setTotalElements(0);
        setUnreadCount(0);
        if (error instanceof ApiNotConfiguredError) {
          setState({ kind: "waiting" });
          return;
        }
        toast.error("Không thể tải danh sách thông báo"); // như bản cũ
        setState({ kind: "error", message: error instanceof ApiError ? error.message : "Không thể tải danh sách thông báo." });
      });
    return () => {
      cancelled = true;
    };
  }, [filters, reloadTick]);

  /** Tải lại với bộ lọc hiện tại (hiện spinner như bản cũ). */
  const reload = useCallback(() => {
    setState({ kind: "loading" });
    setReloadTick((n) => n + 1);
  }, []);

  // Đồng bộ với chuông ở sidebar (và với chính trang này sau khi đánh dấu đã đọc).
  useEffect(() => {
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, reload);
    return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, reload);
  }, [reload]);

  /** Đổi bộ lọc => về trang đầu (như handleFilterChange cũ). */
  const changeFilters = useCallback((patch: Partial<Pick<NotificationFilters, "readStatus" | "fromDate" | "toDate">>) => {
    setState({ kind: "loading" });
    setFilters((prev) => ({ ...prev, ...patch, page: 0 }));
  }, []);

  const goToPage = useCallback((page: number) => {
    setState({ kind: "loading" });
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      toast.success("Đã đánh dấu tất cả là đã đọc");
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT)); // chuông + chính trang này tải lại
    } catch {
      toast.error("Thao tác thất bại");
    }
  }, []);

  /**
   * Bấm vào một thông báo. Như bản cũ: nếu chưa đọc thì đánh dấu đã đọc trước (lỗi => không làm gì thêm); có đích nội bộ thì điều hướng,
   * không có thì chỉ tải lại danh sách.
   */
  const openNotification = async (noti: NotificationResponse) => {
    if (!noti.read) {
      try {
        await markNotificationRead(noti.id);
      } catch {
        return;
      }
    }
    const target = pickNotificationTarget(noti.payload);
    if (!noti.read) window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT)); // cập nhật chuông; trang này cũng tải lại qua sự kiện
    if (target) onNavigate(target);
    else if (noti.read) reload(); // chưa đọc thì sự kiện ở trên đã tải lại
  };

  return { state, items, totalElements, unreadCount, filters, reload, changeFilters, goToPage, markAllRead, openNotification };
}
