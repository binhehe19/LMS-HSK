"use client";

import { ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";
import { adminPalette } from "./admin-theme";
import { desktopTheme } from "@/theme/brand-tokens";
import type { ReactNode } from "react";
import { useManagementArea } from "@/components/management/management-area-context";
import { ManagementHeader } from "@/components/management/management-header";
import { ManagementSidebar } from "@/components/management/management-sidebar";
import { useUnreadCount } from "@/components/management/notifications/use-unread-count";

/**
 * Khung nội dung của trang quản lý (Admin hoặc Giảng viên), giữ ĐÚNG DOM của trang cũ:
 *   .content[.pageClass] > .container > .row[.rowClass] > (ManagementSidebar = .col-lg-3) + ManagementHeader (thanh đầu trang chung) + .col-lg-9 > nội dung
 * Từ 992px, .row là lưới: sidebar chiếm cả hai hàng bên trái, thanh đầu trang ở hàng trên và nội dung (tự cuộn) ở hàng dưới của cột phải, nên thanh luôn
 * hiện trên đầu và tách khỏi nội dung. Dưới 992px thanh đứng trên cùng (order: -1).
 * Bản cũ nhúng sidebar thẳng vào từng trang (và InstructorSidebar tự chọn AdminSidebar/TeacherManagerSidebar theo role); ở đây
 * gom vào MỘT component, sidebar theo khu vực của layout (ManagementShell). <ProfileCard/> của bản cũ là `() => null`
 * nên không có DOM và không cần port. Một số trang cũ dùng `.row g-4` (khoảng cách cột) thay vì `.row` trơn: truyền qua `rowClassName`.
 */
export function ManagementPageFrame({
  contentClassName,
  rowClassName,
  onNavigate,
  children,
}: {
  contentClassName?: string;
  rowClassName?: string;
  onNavigate?: (href: string) => void;
  children: ReactNode;
}) {
  const area = useManagementArea();
  const isAdmin = area === "admin";
  // Một lần gọi API số chưa đọc cho cả chuông (header) lẫn huy hiệu menu (sidebar).
  const unread = useUnreadCount();
  const frame = (
    <div className={`content${isAdmin ? " management-frame-admin" : ""}${contentClassName ? ` ${contentClassName}` : ""}`} style={isAdmin ? adminPalette : undefined}>
      <div className="container">
        <div className={`row${rowClassName ? ` ${rowClassName}` : ""}`}>
          <ManagementSidebar area={area} unread={unread} onNavigate={onNavigate} />
          <ManagementHeader area={area} unread={unread} onNavigate={onNavigate} />
          <div className="col-lg-9 management-main-column">{children}</div>
        </div>
      </div>
    </div>
  );
  return isAdmin ? <ConfigProvider locale={viVN} theme={desktopTheme}>{frame}</ConfigProvider> : frame;
}
