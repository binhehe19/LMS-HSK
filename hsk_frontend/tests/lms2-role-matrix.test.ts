import { describe, expect, it } from "vitest";
import { buildAdminNav } from "@/components/management/admin-nav";
import { filterNavItemsForRoles } from "@/components/management/management-nav";
import { resolveHomeDestination } from "@/lib/auth/home-destination";
import { ROLES } from "@/lib/auth/roles";
import { areaForRoles } from "@/lib/management/area";

describe("LMS 2.0 phân quyền theo cụm tính năng", () => {
  describe("areaForRoles", () => {
    it("ADMIN, TRAINING_OPS, RND dùng khung admin; TEACHER, MENTOR dùng khung instructor; USER/GUEST trả về null", () => {
      expect(areaForRoles([ROLES.ADMIN])).toBe("admin");
      expect(areaForRoles([ROLES.TRAINING_OPS])).toBe("admin");
      expect(areaForRoles([ROLES.RND])).toBe("admin");
      expect(areaForRoles([ROLES.TEACHER])).toBe("instructor");
      expect(areaForRoles([ROLES.MENTOR])).toBe("instructor");
      expect(areaForRoles([ROLES.USER])).toBeNull();
      expect(areaForRoles(["ROLE_GUEST"])).toBeNull();
      expect(areaForRoles(undefined)).toBeNull();
    });

    it("ưu tiên admin nếu tài khoản có cả role học viên hoặc giảng viên", () => {
      expect(areaForRoles([ROLES.USER, ROLES.TEACHER, ROLES.TRAINING_OPS])).toBe("admin");
    });
  });

  describe("filterNavItemsForRoles (lọc động sidebar Admin)", () => {
    const fullNav = buildAdminNav("https://accounts.example.com/admin/users");

    it("ROLE_ADMIN thấy toàn bộ menu", () => {
      expect(filterNavItemsForRoles(fullNav, [ROLES.ADMIN])).toHaveLength(fullNav.length);
    });

    it("ROLE_RND chỉ thấy Giáo trình và Hệ thống học liệu (Ngữ pháp, Từ vựng, Bài tập, Tài liệu học tập)", () => {
      const rndNav = filterNavItemsForRoles(fullNav, [ROLES.RND]);
      const titles = rndNav.map((x) => x.title);
      expect(titles).toEqual(["Giáo trình", "Ngữ pháp", "Từ vựng", "Bài tập", "Tài liệu học tập"]);
      expect(rndNav[0].header).toBe("CHƯƠNG TRÌNH HỌC");
      // Mục Chấm bài dưới Bài tập không thuộc quyền RND nên phải bị ẩn
      const quizItem = rndNav.find((x) => x.title === "Bài tập");
      expect(quizItem?.children?.map((c) => c.title)).toEqual(["Học phần bài tập"]);
    });

    it("ROLE_TRAINING_OPS thấy Tổng quan, Lớp học, Giáo trình, Học liệu, Thông báo; không thấy Sao kê và Người dùng", () => {
      const opsNav = filterNavItemsForRoles(fullNav, [ROLES.TRAINING_OPS]);
      const titles = opsNav.map((x) => x.title);
      expect(titles).toContain("Overview");
      expect(titles).toContain("Lớp học");
      expect(titles).toContain("Giáo trình");
      expect(titles).toContain("Thông báo");
      expect(titles).not.toContain("Sao kê");
      expect(titles).not.toContain("Người dùng");
    });
  });

  describe("resolveHomeDestination (tự động điều hướng ở /)", () => {
    it("chưa đăng nhập => null", () => {
      expect(resolveHomeDestination("unauthenticated", [ROLES.ADMIN])).toBeNull();
      expect(resolveHomeDestination("loading", [ROLES.USER])).toBeNull();
    });

    it("chứa role quản trị => vào màn quản trị tương ứng, kể cả khi tài khoản có kèm ROLE_USER", () => {
      expect(resolveHomeDestination("authenticated", [ROLES.USER, ROLES.ADMIN])).toBe("/admin/dashboard");
      expect(resolveHomeDestination("authenticated", [ROLES.USER, ROLES.TRAINING_OPS])).toBe("/admin/dashboard");
      expect(resolveHomeDestination("authenticated", [ROLES.USER, ROLES.RND])).toBe("/vocabulary/manage");
      expect(resolveHomeDestination("authenticated", [ROLES.USER, ROLES.TEACHER])).toBe("/instructor/welcome");
      expect(resolveHomeDestination("authenticated", [ROLES.MENTOR])).toBe("/instructor/welcome");
    });

    it("không chứa role quản trị => về màn học viên (bất kể role gì miễn đã đăng nhập)", () => {
      expect(resolveHomeDestination("authenticated", [ROLES.USER])).toBe("/student/student-dashboard");
      expect(resolveHomeDestination("authenticated", ["ROLE_GUEST"])).toBe("/student/student-dashboard");
      expect(resolveHomeDestination("authenticated", [])).toBe("/student/student-dashboard");
    });
  });
});
