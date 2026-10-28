// Cấu hình menu sidebar Giảng viên (ROLE_TEACHER, và ROLE_MENTOR theo HSK cũ). Một nguồn dữ liệu, khai báo tĩnh.
// Thứ tự, nhãn, icon, đích và activePrefix khớp NGUYÊN VĂN kết quả của InstructorSidebar (LMS_Frontend) cho ROLE_TEACHER:
// tests/fixtures/instructor-nav.golden.json được sinh bằng cách chạy lại đúng logic lọc/đổi nhãn/map route của bản cũ
// trên dữ liệu menu cũ (ẩn "Bảng thống kê", "Sao kê", "Quản lý Tài liệu học tập", các mục Học viên/Khóa học trực tuyến/Đăng ký...;
// thêm "Thông báo của tôi" sau "Tổng quan"). Test golden so khớp từng mục.
// ROLE_MENTOR dùng chung menu này vì selectIsTeacher của HSK cũ coi MENTOR là TEACHER (bằng chứng từ code cũ; ngữ nghĩa với Auth
// chung CHƯA xác minh). Teacher-manager và Collaborator KHÔNG có menu ở đây: quyền của họ chưa xác minh (UNKNOWN).
import type { NavItem } from "@/components/management/management-nav";

export function buildInstructorNav(): NavItem[] {
  return [
    {
      header: "TỔNG QUAN",
      title: "Tổng quan",
      icon: "isax isax-home",
      href: "/instructor/welcome",
    },
    {
      title: "Thông báo của tôi",
      icon: "isax isax-notification-bing",
      href: "/instructor/instructor-notifications",
      activePrefix: "/instructor/settings/notifications",
      unreadBadge: true,
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
      header: "CHƯƠNG TRÌNH HỌC",
      title: "Quản lý Giáo trình",
      icon: "isax isax-book-saved",
      href: "/learning-path/syllabus/manage",
    },
    {
      header: "HỌC VIÊN & LỚP HỌC",
      title: "Quản lý lớp học",
      icon: "isax isax-teacher",
      href: "/instructor/list-class",
      activePrefix: "/instructor/list-class",
    },
    {
      header: "KHO TÀI NGUYÊN",
      title: "Quản lý Kho lưu trữ Đa phương tiện",
      icon: "isax isax-video-play",
      href: "/instructor/manage-storage",
      activePrefix: "/instructor/manage-storage",
    },
    {
      title: "Phân công công việc",
      icon: "isax isax-ticket",
      href: "/instructor/instructor-tickets",
    },
  ];
}
