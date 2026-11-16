import { describe, expect, it } from "vitest";
import { hasAnyRole, ROLES } from "@/lib/auth/roles";

describe("hasAnyRole (so khớp chính xác, không ánh xạ role)", () => {
  it("cho phép khi có đúng role", () => {
    expect(hasAnyRole(["ROLE_ADMIN"], [ROLES.ADMIN])).toBe(true);
    expect(hasAnyRole(["ROLE_USER", "ROLE_ADMIN"], [ROLES.ADMIN])).toBe(true);
  });

  it("không coi MENTOR là TEACHER và không coi MANAGER là TEACHER_MANAGER", () => {
    expect(hasAnyRole(["ROLE_MENTOR"], [ROLES.TEACHER])).toBe(false);
    expect(hasAnyRole(["ROLE_MANAGER"], [ROLES.TEACHER_MANAGER])).toBe(false);
    expect(hasAnyRole(["ROLE_TEACHER_MANAGER"], [ROLES.ADMIN])).toBe(false);
  });

  it("không tự chuẩn hoá chữ hoa/thường hay tiền tố ROLE_", () => {
    expect(hasAnyRole(["role_admin"], [ROLES.ADMIN])).toBe(false);
    expect(hasAnyRole(["ADMIN"], [ROLES.ADMIN])).toBe(false);
  });

  it("danh sách rỗng/undefined => false", () => {
    expect(hasAnyRole([], [ROLES.ADMIN])).toBe(false);
    expect(hasAnyRole(undefined, [ROLES.ADMIN])).toBe(false);
    expect(hasAnyRole(null, [ROLES.ADMIN])).toBe(false);
  });
});
