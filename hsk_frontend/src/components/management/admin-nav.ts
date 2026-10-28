// Cấu hình menu sidebar Admin (một nguồn dữ liệu, khai báo tĩnh). Thứ tự, nhãn, icon, route và activePrefix khớp
// NGUYÊN VĂN menu Admin của M1 (tests/fixtures/admin-nav.golden.json được sinh từ code M1; test golden so khớp từng mục).
// Menu Admin của LMS_Frontend cũ lấy từ dữ liệu menu của instructor rồi lọc/đổi nhãn/map route; ở đây ghi trực tiếp kết quả.
// Sidebar của vai trò khác (instructor/teacher-manager) sẽ có file riêng dùng chung kiểu NavItem trong management-nav.ts.
import type { NavItem } from "@/components/management/management-nav";

/**
 * @param authAdminUsersUrl URL trang quản lý người dùng của Authentication_Frontend (liên kết ngoài, mở tab mới).
 *        Rỗng nếu chưa cấu hình Auth; khi đó mục vẫn hiện nhưng không có đích.
 */
export function buildAdminNav(authAdminUsersUrl: string): NavItem[] {
  return [
    {
      title: "Overview",
      icon: "isax isax-grid-3",
      href: "/admin/dashboard",
    },
    {
      title: "Quản lý thông báo",
      icon: "isax isax-notification-bing",
      href: "/admin/settings/notifications",
      activePrefix: "/admin/settings/notifications",
      unreadBadge: true,
    },
    {
      title: "Phân tích hành vi",
      icon: "isax isax-chart-21",
      href: "/admin/analytics",
      activePrefix: "/admin/analytics",
    },
    {
      title: "Quản lý lớp học",
      icon: "isax isax-teacher",
      href: "/admin/class-management",
      activePrefix: "/admin/class-management",
    },
    {
      title: "Yêu cầu hỗ trợ",
      icon: "isax isax-ticket",
      href: "/instructor/instructor-support-tickets",
    },
    {
      header: "HỆ THỐNG ÔN LUYỆN",
      title: "Quản lý Luyện viết (Hán tự)",
      icon: "isax isax-pen-add",
      href: "/hanzi/manage",
      activePrefix: "/hanzi",
    },
    {
      title: "Quản lý Luyện Phát âm",
      icon: "isax isax-microphone",
      href: "/pronunciation/manage",
      activePrefix: "/pronunciation",
    },
    {
      title: "Quản lý Thẻ ghi nhớ",
      icon: "isax isax-folder-2",
      href: "/flashcard/create-package",
      activePrefix: "/flashcard",
    },
    {
      title: "Quản lý Ngữ pháp",
      icon: "isax isax-book",
      href: "/grammar/manage",
      activePrefix: "/grammar",
    },
    {
      title: "Quản lý Từ vựng",
      icon: "isax isax-book-1",
      href: "/vocab-set/manage",
      activePrefix: "/vocab-set",
    },
    {
      title: "Quản lý Bài tập",
      icon: "isax isax-document-text",
      href: "/quiz/manage",
      activePrefix: "/quiz",
    },
    {
      title: "Quản lý Từ điển",
      icon: "isax isax-book-1",
      href: "/vocabulary/manage",
      activePrefix: "/vocabulary",
    },
    {
      header: "KHÓA HỌC TRỰC TUYẾN",
      title: "Quản lý Khóa học Trực tuyến",
      icon: "isax isax-teacher",
      href: "/learning-path/online-course/manage",
      activePrefix: "/learning-path/online-course/manage",
    },
    {
      title: "Quản lý Tài liệu học tập",
      icon: "isax isax-document-text",
      href: "/learning-path/lesson-materials/manage",
      activePrefix: "/learning-path/lesson-materials/manage",
    },
    {
      header: "CHƯƠNG TRÌNH HỌC",
      title: "Quản lý Giáo trình",
      icon: "isax isax-book-saved",
      href: "/learning-path/syllabus/manage",
    },
    {
      title: "Quản lý Giảng viên",
      icon: "isax isax-profile-2user",
      href: "/admin/teacher-management",
    },
    {
      title: "Quản lý Thông tin \nĐăng ký Khóa học Trực tuyến",
      icon: "isax isax-document-download",
      href: "/learning-path/online-course/leads",
      activePrefix: "/learning-path/online-course/leads",
    },
    {
      header: "KHO TÀI NGUYÊN",
      title: "Quản lý Kho lưu trữ Đa phương tiện",
      icon: "isax isax-video-play",
      href: "/instructor/manage-storage",
      activePrefix: "/instructor/manage-storage",
    },
    {
      header: "KHÁC",
      title: "Sao kê",
      icon: "isax isax-shopping-cart",
      href: "/admin/statements",
    },
    {
      title: "Phân công công việc",
      icon: "isax isax-ticket",
      href: "/admin/tickets",
    },
    {
      header: "QUẢN TRỊ HỆ THỐNG",
      title: "Quản lý Gói thành viên",
      icon: "isax isax-crown",
      href: "/admin/membership-management",
    },
    {
      title: "Quản lý người dùng",
      icon: "isax isax-profile-2user",
      href: authAdminUsersUrl,
      activePrefix: "/admin/users",
    },
  ];
}
