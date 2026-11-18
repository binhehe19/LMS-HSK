"use client";

// Sidebar dùng chung cho khu vực quản lý. Port của LMS_Frontend/src/features/admin/common/admin-sidebar.tsx và
// features/instructor/common/instructor-sidebar.tsx (cùng DOM và class CSS): hai file cũ khác nhau ở menu, phụ đề thương hiệu,
// khóa cuộn, tên mặc định và vài mục thông báo — phần đó nằm ở management-areas.ts, phần còn lại dùng chung.
//
// Chưa làm (ghi ở docs/FEATURE-STATUS.md):
//  - Huy hiệu "VIP" cạnh tên giảng viên: cần cờ isPremium, mà GET /users/me của Auth chung không trả (UNKNOWN).
//  - Sidebar Teacher-manager/Collaborator: quyền chưa xác minh.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, type UIEvent } from "react";
import { MANAGEMENT_AREAS } from "@/components/management/management-areas";
import { isNavItemActive } from "@/components/management/management-nav";
import type { UnreadCountState } from "@/components/management/notifications/use-unread-count";
import { TicketWelcomeToast } from "@/components/management/tickets/ticket-welcome-toast";
import { useAuthFrontendUrl } from "@/components/management/use-auth-frontend-url";
import { useSidebarCollapse } from "@/components/management/use-sidebar-collapse";
import { AssetImage } from "@/components/shared/asset-image";
import type { ManagementArea } from "@/lib/management/area";
import { getNavTargetStatus } from "@/lib/management/route-registry";
import { formatUnreadBadge } from "@/lib/notifications/unread-badge";

// Chuông thông báo, tìm kiếm, nút thu gọn, hồ sơ, cài đặt và đăng xuất nằm ở ManagementHeader; sidebar chỉ còn thương hiệu + menu. `unread` do khung truyền xuống (huy hiệu menu).
export function ManagementSidebar({ area, unread }: { area: ManagementArea; unread: UnreadCountState }) {
  const config = MANAGEMENT_AREAS[area];
  const pathname = usePathname();
  const { collapsed } = useSidebarCollapse();
  const scrollRef = useRef<HTMLDivElement>(null);
  const unreadBadge = formatUnreadBadge(unread.count);

  // Giống buildAuthAdminUsersUrl của bản cũ (redirect param rỗng).
  const authAdminUsersUrl = useAuthFrontendUrl("/admin/users", "");

  const navItems = useMemo(() => config.buildNav(authAdminUsersUrl), [config, authAdminUsersUrl]);

  useEffect(() => {
    const saved = sessionStorage.getItem(config.scrollKey);
    if (saved && scrollRef.current) {
      scrollRef.current.scrollTop = parseInt(saved, 10);
    }
  }, [pathname, config.scrollKey]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    sessionStorage.setItem(config.scrollKey, e.currentTarget.scrollTop.toString());
  };

  return (
    <>
      <TicketWelcomeToast
        variant={config.welcomeToast.variant}
        ticketsHref={config.welcomeToast.ticketsHref}
        sessionKeyPrefix={config.welcomeToast.sessionKeyPrefix}
      />
      <div className={`col-lg-3 management-sidebar-column${collapsed ? " is-collapsed" : ""}`}>
        <div className="settings-sidebar instructor-sidebar-shell mb-lg-0 theiaStickySidebar">
          <div className="sidebar-fixed-top">
            <div className="sidebar-brand mb-2" style={{ position: "relative" }}>
              <span className="sidebar-brand-logo-box">
                <AssetImage src="assets/hocba/hocbadentrang.png" alt="logo" className="sidebar-brand-logo" />
              </span>
              <span className="sidebar-brand-text">
                <span className="brand-title">Học Bá</span>
                <span className="brand-subtitle">{config.brandSubtitle}</span>
              </span>
            </div>
          </div>

          <div className="sidebar-label">
            <h6>Menu chính</h6>
          </div>
          <div className="sidebar-middle" ref={scrollRef} onScroll={handleScroll}>
            <ul className="sidebar-menu mb-2 pb-1">
              {navItems.map((menu, index) => {
                const isExternal = menu.href.startsWith("http://") || menu.href.startsWith("https://");
                const linkProps = {
                  className: `${isNavItemActive(menu, pathname) ? "active" : ""}`,
                  title: collapsed ? menu.title : undefined,
                  "aria-label": collapsed ? menu.title : undefined,
                  // Trạng thái của đích (không ảnh hưởng giao diện): migrated | not-migrated | unknown | out-of-scope | external (| unregistered: test cấm).
                  "data-migration-status": getNavTargetStatus(menu.href).toLowerCase().replace("_", "-"),
                  style: { whiteSpace: "pre-wrap", lineHeight: "1.4" } as const,
                };
                const content = (
                  <div className="d-flex align-items-center w-100 justify-content-between pe-2">
                    <div>
                      <i className={`${menu.icon} me-2`} />
                      <span className="sidebar-menu-text">{menu.title}</span>
                    </div>
                    {menu.unreadBadge && unreadBadge && (
                      <span
                        className="badge rounded-pill"
                        data-testid="menu-unread-badge"
                        style={{
                          background: "linear-gradient(135deg, #FF4667 0%, #392C7D 100%)",
                          fontSize: "10px",
                          minWidth: "20px",
                          padding: "3px 6px",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        }}
                      >
                        {unreadBadge}
                      </span>
                    )}
                  </div>
                );
                return (
                  <Fragment key={index}>
                    {menu.header && (
                      <li className="menu-header-label mt-3 mb-1 px-3">
                        <small
                          className="text-muted fw-bold text-uppercase"
                          style={{ fontSize: "10px", letterSpacing: "0.05em" }}
                        >
                          {menu.header}
                        </small>
                      </li>
                    )}
                    <li>
                      {isExternal ? (
                        <a href={menu.href} target="_blank" rel="noopener noreferrer" {...linkProps}>
                          {content}
                        </a>
                      ) : (
                        <Link href={menu.href || "#"} prefetch={false} {...linkProps}>
                          {content}
                        </Link>
                      )}
                    </li>
                  </Fragment>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
