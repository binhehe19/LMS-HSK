// DTO ticket "phân công công việc" (core/types/ticket.type.ts của HSK cũ). CHƯA đối chiếu với backend mới (docs/api-requirements/work-tickets.md).
// Toast chào mừng (M3A) và màn Tổng quan chỉ cần id/status/assignedId; các trường còn lại do hai màn phân công (M5 W1-C) dùng nên để TUỲ CHỌN
// để không đổi kiểu đang được lib/tickets/ticket-stats.ts và test của chúng dùng.
export type TicketStatus = "OPEN" | "DONE" | "CLOSE";

/** Module nghiệp vụ được phân công — 14 giá trị của enum TicketModule HSK cũ (giữ nguyên tên để backend đối chiếu). */
export type TicketModule =
  | "FLASHCARD"
  | "QUIZ"
  | "AI"
  | "LISTENING_PRACTICE"
  | "STORAGE"
  | "DICTIONARY"
  | "KANJI_ORIGIN"
  | "LEARNING_PATH"
  | "VIDEO_COURSE"
  | "WRITING"
  | "PRONUNCIATION"
  | "ONLINE_COURSE"
  | "GRAMMAR"
  | "OTHER";

export interface TicketResponse {
  id: string;
  status: TicketStatus;
  assignedId: string;
  description?: string;
  module?: TicketModule;
  /** Tên người được giao. HSK cũ khai báo `assignedName` nhưng bảng đọc `assignedFullName`: nhận cả hai (lib/work-tickets/ticket-model.ts). */
  assignedName?: string;
  assignedFullName?: string;
  assignedEmail?: string;
  createdBy?: string;
  /** ISO-8601 */
  createdAt?: string;
  updatedAt?: string;
}
