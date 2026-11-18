"use client";

// Port của LMS_Frontend/src/features/instructor/instructor-welcome/instructor-welcome.tsx (cùng DOM, class, style nội tuyến và chữ).
// View thuần: không gọi API, nhận dữ liệu qua props (container: instructor-welcome-page-content.tsx).
//
// Khác bản cũ có chủ đích (như màn lớp học ở M1): khi số liệu KHÔNG có (dịch vụ chưa cấu hình / lỗi) thẻ hiện "—" và có một dòng thông báo,
// thay vì số 0 như đang có dữ liệu thật; khi đang tải vẫn hiện 0 như cũ. Trạng thái có dữ liệu giống hệt bản cũ.
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import { INSTRUCTOR_WELCOME_CSS } from "@/components/management/instructor-welcome/instructor-welcome.styles";
import type { WelcomeTicketsState } from "@/components/management/instructor-welcome/use-instructor-welcome";
import type { UnreadCountState } from "@/components/management/notifications/use-unread-count";

interface InstructorWelcomeViewProps {
  displayName: string;
  displayEmail: string;
  roleLabel: string;
  tickets: WelcomeTicketsState;
  unread: UnreadCountState;
  onOpenTickets: () => void;
  onOpenSettings: () => void;
  onRetry: () => void;
}

const UNAVAILABLE = "—";

export function InstructorWelcomeView({ displayName, displayEmail, roleLabel, tickets, unread, onOpenTickets, onOpenSettings, onRetry }: InstructorWelcomeViewProps) {
  const ticketNumber = (pick: "openTickets" | "doneTickets" | "totalTickets"): number | string =>
    tickets.kind === "loading" ? 0 : tickets.kind === "ok" ? tickets.summary[pick] : UNAVAILABLE;
  const completionRate = tickets.kind === "ok" ? tickets.summary.completionRate : 0;
  const completionText = tickets.kind === "loading" ? "0%" : tickets.kind === "ok" ? `${completionRate}%` : UNAVAILABLE;
  const unreadCount: number | string = unread.status === "loading" ? 0 : (unread.count ?? UNAVAILABLE);
  const noticeKind = tickets.kind === "waiting" || tickets.kind === "error" ? tickets.kind : null;

  const statCards = [
    {
      title: "Công việc đang phụ trách",
      value: ticketNumber("totalTickets"),
      note: "Tất cả yêu cầu được gán cho bạn",
      icon: "isax isax-task-square",
      tint: "rgba(99, 102, 241, 0.12)",
      color: "#6366f1",
    },
    {
      title: "Đang mở",
      value: ticketNumber("openTickets"),
      note: "Cần xử lý trong thời gian tới",
      icon: "isax isax-notification-bing",
      tint: "rgba(245, 158, 11, 0.12)",
      color: "#f59e0b",
    },
    {
      title: "Đã hoàn tất",
      value: ticketNumber("doneTickets"),
      note: "Các yêu cầu đã xử lý xong",
      icon: "isax isax-check",
      tint: "rgba(16, 185, 129, 0.12)",
      color: "#10b981",
    },
    {
      title: "Thông báo chưa đọc",
      value: unreadCount,
      note: "Cập nhật mới từ hệ thống",
      icon: "isax isax-message-notif",
      tint: "rgba(6, 182, 212, 0.12)",
      color: "#06b6d4",
    },
  ];

  return (
    <>
      <style>{INSTRUCTOR_WELCOME_CSS}</style>
      <ManagementPageFrame rowClassName="g-4">
        <div className="welcome-hero-card mb-4">
          <div className="welcome-hero-orb orb-one"></div>
          <div className="welcome-hero-orb orb-two"></div>
          <div className="position-relative p-4 p-lg-5" style={{ zIndex: 1, minHeight: "300px", display: "flex", alignItems: "center" }}>
            <div className="row align-items-center w-100 g-4">
              <div className="col-lg-8 text-white">
                <div className="d-inline-flex align-items-center gap-2 px-3 py-2 rounded-pill mb-3" style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(10px)" }}>
                  <i className="isax isax-home-1"></i>
                  <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.2px" }}>Học Bá - Bật mode Học Bá, cân mọi giao tiếp</span>
                </div>
                <h1 className="mb-3" style={{ fontSize: "clamp(30px, 4vw, 44px)", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.02em", color: "#ffffff" }}>
                  Xin chào, {displayName}!
                </h1>
                <p className="mb-4" style={{ maxWidth: "760px", fontSize: "16px", lineHeight: 1.7, color: "rgba(255,255,255,0.92)" }}>
                  Đây là nơi bạn theo dõi công việc, cập nhật thông báo và đi thẳng tới các mục quan trọng nhất của hệ thống. Giao diện đã được tinh chỉnh để đồng bộ với màu chủ đạo của trang.
                </p>

                <div className="d-flex flex-wrap gap-3 mb-4">
                  <div className="d-flex align-items-center gap-2 px-3 py-2 rounded-3" style={{ background: "rgba(255,255,255,0.18)" }}>
                    <i className="isax isax-message-text-1"></i>
                    <span style={{ fontWeight: 700, color: "#ffffff" }}>{displayEmail || "Chưa có email"}</span>
                  </div>
                  <div className="d-flex align-items-center gap-2 px-3 py-2 rounded-3" style={{ background: "rgba(255,255,255,0.18)" }}>
                    <i className="isax isax-shield-tick"></i>
                    <span style={{ fontWeight: 700, color: "#ffffff" }}>{roleLabel}</span>
                  </div>
                  <div className="d-flex align-items-center gap-2 px-3 py-2 rounded-3" style={{ background: "rgba(255,255,255,0.18)" }}>
                    <i className="isax isax-notification-bing"></i>
                    <span style={{ fontWeight: 700, color: "#ffffff" }}>{unreadCount} thông báo chưa đọc</span>
                  </div>
                </div>

                <div className="d-flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={onOpenTickets}
                    className="btn fw-bold px-4 py-2"
                    style={{ borderRadius: "12px", boxShadow: "0 10px 20px rgba(255,255,255,0.14)", background: "#ffffff", color: "#B00D0E" }}
                  >
                    <i className="isax isax-ticket me-2"></i>
                    Xem công việc
                  </button>
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="btn fw-bold px-4 py-2"
                    style={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.52)", color: "#ffffff", background: "rgba(255,255,255,0.1)" }}
                  >
                    <i className="isax isax-user-edit me-2"></i>
                    Cài đặt hồ sơ
                  </button>
                </div>
              </div>

              <div className="col-lg-4">
                <div className="card border-0 shadow-sm" style={{ borderRadius: "20px", background: "rgba(255, 248, 248, 0.96)" }}>
                  <div className="card-body p-4">
                    <div className="d-flex align-items-center justify-content-between mb-4">
                      <div>
                        <p className="text-uppercase small fw-bold mb-1" style={{ letterSpacing: "0.08em", color: "#B00D0E" }}>Tổng quan hôm nay</p>
                        <h5 className="fw-bold mb-0" style={{ color: "#7f1d1d" }}>Công việc của bạn</h5>
                      </div>
                      <div className="welcome-stat-icon" style={{ background: "rgba(225, 29, 72, 0.12)", color: "#B00D0E" }}>
                        <i className="isax isax-chart-21 fs-4"></i>
                      </div>
                    </div>

                    <div className="d-grid gap-3">
                      <div className="rounded-4 p-3" style={{ background: "linear-gradient(135deg, rgba(176, 13, 14, 0.12), rgba(244, 162, 97, 0.14))" }}>
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <span className="small fw-semibold" style={{ color: "#7f1d1d" }}>Tỷ lệ hoàn tất</span>
                          <span className="fw-bold" style={{ color: "#7f1d1d" }}>{completionText}</span>
                        </div>
                        <div className="progress" style={{ height: "8px", borderRadius: "999px" }}>
                          <div className="progress-bar" role="progressbar" style={{ width: `${completionRate}%`, background: "linear-gradient(90deg, #B00D0E, #E63946)" }}></div>
                        </div>
                      </div>

                      <div className="d-flex align-items-center justify-content-between rounded-4 px-3 py-3" style={{ background: "rgba(225, 29, 72, 0.08)" }}>
                        <span className="fw-semibold" style={{ color: "#7f1d1d" }}>Đã hoàn tất</span>
                        <span className="fw-bold fs-5" style={{ color: "#B00D0E" }}>{ticketNumber("doneTickets")}</span>
                      </div>

                      <div className="d-flex align-items-center justify-content-between rounded-4 px-3 py-3" style={{ background: "rgba(244, 162, 97, 0.12)" }}>
                        <span className="fw-semibold" style={{ color: "#7f1d1d" }}>Đang mở</span>
                        <span className="fw-bold" style={{ color: "#c2410c", fontSize: "20px" }}>{ticketNumber("openTickets")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm" style={{ borderRadius: "20px" }}>
          <div className="card-body p-4 p-lg-5">
            <div className="d-flex align-items-end justify-content-between flex-wrap gap-3 mb-4">
              <div>
                <h4 className="fw-bold mb-1" style={{ color: "#7f1d1d" }}>Thống kê nhanh</h4>
                <p className="mb-0" style={{ color: "#92400e" }}>Các số liệu quan trọng để bạn nắm tình hình ngay từ màn đầu tiên.</p>
              </div>
              <div className="badge rounded-pill px-3 py-2" style={{ background: "rgba(176, 13, 14, 0.1)", color: "#B00D0E", fontWeight: 700 }}>
                <i className="isax isax-chart-2 me-2"></i>
                Cập nhật liên tục
              </div>
            </div>

            {noticeKind && (
              <div className="alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4" role="status" data-testid="welcome-data-notice" data-kind={noticeKind}>
                <span>
                  {tickets.kind === "error"
                    ? tickets.message
                    : "Số liệu công việc chưa được kết nối API (WAITING FOR BACKEND). Các ô hiển thị — nghĩa là chưa có dữ liệu."}
                </span>
                {tickets.kind === "error" && (
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRetry}>
                    Thử lại
                  </button>
                )}
              </div>
            )}

            <div className="row g-3">
              {statCards.map((card) => (
                <div className="col-md-6 col-xl-3" key={card.title}>
                  <div className="welcome-stat-card h-100 p-4">
                    <div className="d-flex align-items-start gap-3">
                      <div className="welcome-stat-icon" style={{ background: card.tint, color: card.color }}>
                        <i className={`${card.icon} fs-3`}></i>
                      </div>
                      <div className="flex-grow-1">
                        <p className="small fw-semibold mb-1" style={{ color: "#7f1d1d" }}>{card.title}</p>
                        <h3 className="fw-bold mb-1" style={{ color: "#B00D0E", letterSpacing: "-0.02em" }}>{card.value}</h3>
                        <p className="small mb-0" style={{ color: "#92400e" }}>{card.note}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ManagementPageFrame>
    </>
  );
}
