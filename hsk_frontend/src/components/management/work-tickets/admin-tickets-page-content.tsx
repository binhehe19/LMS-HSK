"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminTicketsView } from "@/components/management/work-tickets/admin-tickets-view";
import { TicketFormModal } from "@/components/management/work-tickets/ticket-form-modal";
import { useTicketAssignees } from "@/components/management/work-tickets/use-ticket-assignees";
import { MANAGER_TICKET_PAGE_SIZE, useWorkTickets } from "@/components/management/work-tickets/use-work-tickets";
import { confirmAction } from "@/components/shared/confirm-action";
import { useWriteGate } from "@/hooks/use-write-gate";
import { apiErrorMessage } from "@/lib/api/api-error-message";
import { closeTicket, createTicket, deleteTicket, updateTicket } from "@/lib/api/ticket-client";
import {
  EMPTY_TICKET_FILTERS,
  TICKET_FORM_DEFAULT,
  filterTickets,
  ticketCombinations,
  ticketToForm,
  validateTicketForm,
  type TicketFilters,
  type TicketFormState,
} from "@/lib/work-tickets/ticket-model";
import type { TicketResponse } from "@/types/ticket";

type ModalState = { mode: "add" } | { mode: "edit"; ticket: TicketResponse } | null;

/**
 * Màn "Phân công công việc" của Admin (/admin/tickets; HSK cũ: TeacherManagerTickets). Logic của component cũ tách ra đây: tải danh sách
 * (useWorkTickets), người được giao (useTicketAssignees — tải lần đầu mở modal), tạo (một ticket cho MỖI tổ hợp người × module như bản cũ),
 * sửa, đóng, xoá (xác nhận bằng confirmAction). Mọi thao tác ghi qua công tắc "work-tickets"; thất bại => toast lỗi, không bao giờ báo thành công giả.
 */
export function AdminTicketsPageContent() {
  const { enabled: writeEnabled, demo } = useWriteGate("work-tickets");
  const { state, reload, lastData } = useWorkTickets(MANAGER_TICKET_PAGE_SIZE);
  const [filters, setFilters] = useState<TicketFilters>(EMPTY_TICKET_FILTERS);
  const [modal, setModal] = useState<ModalState>(null);
  // Mỗi lần mở modal tăng một => modal được tạo lại với form ban đầu mới (form sống trong modal, xem ticket-form-modal.tsx).
  const [openSeq, setOpenSeq] = useState(0);
  const [assigneesWanted, setAssigneesWanted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const assignees = useTicketAssignees(assigneesWanted);

  // Khi tải lại sau một thao tác ghi, giữ các dòng cũ thay vì bảng trống chớp nháy (lastData = kết quả thành công gần nhất).
  const filtered = useMemo(() => {
    const tickets = state.kind === "ok" ? state.data : state.kind === "loading" ? (lastData ?? []) : [];
    return filterTickets(tickets, filters, "manager");
  }, [state, lastData, filters]);

  const openModal = (next: Exclude<ModalState, null>) => {
    setAssigneesWanted(true);
    setOpenSeq((n) => n + 1);
    setModal(next);
  };
  const closeModal = () => setModal(null);

  const submit = async (form: TicketFormState) => {
    if (!modal || submitting) return;
    const invalid = validateTicketForm(form, modal.mode);
    if (invalid) {
      toast.warning(invalid);
      return;
    }
    setSubmitting(true);
    try {
      if (modal.mode === "add") {
        let created = 0;
        let failed = 0;
        for (const body of ticketCombinations(form)) {
          try {
            await createTicket(body, demo);
            created += 1;
          } catch {
            failed += 1;
          }
        }
        if (created > 0) {
          toast.success(`Đã phân công thành công ${created} ticket`);
          closeModal();
          reload();
        }
        if (failed > 0) toast.error(`Có ${failed} yêu cầu thất bại`);
      } else {
        try {
          await updateTicket(modal.ticket.id, { assignedId: form.assignedIds[0], module: form.modules[0], description: form.description }, demo);
          toast.success("Cập nhật ticket thành công");
          closeModal();
          reload();
        } catch (error) {
          toast.error(apiErrorMessage(error, "Cập nhật thất bại"));
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Bản cũ đóng ngay khi bấm (không hộp xác nhận); giữ nguyên.
  const closeOne = async (ticket: TicketResponse) => {
    try {
      await closeTicket(ticket.id, demo);
      toast.success("Đã đóng ticket và thu hồi quyền");
      reload();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Thao tác thất bại"));
    }
  };

  const deleteOne = async (ticket: TicketResponse) => {
    const agreed = await confirmAction({
      title: "Xác nhận xóa?",
      content: "Hành động này sẽ xóa hoàn toàn ticket phân công và không thể khôi phục được quyền hạn này.",
      okText: "Xác nhận Xóa",
      cancelText: "Hủy",
      danger: true,
    });
    if (!agreed) return;
    try {
      await deleteTicket(ticket.id, demo);
      toast.success("Đã xóa ticket thành công");
      reload();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Xóa thất bại"));
    }
  };

  return (
    <>
      <AdminTicketsView
        state={state}
        filtered={filtered}
        filters={filters}
        writeEnabled={writeEnabled}
        onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onResetFilters={() => setFilters(EMPTY_TICKET_FILTERS)}
        onRetry={reload}
        onCreate={() => openModal({ mode: "add" })}
        onEdit={(ticket) => openModal({ mode: "edit", ticket })}
        onClose={closeOne}
        onDelete={deleteOne}
      />
      <TicketFormModal
        key={openSeq}
        mode={modal?.mode ?? null}
        initial={modal?.mode === "edit" ? ticketToForm(modal.ticket) : TICKET_FORM_DEFAULT}
        assignees={assignees.state}
        onRetryAssignees={assignees.reload}
        submitting={submitting}
        writeEnabled={writeEnabled}
        onSubmit={submit}
        onCancel={closeModal}
      />
    </>
  );
}
