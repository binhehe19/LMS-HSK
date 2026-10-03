// Khác biệt giữa các khu vực quản lý (Admin / Giảng viên) trong cùng một sidebar. Mọi giá trị lấy NGUYÊN VĂN từ AdminSidebar và
// InstructorSidebar của LMS_Frontend; phần còn lại của sidebar giống hệt nhau nên dùng chung một component.
import { buildAdminNav } from "@/components/management/admin-nav";
import { buildInstructorNav } from "@/components/management/instructor-nav";
import type { NavItem } from "@/components/management/management-nav";
import type { ManagementArea } from "@/lib/management/area";
import type { TicketToastVariant } from "@/lib/tickets/ticket-stats";

export interface ManagementAreaConfig {
  brandSubtitle: string;
  /** Khóa sessionStorage lưu vị trí cuộn của menu (khác nhau theo sidebar cũ). */
  scrollKey: string;
  /** Tên hiện khi chưa có họ tên/email. */
  fallbackDisplayName: string;
  /** Class của tên người dùng ở thẻ hồ sơ (sidebar giảng viên cũ có thêm d-flex để chứa huy hiệu VIP). */
  profileNameClass: string;
  /** Danh sách thông báo đầy đủ (đích của "Xem tất cả thông báo"). */
  notificationListHref: string;
  welcomeToast: { variant: TicketToastVariant; ticketsHref: string; sessionKeyPrefix: string };
  buildNav: (authAdminUsersUrl: string) => NavItem[];
}

export const MANAGEMENT_AREAS: Record<ManagementArea, ManagementAreaConfig> = {
  admin: {
    brandSubtitle: "LMS · Admin",
    scrollKey: "admin-sidebar-scroll",
    fallbackDisplayName: "Admin",
    profileNameClass: "sbp-name",
    notificationListHref: "/admin/settings/notifications",
    welcomeToast: { variant: "manager", ticketsHref: "/admin/tickets", sessionKeyPrefix: "tm_notified_" },
    buildNav: buildAdminNav,
  },
  instructor: {
    brandSubtitle: "LMS · Quản lý",
    scrollKey: "instructor-sidebar-scroll",
    fallbackDisplayName: "Giảng viên",
    profileNameClass: "sbp-name d-flex align-items-center",
    notificationListHref: "/instructor/instructor-notifications",
    welcomeToast: { variant: "instructor", ticketsHref: "/instructor/instructor-tickets", sessionKeyPrefix: "instructor_notified_" },
    buildNav: () => buildInstructorNav(),
  },
};
