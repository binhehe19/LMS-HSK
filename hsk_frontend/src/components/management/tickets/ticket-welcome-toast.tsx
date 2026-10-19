"use client";

// Gộp TeacherManagerWelcomeNotification (Admin/Teacher-manager) và InstructorWelcomeNotification (giảng viên) của HSK cũ
// thành một component có hai biến thể; chữ, thứ tự DOM và CSS giữ nguyên. Dữ liệu từ ticket-client (chưa cấu hình => không hiện).
import Link from "next/link";
import { TICKET_WELCOME_TOAST_CSS } from "@/components/management/tickets/ticket-welcome-toast.styles";
import { useTicketWelcomeToast } from "@/components/management/tickets/use-ticket-welcome-toast";
import { ticketToastMessage, type TicketToastVariant } from "@/lib/tickets/ticket-stats";

const VARIANT_TEXT: Record<
  TicketToastVariant,
  { icon: string; openLabel: string; doneLabel: string; linkLabel: string }
> = {
  manager: { icon: "isax-notification-status", openLabel: "Đang mở", doneLabel: "Đang chờ duyệt", linkLabel: "Quản lý ngay" },
  instructor: { icon: "isax-notification-bing", openLabel: "Đang thực hiện", doneLabel: "Đã báo cáo", linkLabel: "Xem danh sách" },
};

export function TicketWelcomeToast({
  variant,
  ticketsHref,
  sessionKeyPrefix,
}: {
  variant: TicketToastVariant;
  ticketsHref: string;
  sessionKeyPrefix: string;
}) {
  const { visible, stats, dismiss } = useTicketWelcomeToast(variant, sessionKeyPrefix);
  if (!visible) return null;
  const text = VARIANT_TEXT[variant];

  return (
    <>
      <style>{TICKET_WELCOME_TOAST_CSS}</style>
      <div className={`ticket-toast-container is-${variant}`} role="status" data-testid="ticket-welcome-toast">
        <div className="ticket-toast-bar">
          <div className="ticket-toast-icon">
            <i className={`isax ${text.icon}`}></i>
          </div>

          <div className="ticket-toast-content">
            <h6 className="ticket-toast-title">Chào mừng bạn trở lại!</h6>
            <p className="ticket-toast-text">{ticketToastMessage(variant, stats)}</p>
            <div className="ticket-toast-footer">
              <div className="ticket-toast-stats">
                {/* Tách nút văn bản giống bản cũ ("Nhãn: " rồi số); gộp thành một chuỗi hay ba nút đều làm chữ lệch vài pixel. */}
                <span className="ticket-toast-stat">
                  {`${text.openLabel}: `}
                  {stats.open}
                </span>
                <span className="ticket-toast-stat done">
                  {`${text.doneLabel}: `}
                  {stats.done}
                </span>
              </div>
              <Link href={ticketsHref} prefetch={false} className="ticket-toast-link" onClick={dismiss}>
                {text.linkLabel} <i className="isax isax-arrow-right-3"></i>
              </Link>
            </div>
          </div>

          <button className="ticket-toast-close" onClick={dismiss} title="Đóng" aria-label="Đóng">
            <i className="fa-solid fa-xmark"></i>
          </button>

          <div className="ticket-toast-progress"></div>
        </div>
      </div>
    </>
  );
}
