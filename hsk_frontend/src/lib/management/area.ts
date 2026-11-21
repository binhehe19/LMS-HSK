import { hasAnyRole, ROLES } from "@/lib/auth/roles";

/** Khu vực giao diện quản lý: quyết định sidebar/menu nào được dùng. */
export type ManagementArea = "admin" | "instructor";

/**
 * Chọn khu vực theo role của người dùng:
 * - ADMIN, TRAINING_OPS, RND -> khung "admin" (sidebar lọc động theo quyền từng role)
 * - TEACHER, MENTOR -> khung "instructor"
 */
export function areaForRoles(roles: readonly string[] | undefined | null): ManagementArea | null {
  if (hasAnyRole(roles, [ROLES.ADMIN, ROLES.TRAINING_OPS, ROLES.RND])) return "admin";
  if (hasAnyRole(roles, [ROLES.TEACHER, ROLES.MENTOR])) return "instructor";
  return null;
}
