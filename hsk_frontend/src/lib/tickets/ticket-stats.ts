// Hàm thuần cho toast chào mừng ticket (logic lấy nguyên từ instructor-/teacher-manager-welcome-notification.tsx cũ).
import type { TicketResponse } from "@/types/ticket";

/** Bản cũ chấp nhận mảng thẳng, Spring Pageable (content), hoặc bọc trong items/data: giữ nguyên để không lệch hợp đồng. */
export function toTicketList(raw: unknown): TicketResponse[] {
  const pick = (value: unknown): unknown => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const data = obj.data as Record<string, unknown> | undefined;
      return obj.items ?? obj.content ?? data?.content ?? obj.data;
    }
    return undefined;
  };
  const list = pick(raw);
  return Array.isArray(list) ? (list as TicketResponse[]) : [];
}

export type TicketToastVariant = "manager" | "instructor";

export interface TicketToastStats {
  /** Số ticket OPEN (manager: "Đang mở"; instructor: "Đang thực hiện"). */
  open: number;
  /** Số ticket DONE (manager: "Đang chờ duyệt"; instructor: "Đã báo cáo"). */
  done: number;
}

/**
 * manager (Admin/Teacher-manager): đếm mọi ticket.
 * instructor: chỉ ticket được giao cho chính người dùng (so sánh dạng chuỗi như bản cũ).
 */
export function computeTicketStats(
  tickets: readonly TicketResponse[],
  variant: TicketToastVariant,
  userId: string | number,
): TicketToastStats {
  const scoped = variant === "instructor" ? tickets.filter((t) => String(t.assignedId) === String(userId)) : tickets;
  return {
    open: scoped.filter((t) => t.status === "OPEN").length,
    done: scoped.filter((t) => t.status === "DONE").length,
  };
}

export function ticketToastMessage(variant: TicketToastVariant, { open, done }: TicketToastStats): string {
  if (variant === "manager") {
    if (open > 0 && done > 0) {
      return "Hệ thống có các đơn phân công mới và đơn chờ bạn duyệt. Hãy quản lý ngay để đảm bảo tiến độ công việc chung.";
    }
    if (open > 0) {
      return "Bạn có các đơn phân công công việc mới cần xử lý ngay. Hãy truy cập để bắt đầu phân cấp và giao việc cho giáo viên.";
    }
    if (done > 0) {
      return "Có đơn công việc đã hoàn thành đang chờ bạn duyệt. Hãy kiểm tra và xác nhận nội dung để đóng các đơn này.";
    }
    return "";
  }
  if (open > 0 && done > 0) {
    return "Bạn có công việc mới cần làm và đơn đã báo cáo chờ duyệt. Hãy truy cập danh sách để kích hoạt quyền thực hiện và theo dõi tiến độ.";
  }
  if (open > 0) {
    return "Bạn có công việc mới cần xử lý! Truy cập danh sách công việc để xem yêu cầu và kích hoạt quyền thực hiện theo yêu cầu từ quản lý.";
  }
  if (done > 0) {
    return "Đơn bạn báo cáo đang chờ quản lý xem xét. Hãy vào danh sách công việc để theo dõi tiến độ và nhận phản hồi kịp thời.";
  }
  return "";
}
