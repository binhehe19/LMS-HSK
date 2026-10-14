"use client";

import { useEffect, useState } from "react";
import { getTickets } from "@/lib/api/ticket-client";
import { computeTicketStats, type TicketToastStats, type TicketToastVariant } from "@/lib/tickets/ticket-stats";
import { useAppSelector } from "@/redux/hooks";

const AUTO_CLOSE_MS = 10_000;

export interface TicketWelcomeToastState {
  visible: boolean;
  stats: TicketToastStats;
  dismiss: () => void;
}

/**
 * Lấy ticket MỘT lần mỗi phiên trình duyệt (khóa sessionStorage theo người dùng, như bản cũ) và hiện toast 10 giây nếu có ticket
 * OPEN/DONE. Chỉ gọi khi đã xác thực. Lỗi mạng/API: im lặng, không hiện toast, lần tải sau thử lại (khóa chỉ ghi khi gọi thành công).
 */
export function useTicketWelcomeToast(variant: TicketToastVariant, sessionKeyPrefix: string): TicketWelcomeToastState {
  const user = useAppSelector((state) => state.auth.user);
  const status = useAppSelector((state) => state.auth.status);
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState<TicketToastStats>({ open: 0, done: 0 });

  const userId = user?.id;
  useEffect(() => {
    if (status !== "authenticated" || !userId) return;
    const key = `${sessionKeyPrefix}${userId}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* sessionStorage bị chặn: vẫn hiện toast, chỉ không nhớ được */
    }

    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    getTickets(0, 100)
      .then((tickets) => {
        if (disposed) return;
        try {
          sessionStorage.setItem(key, "true");
        } catch {
          /* bỏ qua */
        }
        const next = computeTicketStats(tickets, variant, userId);
        if (next.open > 0 || next.done > 0) {
          setStats(next);
          setVisible(true);
          closeTimer = setTimeout(() => setVisible(false), AUTO_CLOSE_MS);
        }
      })
      .catch(() => {
        // Chưa cấu hình dịch vụ ticket (WAITING FOR BACKEND) hoặc lỗi API: không hiện toast, không có số giả; khóa chưa ghi nên lần mount sau thử lại.
      });

    return () => {
      disposed = true;
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, [status, userId, variant, sessionKeyPrefix]);

  return { visible, stats, dismiss: () => setVisible(false) };
}
