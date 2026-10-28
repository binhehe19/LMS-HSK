"use client";

import { useEffect, useState } from "react";
import { ApiNotConfiguredError } from "@/lib/api/api-client";
import { getUnreadCount } from "@/lib/api/notification-client";

/** Sự kiện cửa sổ để các màn hình thông báo báo cho sidebar đếm lại (tên giữ nguyên như bản cũ). */
export const NOTIFICATIONS_UPDATED_EVENT = "notifications-updated";
const POLL_INTERVAL_MS = 30_000;

/**
 * waiting : dịch vụ thông báo chưa được cấu hình (WAITING FOR BACKEND) — không gọi mạng lại, không có số đếm
 * loading : chưa có kết quả đầu tiên
 * ready   : count là số thật từ server
 * error   : lần gọi gần nhất lỗi; count giữ số thật gần nhất (nếu có), KHÔNG bịa số
 */
export interface UnreadCountState {
  status: "waiting" | "loading" | "ready" | "error";
  count: number | null;
}

type Update = (prev: UnreadCountState) => UnreadCountState;

export function useUnreadCount(): UnreadCountState {
  const [state, setState] = useState<UnreadCountState>({ status: "loading", count: null });

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    /** Gọi API một lần, cập nhật state; trả về false nếu dịch vụ chưa cấu hình (khi đó không đặt lịch hỏi lại). */
    const load = (): Promise<boolean> =>
      getUnreadCount()
        .then((count): [Update, boolean] => {
          const n = Number(count);
          return [() => ({ status: "ready", count: Number.isFinite(n) ? n : 0 }), true];
        })
        .catch((error: unknown): [Update, boolean] =>
          error instanceof ApiNotConfiguredError
            ? [() => ({ status: "waiting", count: null }), false]
            : [(prev) => ({ status: "error", count: prev.count }), true],
        )
        .then(([update, shouldPoll]) => {
          if (!disposed) setState(update);
          return shouldPoll;
        });

    const onUpdated = () => {
      void load();
    };

    void load().then((shouldPoll) => {
      if (disposed || !shouldPoll) return;
      timer = setInterval(() => void load(), POLL_INTERVAL_MS);
      window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
    });

    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
    };
  }, []);

  return state;
}
