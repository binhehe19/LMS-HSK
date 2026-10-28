// Hàm thuần của hai màn "Phân công công việc" (Admin: teacher-manager-tickets.tsx; Giảng viên: instructor-tickets.tsx của HSK cũ).
// Không import React/antd; dùng dayjs cho ngày (bản cũ: Date + toLocaleDateString("vi-VN"), cùng kết quả DD/MM/YYYY).
import dayjs, { type Dayjs } from "dayjs";
import type { TicketAssigneeOptionResponse, TicketCreateRequest, TicketModule, TicketResponse, TicketStatus } from "@/types/ticket";

export interface TicketModuleOption {
  value: TicketModule;
  label: string;
}

/**
 * 12 lựa chọn như MODULE_OPTIONS của HSK cũ (cùng thứ tự, cùng nhãn). ONLINE_COURSE và GRAMMAR có trong enum nhưng bản cũ không cho chọn:
 * giữ nguyên; ticket mang hai giá trị đó vẫn hiển thị được (nhãn rơi về mã).
 */
export const TICKET_MODULE_OPTIONS: readonly TicketModuleOption[] = [
  { value: "FLASHCARD", label: "Thẻ ghi nhớ (Flashcard)" },
  { value: "QUIZ", label: "Trắc nghiệm (Quiz)" },
  { value: "AI", label: "AI Practice" },
  { value: "LISTENING_PRACTICE", label: "Luyện nghe" },
  { value: "STORAGE", label: "Kho lưu trữ" },
  { value: "DICTIONARY", label: "Từ điển" },
  { value: "KANJI_ORIGIN", label: "Nguồn gốc Hán tự" },
  { value: "LEARNING_PATH", label: "Lộ trình học" },
  { value: "VIDEO_COURSE", label: "Khóa học Video" },
  { value: "WRITING", label: "Luyện viết" },
  { value: "PRONUNCIATION", label: "Phát âm" },
  { value: "OTHER", label: "Giáo trình (Syllabus)" },
];

export function ticketModuleLabel(module: string | undefined): string {
  if (!module) return "—";
  return TICKET_MODULE_OPTIONS.find((o) => o.value === module)?.label ?? module;
}

/** Hai màn gọi cùng một trạng thái bằng hai bộ chữ (manager = Admin). */
export type TicketScreen = "manager" | "instructor";

export const TICKET_STATUS_LABELS: Readonly<Record<TicketScreen, Readonly<Record<TicketStatus, string>>>> = {
  manager: { OPEN: "Đang mở", DONE: "Chờ duyệt", CLOSE: "Đã đóng" },
  instructor: { OPEN: "Đang thực hiện", DONE: "Đã báo cáo", CLOSE: "Đã đóng" },
};

export const TICKET_STATUS_BADGE: Readonly<Record<TicketStatus, string>> = { OPEN: "bg-primary", DONE: "bg-success", CLOSE: "bg-secondary" };

export const TICKET_STATUSES: readonly TicketStatus[] = ["OPEN", "DONE", "CLOSE"];

export type TicketStatusFilter = "ALL" | TicketStatus;

export interface TicketFilters {
  search: string;
  /** "ALL" hoặc mã module. */
  module: string;
  status: TicketStatusFilter;
  /** Khoảng ngày tạo theo RangePicker (null hoặc hai đầu có thể null như antd trả về). */
  range: [Dayjs | null, Dayjs | null] | null;
}

export const EMPTY_TICKET_FILTERS: TicketFilters = { search: "", module: "ALL", status: "ALL", range: null };

/** Bản cũ khai báo `assignedName` nhưng bảng đọc `assignedFullName`: nhận cả hai để không phụ thuộc backend đặt tên trường nào. */
export function ticketAssigneeName(ticket: TicketResponse): string {
  return ticket.assignedName ?? ticket.assignedFullName ?? "";
}

/** Ticket thuộc người dùng hiện tại (so sánh dạng chuỗi như selectActiveTickets của HSK cũ). */
export function isOwnTicket(ticket: TicketResponse, userId: string | number | undefined): boolean {
  return userId !== undefined && String(ticket.assignedId) === String(userId);
}

/**
 * Lọc như useMemo của hai màn cũ: tìm kiếm không phân biệt hoa/thường (Admin: tên/email/mô tả; giảng viên: chỉ mô tả), module, trạng thái,
 * ngày tạo nằm trong [đầu ngày `from`, cuối ngày `to`] theo giờ trình duyệt. Giữ quirk của bản cũ: ticket không có `createdAt` vẫn qua bộ lọc ngày.
 */
export function filterTickets(tickets: readonly TicketResponse[], filters: TicketFilters, screen: TicketScreen): TicketResponse[] {
  const search = filters.search.trim().toLowerCase();
  const [from, to] = filters.range ?? [null, null];
  const fromMs = from ? from.startOf("day").valueOf() : null;
  const toMs = to ? to.endOf("day").valueOf() : null;
  return tickets.filter((t) => {
    const desc = (t.description ?? "").toLowerCase();
    const matchesSearch =
      !search ||
      desc.includes(search) ||
      (screen === "manager" && (ticketAssigneeName(t).toLowerCase().includes(search) || (t.assignedEmail ?? "").toLowerCase().includes(search)));
    const matchesModule = filters.module === "ALL" || t.module === filters.module;
    const matchesStatus = filters.status === "ALL" || t.status === filters.status;
    let matchesDate = true;
    if (t.createdAt && filters.range) {
      const created = dayjs(t.createdAt).startOf("day").valueOf();
      if (fromMs !== null) matchesDate = created >= fromMs;
      if (toMs !== null) matchesDate = matchesDate && created <= toMs;
    }
    return matchesSearch && matchesModule && matchesStatus && matchesDate;
  });
}

export interface TicketCounts {
  total: number;
  open: number;
  done: number;
  closed: number;
}

/** Bốn thẻ thống kê tính trên danh sách ĐÃ lọc (như bản cũ). */
export function countTicketsByStatus(tickets: readonly TicketResponse[]): TicketCounts {
  return {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "OPEN").length,
    done: tickets.filter((t) => t.status === "DONE").length,
    closed: tickets.filter((t) => t.status === "CLOSE").length,
  };
}

/** Bản cũ: new Date(iso).toLocaleDateString("vi-VN") => DD/MM/YYYY; thiếu => "N/A". */
export function formatTicketDate(iso: string | undefined): string {
  return iso ? dayjs(iso).format("DD/MM/YYYY") : "N/A";
}

/** Nhãn vai trò trong bộ chọn người được giao (getRoleLabel cũ + "Trợ giảng" cho MENTOR vì app mới hỗ trợ vai trò này; còn lại in nguyên mã). */
export function assigneeRoleLabel(role: string): string {
  switch (role) {
    case "ROLE_TEACHER":
      return "Giảng viên";
    case "ROLE_COLLABORATOR":
      return "Cộng tác viên";
    case "ROLE_MENTOR":
      return "Trợ giảng";
    case "ROLE_MANAGER":
      return "Quản lý";
    case "ROLE_ADMIN":
      return "Quản trị viên";
    default:
      return role;
  }
}

export type AssigneeRoleFilter = "ALL" | "ROLE_TEACHER" | "ROLE_COLLABORATOR";

/** Ba chip lọc vai trò trong modal như bản cũ. */
export const ASSIGNEE_ROLE_FILTERS: readonly { id: AssigneeRoleFilter; label: string }[] = [
  { id: "ALL", label: "Tất cả" },
  { id: "ROLE_TEACHER", label: "Giảng viên" },
  { id: "ROLE_COLLABORATOR", label: "CTV" },
];

export function filterAssignees(assignees: readonly TicketAssigneeOptionResponse[], query: string, role: AssigneeRoleFilter): TicketAssigneeOptionResponse[] {
  const q = query.trim().toLowerCase();
  return assignees.filter((a) => {
    const matchesSearch = !q || (a.fullName ?? "").toLowerCase().includes(q) || (a.email ?? "").toLowerCase().includes(q);
    const matchesRole = role === "ALL" || (Array.isArray(a.roles) && a.roles.includes(role));
    return matchesSearch && matchesRole;
  });
}

/** Chọn nhiều (thêm/bỏ) khi tạo; chọn một khi sửa — toggleSelection của bản cũ. */
export function toggleSelection<T>(list: readonly T[], value: T, single: boolean): T[] {
  if (single) return [value];
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export interface TicketFormState {
  description: string;
  modules: TicketModule[];
  assignedIds: string[];
}

export const TICKET_FORM_DEFAULT: TicketFormState = { description: "", modules: ["FLASHCARD"], assignedIds: [] };

export type TicketFormMode = "add" | "edit";

/** Form điền sẵn khi sửa (openEditModal cũ). Ticket không có module (dữ liệu lệch hợp đồng) => chưa chọn module. */
export function ticketToForm(ticket: TicketResponse): TicketFormState {
  return { description: ticket.description ?? "", modules: ticket.module ? [ticket.module] : [], assignedIds: [ticket.assignedId] };
}

/** Thông điệp cảnh báo của bản cũ (khác nhau giữa tạo và sửa); null = hợp lệ. */
export function validateTicketForm(form: TicketFormState, mode: TicketFormMode): string | null {
  const invalid = form.assignedIds.length === 0 || form.modules.length === 0 || !form.description.trim();
  if (!invalid) return null;
  return mode === "add" ? "Vui lòng chọn ít nhất 1 người dùng, 1 module và nhập mô tả" : "Vui lòng điền đầy đủ thông tin";
}

/** Mỗi (người × module) là một ticket riêng, theo thứ tự người rồi module như vòng lặp của bản cũ. */
export function ticketCombinations(form: TicketFormState): TicketCreateRequest[] {
  const out: TicketCreateRequest[] = [];
  for (const assignedId of form.assignedIds) for (const mod of form.modules) out.push({ assignedId, module: mod, description: form.description });
  return out;
}
