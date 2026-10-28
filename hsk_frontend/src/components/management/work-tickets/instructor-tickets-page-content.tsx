"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { InstructorTicketsView } from "@/components/management/work-tickets/instructor-tickets-view";
import { INSTRUCTOR_TICKET_PAGE_SIZE, useWorkTickets } from "@/components/management/work-tickets/use-work-tickets";
import { useWriteGate } from "@/hooks/use-write-gate";
import { apiErrorMessage } from "@/lib/api/api-error-message";
import { doneTicket } from "@/lib/api/ticket-client";
import { EMPTY_TICKET_FILTERS, filterTickets, isOwnTicket, type TicketFilters } from "@/lib/work-tickets/ticket-model";
import { useAppSelector } from "@/redux/hooks";
import type { TicketResponse } from "@/types/ticket";

/**
 * Màn "Danh sách Phân công công việc" của giảng viên (/instructor/instructor-tickets; HSK cũ: InstructorTickets + ticket-slice.fetchMyTickets).
 * Khác bản cũ có chủ đích: chỉ hiện ticket có `assignedId` = id người dùng hiện tại (bản cũ hiện nguyên danh sách API trả) — cùng cách đếm với màn
 * Tổng quan và toast ở sidebar (summarizeAssignedTickets/computeTicketStats), để không lộ ticket của người khác nếu backend trả rộng hơn.
 */
export function InstructorTicketsPageContent() {
  const user = useAppSelector((s) => s.auth.user);
  const { enabled: writeEnabled, demo } = useWriteGate("work-tickets");
  const { state, reload, lastData } = useWorkTickets(INSTRUCTOR_TICKET_PAGE_SIZE);
  const [filters, setFilters] = useState<TicketFilters>(EMPTY_TICKET_FILTERS);
  const [busy, setBusy] = useState(false);

  const userId = user?.id;
  const filtered = useMemo(() => {
    const tickets = state.kind === "ok" ? state.data : state.kind === "loading" ? (lastData ?? []) : [];
    return filterTickets(tickets.filter((t) => isOwnTicket(t, userId)), filters, "instructor");
  }, [state, lastData, userId, filters]);

  const markDone = async (ticket: TicketResponse) => {
    if (busy) return;
    setBusy(true);
    try {
      await doneTicket(ticket.id, demo);
      toast.success("Đã báo cáo hoàn thành công việc!");
      reload();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Thao tác thất bại"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <InstructorTicketsView
      state={state}
      filtered={filtered}
      filters={filters}
      writeEnabled={writeEnabled}
      busy={busy}
      onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
      onResetFilters={() => setFilters(EMPTY_TICKET_FILTERS)}
      onRetry={reload}
      onMarkDone={markDone}
    />
  );
}
