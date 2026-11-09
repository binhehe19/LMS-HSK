// Quyền Thêm/Sửa/Xoá nội dung theo TICKET phân công — NGUYÊN VĂN quy tắc của LMS_Frontend/src/core/hooks/use-ticket-access.ts (HSK cũ):
//   1. ADMIN và TEACHER_MANAGER luôn có quyền.
//   2. TEACHER / MENTOR / COLLABORATOR chỉ có quyền khi có ticket OPEN hoặc DONE đúng module, được giao cho chính mình (so sánh chuỗi).
//   3. Vai trò khác: không.
// Publish/Unpublish gói nội dung: chỉ ADMIN và TEACHER_MANAGER (`canPublishControl` của mọi trang manage-*.tsx cũ).
// Lưu ý: ở app mới Teacher-manager/Collaborator chưa được phục vụ (UNKNOWN) nên trên thực tế chỉ ADMIN và TEACHER/MENTOR tới được đây; quy tắc vẫn ghi đủ.
// Hàm thuần; kiểu ticket là cấu trúc tối thiểu để không phụ thuộc DTO của màn Phân công công việc.
import { ROLES, hasAnyRole } from "@/lib/auth/roles";

/** Module phân công (enum TicketModule của HSK cũ, core/utils/enum.ts). */
export type ContentModule =
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

export const CONTENT_MODULE_LABEL: Record<ContentModule, string> = {
  FLASHCARD: "Thẻ ghi nhớ / Từ vựng",
  QUIZ: "Bài tập",
  AI: "Ôn luyện AI",
  LISTENING_PRACTICE: "Luyện nghe",
  STORAGE: "Kho lưu trữ",
  DICTIONARY: "Từ điển",
  KANJI_ORIGIN: "Kanji",
  LEARNING_PATH: "Lộ trình học",
  VIDEO_COURSE: "Khoá học video",
  WRITING: "Luyện viết (Hán tự)",
  PRONUNCIATION: "Luyện phát âm",
  ONLINE_COURSE: "Khoá học trực tuyến",
  GRAMMAR: "Ngữ pháp",
  OTHER: "Giáo trình / khác",
};

export interface ContentAccessTicket {
  status: string;
  assignedId: string | number;
  module?: string;
}

const ALWAYS = [ROLES.ADMIN, ROLES.TEACHER_MANAGER];
const BY_TICKET = [ROLES.TEACHER, ROLES.MENTOR, ROLES.COLLABORATOR];

export function canManageContent(roles: readonly string[] | undefined | null, userId: string | number | undefined | null, tickets: readonly ContentAccessTicket[], module: ContentModule): boolean {
  if (hasAnyRole(roles, ALWAYS)) return true;
  if (!hasAnyRole(roles, BY_TICKET) || userId === undefined || userId === null || userId === "") return false;
  const uid = String(userId);
  return tickets.some((t) => t.module === module && (t.status === "OPEN" || t.status === "DONE") && String(t.assignedId) === uid);
}

export function canPublishContent(roles: readonly string[] | undefined | null): boolean {
  return hasAnyRole(roles, ALWAYS);
}
