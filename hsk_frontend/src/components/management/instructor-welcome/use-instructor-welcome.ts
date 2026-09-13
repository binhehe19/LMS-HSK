"use client";

import { useCallback, useEffect, useState } from "react";
import { useUnreadCount, type UnreadCountState } from "@/components/management/notifications/use-unread-count";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getTickets } from "@/lib/api/ticket-client";
import { summarizeAssignedTickets, type AssignedTicketSummary } from "@/lib/instructor-welcome/welcome-summary";

/**
 * Trạng thái số liệu công việc. `waiting` = dịch vụ ticket chưa được cấu hình (WAITING FOR BACKEND), khác với `error` (đã gọi nhưng thất bại).
 * Không có dữ liệu mẫu tự động thay thế khi chưa có/ lỗi: view hiện "—", không hiện số 0 giả.
 */
export type WelcomeTicketsState =
  | { kind: "loading" }
  | { kind: "ok"; summary: AssignedTicketSummary }
  | { kind: "waiting" }
  | { kind: "error"; message: string };

const TICKET_PAGE_SIZE = 50; // như fetchMyTickets của HSK cũ (getTickets(0, 50))

export function useInstructorWelcome(userId: string | undefined) {
  const [tickets, setTickets] = useState<WelcomeTicketsState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  // Bản cũ tự đếm thông báo chưa đọc riêng (poll 30 giây, cùng nguồn với chuông ở sidebar); giữ nguyên cách đó.
  const unread: UnreadCountState = useUnreadCount();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    getTickets(0, TICKET_PAGE_SIZE)
      .then((list): WelcomeTicketsState => ({ kind: "ok", summary: summarizeAssignedTickets(list, userId) }))
      .catch((error: unknown): WelcomeTicketsState => {
        if (error instanceof ApiNotConfiguredError) return { kind: "waiting" };
        if (error instanceof ApiError) return { kind: "error", message: error.message };
        return { kind: "error", message: "Không tải được số liệu công việc." };
      })
      .then((next) => {
        if (!cancelled) setTickets(next);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  const reload = useCallback(() => {
    setTickets({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { tickets, unread, reload };
}
