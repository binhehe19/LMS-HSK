"use client";

// Thanh đầu trang chung của khu vực quản lý (hàng trên của cột phải trong ManagementPageFrame, tách khỏi vùng nội dung nên luôn hiện): bên trái nút thu gọn/mở rộng
// sidebar và ô tìm kiếm chức năng, bên phải chuông thông báo và thẻ tài khoản; bấm thẻ tài khoản mở menu có "Cài đặt" và "Đăng xuất". Trước đây các mục này nằm ở sidebar.
// Số chưa đọc do khung truyền xuống để chuông và huy hiệu menu dùng chung một lần gọi API.
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { MANAGEMENT_AREAS } from "@/components/management/management-areas";
import { ManagementHeaderSearch } from "@/components/management/management-header-search";
import { SidebarNotificationBell } from "@/components/management/notifications/sidebar-notification-bell";
import type { UnreadCountState } from "@/components/management/notifications/use-unread-count";
import { useAuthFrontendUrl } from "@/components/management/use-auth-frontend-url";
import { useSidebarCollapse } from "@/components/management/use-sidebar-collapse";
import { AssetImage } from "@/components/shared/asset-image";
import { redirectToSignOut } from "@/lib/auth/auth-redirect";
import type { ManagementArea } from "@/lib/management/area";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { signout } from "@/redux/slices/auth-slice";

export function ManagementHeader({ area, unread }: { area: ManagementArea; unread: UnreadCountState }) {
  const config = MANAGEMENT_AREAS[area];
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const accountRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { collapsed, toggle } = useSidebarCollapse();

  // Giống buildAuthAccountProfileUrl của bản cũ (redirect param rỗng).
  const authAccountProfileUrl = useAuthFrontendUrl("/account/profile", "#");
  // Ô tìm kiếm lọc đúng các mục menu của khu vực (cùng nguồn với sidebar).
  const authAdminUsersUrl = useAuthFrontendUrl("/admin/users", "");
  const navItems = useMemo(() => config.buildNav(authAdminUsersUrl), [config, authAdminUsersUrl]);
  const toggleLabel = collapsed ? "Mở rộng menu" : "Thu gọn menu";
  const displayName = user?.fullName || user?.email || config.fallbackDisplayName;
  const displayEmail = user?.email || "";

  // Đóng menu khi bấm ra ngoài hoặc nhấn Escape (như dropdown của chuông).
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setMenuOpen(false);
    dispatch(signout());
    redirectToSignOut();
  };

  return (
    <header className="management-header" aria-label="Thanh đầu trang">
      <div className="management-header-start">
        <button type="button" className="management-header-toggle" onClick={toggle} aria-label={toggleLabel} aria-expanded={!collapsed} title={toggleLabel}>
          <i className={`ti ti-${collapsed ? "layout-sidebar-left-expand" : "layout-sidebar-left-collapse"}`} aria-hidden="true" />
        </button>

        <ManagementHeaderSearch items={navItems} />
      </div>

      <div className="management-header-actions">
        <SidebarNotificationBell unread={unread} listHref={config.notificationListHref} />

        <div className="management-header-account" ref={accountRef}>
          <button
            type="button"
            className="management-header-profile"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Tài khoản"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="avatar avatar-md avatar-rounded flex-shrink-0 position-relative">
              {user?.avatarUrl ? (
                <AssetImage src={user.avatarUrl} alt="avatar" />
              ) : (
                <AssetImage
                  src="assets/hocba/hocba2co.png"
                  alt="avatar"
                  style={{ objectFit: "contain", padding: "5px", background: "rgba(255, 255, 255, 0.6)", border: "1px solid rgba(255, 255, 255, 0.8)" }}
                />
              )}
              <span className="verify-tick">
                <i className="isax isax-verify5" />
              </span>
            </span>
            <span className="management-header-profile-info">
              <span className={config.profileNameClass}>{displayName}</span>
              {displayEmail && <span className="sbp-email">{displayEmail}</span>}
            </span>
            <i className="isax isax-arrow-down-1 management-header-caret" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div className="management-header-menu" role="menu">
              <a href={authAccountProfileUrl} target="_blank" rel="noopener noreferrer" role="menuitem" onClick={() => setMenuOpen(false)}>
                <i className="isax isax-setting-25" aria-hidden="true" />
                <span>Cài đặt</span>
              </a>
              {/* "/login" là trang của Authentication_Frontend (miền khác), không phải route của app này; handler chặn điều hướng mặc định,
                  gọi logout rồi chuyển sang Auth. Giữ href như HSK cũ. Quy tắc Next khớp nhầm "/login" với route động [...slug]. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/login" role="menuitem" onClick={handleLogout}>
                <i className="isax isax-logout5" aria-hidden="true" />
                <span>Đăng xuất</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
