// Khung quản lý (layout, sidebar, menu theo role, thu gọn, responsive, đăng xuất). Port từ kịch bản m3a-browser.mjs (M3A), MOCK.
import { ROLES, mockState } from "../support/mock";
import { expect, test } from "../support/test";

const ADMIN = "/admin/class-management";
const INS = "/instructor/list-class"; // khung Giảng viên đo trên màn Quản lý lớp học (trang thật; từ M5 mọi mục menu Giảng viên đều đã chuyển nên không còn placeholder có mục menu active)

test("Admin: 22 mục menu (không mục nào bị ẩn vì chưa chuyển), 'Quản lý lớp học' active, phụ đề 'LMS · Admin', không hydration warning", async ({ page, app }) => {
  await app.signIn(ADMIN);
  await app.waitForSidebar();
  const titles = await app.menuTitles();
  expect(titles).toHaveLength(22);
  expect(await page.textContent(".sidebar-menu a.active")).toContain("Quản lý lớp học");
  expect(await page.textContent(".brand-subtitle")).toBe("LMS · Admin");
  expect(titles).not.toContain("Thông báo của tôi");
  expect(app.problems).toEqual([]);
});

for (const role of ["teacher", "mentor"] as const) {
  test(`${role}: sidebar Giảng viên 14 mục, phụ đề 'LMS · Quản lý', 'Quản lý lớp học' active, không có mục Admin`, async ({ page, app }) => {
    await app.signIn(INS, { role });
    await app.waitForSidebar();
    const titles = await app.menuTitles();
    expect(titles).toHaveLength(14);
    expect(await page.textContent(".brand-subtitle")).toBe("LMS · Quản lý");
    expect(titles).not.toContain("Quản lý người dùng");
    expect(await page.textContent(".sidebar-menu a.active")).toContain("Quản lý lớp học");
    expect(app.problems).toEqual([]);
  });
}

test.describe("role không được hỗ trợ: bị chặn ở cả /admin và /instructor, KHÔNG render sidebar (không lộ menu)", () => {
  for (const role of ROLES.filter((r) => !["admin", "teacher", "mentor"].includes(r))) {
    test(role, async ({ page, app }) => {
      await app.signIn(ADMIN, { role });
      await page.waitForSelector('[data-testid="auth-forbidden"]');
      expect(await page.locator(".management-sidebar-column").count()).toBe(0);
      await page.goto(app.url(INS));
      await page.waitForSelector('[data-testid="auth-forbidden"]');
      expect(await page.locator(".management-sidebar-column").count()).toBe(0);
    });
  }
});

test("Admin KHÔNG vào được khu Giảng viên; Teacher KHÔNG vào được khu Admin (không mở rộng quyền)", async ({ page, app }) => {
  await app.signIn(ADMIN);
  await app.waitForSidebar();
  await page.goto(app.url(INS));
  await page.waitForSelector('[data-testid="auth-forbidden"]');
  expect(await page.locator(".management-sidebar-column").count()).toBe(0);
});

test("Teacher KHÔNG vào được /admin/class-management", async ({ page, app }) => {
  await app.signIn(INS, { role: "teacher" });
  await app.waitForSidebar();
  await page.goto(app.url(ADMIN));
  await page.waitForSelector('[data-testid="auth-forbidden"]');
  expect(await page.locator(".management-sidebar-column").count()).toBe(0);
});

test("thu gọn: cột sidebar hẹp lại (desktop), giữ sau tải lại (localStorage), mở rộng lại được", async ({ page, app }) => {
  await app.signIn(ADMIN);
  await app.waitForSidebar();
  const w0 = (await page.locator(".management-sidebar-column").boundingBox())!.width;
  await page.click(".sidebar-collapse-button");
  const w1 = (await page.locator(".management-sidebar-column").boundingBox())!.width;
  expect(w1).toBeLessThan(w0 / 2);
  expect(await page.evaluate(() => localStorage.getItem("management-sidebar-collapsed"))).toBe("true");
  await page.reload();
  await app.waitForSidebar();
  await expect(page.locator(".management-sidebar-column.is-collapsed")).toHaveCount(1);
  // Thu gọn: mỗi mục có title/aria-label để vẫn biết mục là gì.
  await expect(page.getByRole("link", { name: "Quản lý lớp học" })).toHaveAttribute("title", "Quản lý lớp học");
  await page.click(".sidebar-collapse-button");
  await expect(page.locator(".management-sidebar-column.is-collapsed")).toHaveCount(0);
  expect(app.problems).toEqual([]);
});

for (const [name, size] of [["tablet", { width: 820, height: 1180 }], ["mobile", { width: 390, height: 844 }]] as const) {
  test(`${name}: sidebar xếp trên nội dung, không cuộn ngang, nút thu gọn ẩn`, async ({ page, app }) => {
    await page.setViewportSize(size);
    await app.signIn(ADMIN);
    await app.waitForSidebar();
    const col = (await page.locator(".management-sidebar-column").boundingBox())!;
    const main = (await page.locator(".col-lg-9").boundingBox())!;
    expect(main.y).toBeGreaterThanOrEqual(col.y + col.height - 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(await page.locator(".sidebar-collapse-button").isVisible()).toBe(false);
  });
}

test("cuộn menu được lưu theo khóa riêng từng khu (admin-sidebar-scroll / instructor-sidebar-scroll)", async ({ page, app }) => {
  await page.setViewportSize({ width: 1440, height: 500 });
  await app.signIn(ADMIN);
  await app.waitForSidebar();
  await page.evaluate(() => {
    document.querySelector(".sidebar-middle")!.scrollTop = 150;
  });
  await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage))).toContain("admin-sidebar-scroll");
});

for (const [label, path, role] of [["Admin", ADMIN, "admin"], ["Giảng viên", INS, "teacher"]] as const) {
  test(`đăng xuất từ sidebar (${label}): POST /logout, phiên server bị thu hồi, về Auth /login KHÔNG kèm redirect; vào lại phải đăng nhập`, async ({ page, app }) => {
    await app.signIn(path, { role });
    await app.waitForSidebar();
    await page.getByRole("link", { name: "Đăng xuất" }).click();
    await app.waitForLogin();
    expect(new URL(page.url()).searchParams.has("redirect")).toBe(false);
    expect((await mockState()).counters.logout).toBe(1);
    await page.goto(app.url(path));
    await app.waitForLogin();
    expect(new URL(page.url()).searchParams.get("redirect")).toBe(app.url(path));
  });
}
