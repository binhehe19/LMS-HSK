// Hàm thuần của màn "Tổng quan" giảng viên (logic lấy nguyên từ features/instructor/instructor-welcome/instructor-welcome.tsx và
// ticket-slice.selectActiveTickets của HSK cũ).
import { hasAnyRole, ROLES } from "@/lib/auth/roles";
import type { TicketResponse } from "@/types/ticket";

export interface AssignedTicketSummary {
  openTickets: number;
  doneTickets: number;
  totalTickets: number;
  /** % ticket đã DONE trên tổng ticket đang phụ trách, làm tròn; 0 nếu không có ticket. */
  completionRate: number;
}

/**
 * "Công việc đang phụ trách" = ticket được giao cho CHÍNH người dùng (so sánh dạng chuỗi như bản cũ) và còn hiệu lực (OPEN hoặc DONE;
 * CLOSE không tính). Không có userId => không có ticket nào.
 */
export function summarizeAssignedTickets(tickets: readonly TicketResponse[], userId: string | number | undefined): AssignedTicketSummary {
  const mine = userId === undefined ? [] : tickets.filter((t) => (t.status === "OPEN" || t.status === "DONE") && String(t.assignedId) === String(userId));
  const openTickets = mine.filter((t) => t.status === "OPEN").length;
  const doneTickets = mine.filter((t) => t.status === "DONE").length;
  const totalTickets = mine.length;
  return { openTickets, doneTickets, totalTickets, completionRate: totalTickets > 0 ? Math.round((doneTickets / totalTickets) * 100) : 0 };
}

/**
 * Nhãn vai trò trên thẻ chào. Bản cũ: Collaborator → "Cộng tác viên", isTeacher (TEACHER hoặc MENTOR) → "Giảng viên", còn lại → "Người dùng".
 * Collaborator chưa được hỗ trợ ở app mới nên không có nhánh đó.
 */
export function welcomeRoleLabel(roles: readonly string[] | undefined | null): string {
  return hasAnyRole(roles, [ROLES.TEACHER, ROLES.MENTOR]) ? "Giảng viên" : "Người dùng";
}
