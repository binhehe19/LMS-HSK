// Cấu hình menu sidebar Admin (một nguồn dữ liệu, khai báo tĩnh). Gốc khớp NGUYÊN VĂN menu Admin của M1
// (tests/fixtures/admin-nav.golden.json được sinh từ code M1; test golden so khớp từng mục) — đã bỏ theo yêu cầu:
// Phân tích hành vi, Quản lý Giảng viên, Quản lý Thông tin Đăng ký Khóa học Trực tuyến, Quản lý Kho lưu trữ Đa
// phương tiện, Sao kê, Phân công công việc, Quản lý Gói thành viên (golden đã cập nhật theo, các trang/route liên
// quan vẫn giữ nguyên, chỉ ẩn khỏi sidebar).
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
      title: "Thông báo",
      icon: "isax isax-notification-bing",
      href: "/admin/settings/notifications",
      activePrefix: "/admin/settings/notifications",
      unreadBadge: true,
    },
    {
      title: "Lớp học",
      icon: "isax isax-teacher",
      href: "/admin/class-management",
      activePrefix: "/admin/class-management",
    },
    {
      title: "Chấm bài",
      icon: "isax isax-edit-2",
      href: "/instructor/list-class",
      activePrefix: "/instructor/list-class",
    },
    {
      title: "Yêu cầu hỗ trợ",
      icon: "isax isax-ticket",
      href: "/instructor/instructor-support-tickets",
    },
    {
      header: "HỆ THỐNG HỌC LIỆU",
      title: "Luyện viết (Hán tự)",
      icon: "isax isax-pen-add",
      href: "/hanzi/manage",
      activePrefix: "/hanzi",
    },
    {
      title: "Luyện phát âm",
      icon: "isax isax-microphone",
      href: "/pronunciation/manage",
      activePrefix: "/pronunciation",
    },
    {
      title: "Ngữ pháp",
      icon: "isax isax-book",
      href: "/grammar/manage",
      activePrefix: "/grammar",
    },
    {
      title: "Từ vựng",
      icon: "isax isax-book-1",
      href: "/vocab-set/manage",
      activePrefix: "/vocab-set",
    },
    {
      title: "Bài tập",
      icon: "isax isax-document-text",
      href: "/quiz/manage",
      activePrefix: "/quiz",
    },
    {
      title: "Từ điển",
      icon: "isax isax-book-1",
      href: "/vocabulary/manage",
      activePrefix: "/vocabulary",
    },
    {
      title: "Tài liệu học tập",
      icon: "isax isax-document-text",
      href: "/learning-path/lesson-materials/manage",
      activePrefix: "/learning-path/lesson-materials/manage",
    },
    {
      header: "CHƯƠNG TRÌNH HỌC",
      title: "Giáo trình",
      icon: "isax isax-book-saved",
      href: "/learning-path/syllabus/manage",
    },
    {
      header: "QUẢN TRỊ HỆ THỐNG",
      title: "Người dùng",
      icon: "isax isax-profile-2user",
      href: authAdminUsersUrl,
      activePrefix: "/admin/users",
    },
  ];
}
