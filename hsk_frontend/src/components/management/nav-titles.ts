import { buildAdminNav } from "@/components/management/admin-nav";
import { buildInstructorNav } from "@/components/management/instructor-nav";

/** Tên mục menu (Admin hoặc Giảng viên) trỏ tới URL này, nếu có. Dùng để đặt tiêu đề cho trang "đang chuyển đổi" và nhãn nút quay về. */
export function findNavTitle(pathname: string): string | null {
  const path = pathname.split("?")[0];
  const item = [...buildAdminNav(""), ...buildInstructorNav()].find((i) => i.href.split("?")[0] === path);
  return item ? item.title.replace(/\s+/g, " ").trim() : null;
}
