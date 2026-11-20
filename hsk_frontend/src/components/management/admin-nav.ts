// Cấu hình chung cho sidebar và ô tìm chức năng của Admin.
import type { NavItem } from "@/components/management/management-nav";

/**
 * @param authAdminUsersUrl URL trang quản lý người dùng của Authentication_Frontend (liên kết ngoài, mở tab mới).
 *        Rỗng nếu chưa cấu hình Auth; khi đó mục vẫn hiện nhưng không có đích.
 */
export function buildAdminNav(authAdminUsersUrl: string): NavItem[] {
  return [
    {
      header: "TỔNG QUAN",
      title: "Overview",
      icon: "isax isax-grid-3",
      href: "/admin/dashboard",
    },
    {
      header: "CHƯƠNG TRÌNH HỌC",
      title: "Lớp học",
      icon: "isax isax-teacher",
      href: "/admin/class-management",
      activePrefix: "/admin/class-management",
    },
    {
      title: "Giáo trình",
      icon: "isax isax-book-saved",
      href: "/learning-path/syllabus/manage",
    },
    {
      header: "HỆ THỐNG HỌC LIỆU",
      title: "Ngữ pháp",
      icon: "isax isax-book",
      href: "/grammar/manage",
      activePrefix: "/grammar",
      children: [
        { title: "Học phần ngữ pháp", icon: "isax isax-layer", href: "/grammar/manage" },
        { title: "Kho ngữ pháp", icon: "ti ti-database", href: "/grammar/library" },
      ],
    },
    {
      title: "Từ vựng",
      icon: "isax isax-book-1",
      href: "/vocab-set/manage",
      activePrefix: "/vocab-set",
      children: [
        { title: "Học phần từ vựng", icon: "isax isax-layer", href: "/vocab-set/manage", activePrefix: "/vocab-set" },
        { title: "Từ điển", icon: "ti ti-database", href: "/vocabulary/manage", activePrefix: "/vocabulary" },
        { title: "Luyện phát âm", icon: "isax isax-microphone", href: "/pronunciation/manage", activePrefix: "/pronunciation" },
      ],
    },
    {
      title: "Bài tập",
      icon: "isax isax-document-text",
      href: "/quiz/manage",
      activePrefix: "/quiz",
      children: [
        { title: "Học phần bài tập", icon: "isax isax-layer", href: "/quiz/manage", activePrefix: "/quiz" },
        { title: "Chấm bài", icon: "isax isax-edit-2", href: "/instructor/list-class", activePrefix: "/instructor/list-class" },
      ],
    },
    {
      title: "Tài liệu học tập",
      icon: "isax isax-document-text",
      href: "/learning-path/lesson-materials/manage",
      activePrefix: "/learning-path/lesson-materials/manage",
      children: [
        { title: "Bộ tài liệu", icon: "isax isax-layer", href: "/learning-path/lesson-materials/manage", activePrefix: "/learning-path/lesson-materials/manage" },
      ],
    },
    {
      header: "QUẢN TRỊ HỆ THỐNG",
      title: "Thông báo",
      icon: "isax isax-notification-bing",
      href: "/admin/settings/notifications",
      activePrefix: "/admin/settings/notifications",
      unreadBadge: true,
    },
    {
      title: "Yêu cầu hỗ trợ",
      icon: "isax isax-ticket",
      href: "/instructor/instructor-support-tickets",
    },
    {
      title: "Người dùng",
      icon: "isax isax-profile-2user",
      href: authAdminUsersUrl,
      activePrefix: "/admin/users",
    },
  ];
}
