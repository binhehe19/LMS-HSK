import { describe, expect, it } from "vitest";
import { buildInstructorNav } from "@/components/management/instructor-nav";
import { isNavItemActive } from "@/components/management/management-nav";
import golden from "./fixtures/instructor-nav.golden.json";

// Golden được sinh bằng cách chạy lại NGUYÊN logic lọc/đổi nhãn/map route của InstructorSidebar (LMS_Frontend) cho ROLE_TEACHER
// trên dữ liệu menu cũ. Test chứng minh cấu hình tĩnh mới cho ra đúng từng mục, đúng thứ tự, đúng trạng thái active.
const nav = buildInstructorNav();

describe("menu sidebar Giảng viên: khớp golden của HSK cũ", () => {
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

  it("không có mục dành riêng cho Admin và không trùng nhãn", () => {
    const titles = nav.map((m) => m.title);
    for (const adminOnly of ["Overview", "Bảng thống kê", "Sao kê", "Quản lý Giảng viên", "Quản lý người dùng", "Quản lý thông báo", "Phân tích hành vi"]) {
      expect(titles).not.toContain(adminOnly);
    }
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("chỉ 'Thông báo của tôi' có huy hiệu chưa đọc", () => {
    expect(nav.filter((m) => m.unreadBadge).map((m) => m.title)).toEqual(["Thông báo của tôi"]);
  });
});
