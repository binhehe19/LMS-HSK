// Tên role theo bộ RoleName mới của hệ thống Authentication 2.0 (base.co.common.security.RoleName),
// giữ lại khóa tương thích nếu cần đọc dữ kiện route cũ.
export const ROLES = {
  ADMIN: "ROLE_ADMIN",
  USER: "ROLE_USER",
  TEACHER: "ROLE_TEACHER",
  MENTOR: "ROLE_MENTOR",
  RND: "ROLE_RND",
  TRAINING_OPS: "ROLE_TRAINING_OPS",
  TEACHER_MANAGER: "ROLE_TEACHER_MANAGER",
  COLLABORATOR: "ROLE_COLLABORATOR",
} as const;

/** true nếu user có ít nhất một role nằm trong danh sách cho phép (so khớp chính xác). */
export function hasAnyRole(userRoles: readonly string[] | undefined | null, allowed: readonly string[]): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  return userRoles.some((role) => allowed.includes(role));
}

/**
 * Các role quản trị / chuyên môn được hỗ trợ vào khung quản lý của LMS 2.0.
 */
export const MANAGEMENT_SUPPORTED_ROLES: readonly string[] = [
  ROLES.ADMIN,
  ROLES.TRAINING_OPS,
  ROLES.RND,
  ROLES.TEACHER,
  ROLES.MENTOR,
];
