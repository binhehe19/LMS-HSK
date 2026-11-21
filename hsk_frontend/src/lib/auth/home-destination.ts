import { hasAnyRole, ROLES } from "@/lib/auth/roles";

/**
 * Xác định trang mặc định khi người dùng truy cập `/`:
 * - Chứa role quản trị: điều hướng vào khu quản trị tương ứng.
 * - Còn lại (mọi tài khoản đã đăng nhập): về màn học viên.
 */
export function resolveHomeDestination(status: string, roles: readonly string[] | undefined): string | null {
  if (status !== "authenticated") return null;
  if (hasAnyRole(roles, [ROLES.ADMIN, ROLES.TRAINING_OPS])) return "/admin/dashboard";
  if (hasAnyRole(roles, [ROLES.RND])) return "/vocabulary/manage";
  if (hasAnyRole(roles, [ROLES.TEACHER, ROLES.MENTOR])) return "/instructor/welcome";
  return "/student/student-dashboard";
}
