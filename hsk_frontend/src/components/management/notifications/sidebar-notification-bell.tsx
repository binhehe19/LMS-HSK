"use client";

// Port của core/common/sidebar/sidebar-notification-bell.tsx (cùng DOM và class CSS; CSS nội tuyến lấy nguyên văn).
// Khác bản cũ:
//  - Dropdown điều khiển bằng state React (đóng khi bấm ra ngoài/Escape/chọn mục) thay vì data-bs-toggle, vì app mới chưa nạp
//    JavaScript của Bootstrap. Vị trí do CHÍNH Popper (cùng phiên bản 2.11.8, cùng cấu hình mà Dropdown của Bootstrap 5.3 dùng:
//    bottom-end, offset [0,2], preventOverflow theo clippingParents) tính, nên dropdown rơi đúng chỗ như bản cũ — kể cả bị đẩy
//    vào trong khung nhìn ở màn hình hẹp. Lớp CSS giữ nguyên (.dropdown-menu.show).
//  - Số chưa đọc đến từ useUnreadCount của sidebar (không gọi API hai lần như bản cũ).
//  - Chưa cấu hình dịch vụ thông báo => trạng thái "chờ backend" trong dropdown, không có số/thông báo giả.
//  - KHÔNG port việc phát sự kiện "exercise-graded" khi có thông báo EXERCISE_GRADED: nó cấp dữ liệu cho màn học viên/chấm bài
//    chưa chuyển (ghi nhận ở docs/FEATURE-STATUS.md).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPopper } from "@popperjs/core";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SIDEBAR_NOTIFICATION_BELL_CSS } from "@/components/management/notifications/sidebar-notification-bell.styles";
import { useNotificationList } from "@/components/management/notifications/use-notification-list";
import type { UnreadCountState } from "@/components/management/notifications/use-unread-count";
import { resolveNotificationTarget } from "@/lib/notifications/notification-target";
import { formatRelativeTime } from "@/lib/notifications/relative-time";
import { formatUnreadBadge } from "@/lib/notifications/unread-badge";
import type { NotificationResponse } from "@/types/notification";

export function SidebarNotificationBell({ unread, listHref }: { unread: UnreadCountState; listHref: string }) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { status, items, load, markRead, markAllRead } = useNotificationList();

  const unreadCount = unread.count ?? 0;
  const hasUnread = unreadCount > 0;
  const badge = formatUnreadBadge(unread.count);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !toggleRef.current || !menuRef.current) return;
    const popper = createPopper(toggleRef.current, menuRef.current, {
      placement: "bottom-end",
      modifiers: [
        { name: "preventOverflow", options: { boundary: "clippingParents" } },
        { name: "offset", options: { offset: [0, 2] } },
      ],
    });
    return () => popper.destroy();
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void load(); // như bản cũ: mỗi lần mở lại lấy danh sách mới
  };

  const onToggleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  };

  const handleItemClick = async (noti: NotificationResponse) => {
    setOpen(false);
    if (!noti.read) await markRead(noti.id); // lỗi markRead không chặn điều hướng (như bản cũ)
    router.push(resolveNotificationTarget(noti.payload, listHref));
  };

  return (
    <div className="sidebar-notification-wrapper dropdown" ref={wrapperRef}>
      <style>{SIDEBAR_NOTIFICATION_BELL_CSS}</style>

      <div
        className="notification-bell-btn"
        role="button"
        tabIndex={0}
        aria-label="Thông báo"
        aria-haspopup="true"
        aria-expanded={open}
        ref={toggleRef}
        data-testid="notification-bell"
        data-unread-status={unread.status}
        onClick={toggle}
        onKeyDown={onToggleKey}
      >
        <i className={`isax isax-notification-bing ${hasUnread ? "bell-ring" : ""}`} />
        {badge && <span className="noti-badge">{badge}</span>}
      </div>

      <div
        className={`dropdown-menu dropdown-menu-end sb-noti-dropdown${open ? " show" : ""}`}
        ref={menuRef}
        data-testid="notification-dropdown"
      >
        <div className="sb-noti-header d-flex justify-content-between align-items-center">
          <div>
            <h6 className="sb-noti-title">Thông báo</h6>
            {hasUnread && (
              <span className="badge rounded-pill bg-danger" style={{ fontSize: "10px" }}>
                {unreadCount} mới
              </span>
            )}
          </div>
          <span className="sb-mark-read-all" role="button" tabIndex={0} onClick={() => void markAllRead()}>
            Đọc tất cả
          </span>
        </div>

        <div className="sb-noti-list">
          {status === "loading" ? (
            <div className="p-4 text-center">
              <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
            </div>
          ) : status === "waiting" ? (
            <div className="p-4 text-center text-muted" data-testid="notification-waiting">
              <i className="isax isax-notification-bing fs-1 mb-2"></i>
              <p className="m-0 fs-13">Thông báo chưa được tích hợp (đang chờ backend).</p>
            </div>
          ) : status === "error" ? (
            <div className="p-4 text-center text-muted" data-testid="notification-error">
              <i className="isax isax-notification-bing fs-1 mb-2"></i>
              <p className="m-0 fs-13">Không tải được thông báo. Vui lòng thử lại.</p>
            </div>
          ) : items.length > 0 ? (
            items.map((noti) => (
              <div
                key={noti.id}
                className={`sb-noti-item dropdown-item ${!noti.read ? "unread" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => void handleItemClick(noti)}
              >
                <div className={`sb-noti-icon ${!noti.read ? "unread" : ""}`}>
                  <i className="isax isax-notification-status5 fs-16"></i>
                </div>
                <div className="sb-noti-content">
                  <div className="sb-noti-item-title">{noti.title}</div>
                  <div className="sb-noti-msg">{noti.message}</div>
                  <div className="sb-noti-time">{formatRelativeTime(noti.createdAt)}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-muted">
              <i className="isax isax-notification-bing fs-1 mb-2"></i>
              <p className="m-0 fs-13">Không có thông báo nào</p>
            </div>
          )}
        </div>

        <div className="sb-noti-footer">
          <Link href={listHref} prefetch={false} className="sb-noti-all-btn" onClick={() => setOpen(false)}>
            Xem tất cả thông báo
          </Link>
        </div>
      </div>
    </div>
  );
}
