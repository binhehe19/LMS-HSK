// Kiểu và quy tắc "đang active" dùng chung cho mọi sidebar quản lý (dữ liệu menu của từng vai trò nằm ở file riêng:
// admin-nav.ts, instructor-nav.ts).
export interface NavItem {
  /** Tiêu đề nhóm hiện phía trên mục này. */
  header?: string;
  title: string;
  /** Class icon. */
  icon: string;
  /** Đường dẫn nội bộ, hoặc URL tuyệt đối (liên kết ngoài, mở tab mới). */
  href: string;
  /** Mục cũng sáng khi pathname bắt đầu bằng prefix này (ngoài trường hợp trùng href). */
  activePrefix?: string;
  /** Hiện huy hiệu số thông báo chưa đọc cạnh mục này (bản cũ gắn theo nhãn "Quản lý thông báo"/"Thông báo của tôi"). */
  unreadBadge?: boolean;
  children?: NavItem[];
}

/**
 * Hợp của hai quy tắc cũ: InstructorSidebar (prefix HOẶC trùng href) và AdminSidebar (có prefix thì chỉ xét prefix).
 * Với menu Admin hiện có hai quy tắc cho kết quả giống nhau (test golden kiểm tra từng đường dẫn).
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.activePrefix && pathname.startsWith(item.activePrefix)) return true;
  return pathname === item.href.split("?")[0];
}
