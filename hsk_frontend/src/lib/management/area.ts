import { hasAnyRole, ROLES } from "@/lib/auth/roles";

/** Khu vực giao diện quản lý: quyết định sidebar/menu nào được dùng. */
export type ManagementArea = "admin" | "instructor";

/**
 * Chọn khu vực theo role của người dùng, giống InstructorSidebar của HSK cũ (Admin ưu tiên: isAdmin → AdminSidebar).
 * Route dùng chung (vd /grammar/manage) vì thế hiện menu Admin cho Admin và menu Giảng viên cho Teacher/Mentor.
 * Trả về null nếu không có role nào đã được hỗ trợ (không bao giờ ngầm chọn một khu cho role lạ).
 */
export function areaForRoles(roles: readonly string[] | undefined | null): ManagementArea | null {
  if (hasAnyRole(roles, [ROLES.ADMIN])) return "admin";
  if (hasAnyRole(roles, [ROLES.TEACHER, ROLES.MENTOR])) return "instructor";
  return null;
}
