"use client";

import { useCallback, useState } from "react";
import { ApiNotConfiguredError } from "@/lib/api/api-client";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api/notification-client";
import { NOTIFICATIONS_UPDATED_EVENT } from "@/components/management/notifications/use-unread-count";
import type { NotificationResponse } from "@/types/notification";

/** waiting = chưa cấu hình dịch vụ (WAITING FOR BACKEND); error = gọi lỗi; ready = dữ liệu thật (có thể rỗng). */
export type NotificationListStatus = "idle" | "loading" | "ready" | "waiting" | "error";

const DROPDOWN_PAGE_SIZE = 10; // như bản cũ: chuông chỉ lấy 10 thông báo mới nhất

export function useNotificationList() {
  const [status, setStatus] = useState<NotificationListStatus>("idle");
  const [items, setItems] = useState<NotificationResponse[]>([]);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const page = await fetchNotifications({ size: DROPDOWN_PAGE_SIZE });
      setItems(Array.isArray(page?.items) ? page.items : []);
      setStatus("ready");
    } catch (error) {
      setItems([]);
      setStatus(error instanceof ApiNotConfiguredError ? "waiting" : "error");
    }
  }, []);

  /** Đánh dấu đã đọc một thông báo; trả về true nếu server xác nhận. Lỗi không chặn việc điều hướng của người dùng (như bản cũ). */
  const markRead = useCallback(async (id: string): Promise<boolean> => {
    try {
      await markNotificationRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT));
      return true;
    } catch {
      return false;
    }
  }, []);

  const markAllRead = useCallback(async (): Promise<boolean> => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT));
      return true;
    } catch {
      return false;
    }
  }, []);

  return { status, items, load, markRead, markAllRead };
}
