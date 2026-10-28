// Tên role NGUYÊN VĂN theo HSK cũ (LMS_Frontend/src/core/utils/enum.ts, enum UserRole).
// M1: so khớp chính xác chuỗi role mà Auth trả về. KHÔNG ánh xạ ROLE_MANAGER -> TEACHER_MANAGER,
// KHÔNG coi MENTOR là TEACHER (HSK cũ có làm trong auth-slice.ts; chưa xác minh ngữ nghĩa/quyền thực
// tế với Auth chung nên chưa mang sang — xem docs/AUTH-INTEGRATION.md).
export const ROLES = {
  ADMIN: "ROLE_ADMIN",
  USER: "ROLE_USER",
  TEACHER: "ROLE_TEACHER",
  TEACHER_MANAGER: "ROLE_TEACHER_MANAGER",
  COLLABORATOR: "ROLE_COLLABORATOR",
  MENTOR: "ROLE_MENTOR",
} as const;

/** true nếu user có ít nhất một role nằm trong danh sách cho phép (so khớp chính xác). */
export function hasAnyRole(userRoles: readonly string[] | undefined | null, allowed: readonly string[]): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  return userRoles.some((role) => allowed.includes(role));
}

/**
 * Role mà app MỚI hiện có khung quản lý (layout + sidebar) cho: Admin và Giảng viên (Mentor dùng chung menu Teacher theo HSK cũ).
 * Route chỉ dành cho role ngoài danh sách này (Teacher-manager, Collaborator...) ở trạng thái UNKNOWN và KHÔNG được phục vụ,
 * kể cả khi HSK cũ cho phép: quyền của các role đó với Auth chung chưa xác minh. Mở rộng danh sách này cần bằng chứng + duyệt.
 */
export const MANAGEMENT_SUPPORTED_ROLES: readonly string[] = [ROLES.ADMIN, ROLES.TEACHER, ROLES.MENTOR];
