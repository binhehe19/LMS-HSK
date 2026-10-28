import { describe, expect, it } from "vitest";
import { buildAdminNav } from "@/components/management/admin-nav";
import { isNavItemActive } from "@/components/management/management-nav";
import golden from "./fixtures/admin-nav.golden.json";

// Golden được sinh từ code M1 (menu Admin dựng từ dữ liệu menu instructor + bảng map route) TRƯỚC khi refactor.
// Test này chứng minh cấu hình tĩnh mới cho ra đúng từng mục, đúng thứ tự, đúng trạng thái active.
const nav = buildAdminNav(golden.authAdminUsersUrl);

describe("menu sidebar Admin: khớp golden của M1", () => {
  it("cùng số mục", () => {
    expect(nav).toHaveLength(golden.items.length);
  });

  it("mỗi mục khớp header, nhãn, icon, đích và activePrefix theo đúng thứ tự", () => {
    const actual = nav.map((m) => ({
      header: m.header ?? null,
      title: m.title,
      icon: m.icon,
      route: m.href,
      subRoute: null,
      activePrefix: m.activePrefix ?? null,
    }));
    expect(actual).toEqual(golden.items);
  });

  it.each(Object.entries(golden.active))("trạng thái active tại %s khớp golden", (pathname, expected) => {
    const indices = nav.flatMap((m, i) => (isNavItemActive(m, pathname) ? [i] : []));
    expect(indices).toEqual(expected);
  });

  it("'Quản lý người dùng' trỏ ra Authentication_Frontend theo URL truyền vào", () => {
    expect(nav.find((m) => m.title === "Quản lý người dùng")?.href).toBe(golden.authAdminUsersUrl);
    expect(buildAdminNav("").find((m) => m.title === "Quản lý người dùng")?.href).toBe("");
  });

  it("không còn mục dành riêng cho teacher ('Tổng quan') và không có mục trùng nhãn", () => {
    const titles = nav.map((m) => m.title);
    expect(titles).not.toContain("Tổng quan");
    expect(new Set(titles).size).toBe(titles.length);
  });
});
