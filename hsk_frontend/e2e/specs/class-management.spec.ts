// Màn hình mẫu /admin/class-management (M1/M1.5): tương tác lọc/phân trang, trạng thái dữ liệu, guard với phiên dựng bằng stub.
// Các giá trị kỳ vọng của bước lọc/phân trang lấy từ HSK cũ: ở M1.5 chúng đã được so khớp từng bước với bản cũ (xem docs/TESTING.md), nay đóng băng ở đây.
// Dữ liệu = fixture tĩnh qua stub (MOCK), đồng hồ đóng băng để trạng thái lớp (đang học/sắp khai giảng/đã kết thúc) không trôi theo ngày thật.
import type { Page } from "@playwright/test";
import { adminUserFixture, classesFixture } from "../fixtures/classes";
import { CLASSES, ME, stubApi, stubSession } from "../support/stub";
import { expect, test } from "../support/test";

const ROUTE = "/admin/class-management";
const NOW = new Date("2026-10-23T09:00:00+07:00");
const rowsSel = ".acm-table tbody tr.acm-row";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

const snap = (page: Page) =>
  page.evaluate(() => ({
    rows: document.querySelectorAll(".acm-table tbody tr.acm-row").length,
    empty: !!document.querySelector(".acm-table tbody td[colspan]"),
    footer: document.querySelector(".acm-sticky-footer .small")?.textContent?.trim(),
    active: document.querySelector(".ant-pagination-item-active")?.textContent,
    first: document.querySelector(".acm-table tbody tr.acm-row td:nth-child(2)")?.textContent,
    heading: document.querySelector(".acm-table-card .fw-bold")?.textContent?.trim(),
  }));

test("lọc, tìm kiếm và phân trang cho đúng kết quả của HSK cũ", async ({ page, app }) => {
  await stubSession(page, { user: adminUserFixture, classes: { body: classesFixture } });
  await page.goto(app.url(ROUTE));
  await page.waitForSelector(rowsSel);
  const input = page.locator(".acm-filter-card input");
  const select = page.locator(".acm-filter-card select");
  const steps: [string, () => Promise<unknown>, Record<string, unknown>][] = [
    ["ban đầu", async () => {}, { rows: 10, empty: false, footer: "Tổng 15 lớp", active: "1", first: "HSK2-FX01", heading: "Danh sách lớp học (15)" }],
    ["trang 2", () => page.locator(".ant-pagination-item-2").click(), { rows: 5, empty: false, footer: "Tổng 15 lớp", active: "2", first: "HSK6-FX11", heading: "Danh sách lớp học (15)" }],
    ["tìm hsk3", () => input.fill("hsk3"), { rows: 3, empty: false, footer: "Tổng 3 lớp", active: "1", first: "HSK3-FX02", heading: "Danh sách lớp học (3)" }],
    ["tìm theo giáo viên 'trần'", () => input.fill("trần"), { rows: 4, empty: false, footer: "Tổng 4 lớp", active: "1", first: "HSK2-FX01", heading: "Danh sách lớp học (4)" }],
    ["tìm không có kết quả", () => input.fill("zzzz-khong-co"), { rows: 0, empty: true, footer: "Tổng 0 lớp", heading: "Danh sách lớp học (0)" }],
    [
      "xóa tìm + lọc 'Đang học'",
      async () => {
        await input.fill("");
        await select.selectOption({ index: 1 });
      },
      { rows: 10, empty: false, footer: "Tổng 12 lớp", active: "1", first: "HSK2-FX01", heading: "Danh sách lớp học (12)" },
    ],
    ["lọc 'Sắp khai giảng'", () => select.selectOption({ index: 2 }), { rows: 1, empty: false, footer: "Tổng 1 lớp", active: "1", first: "HSK4-FX09", heading: "Danh sách lớp học (1)" }],
    ["lọc 'Đã kết thúc'", () => select.selectOption({ index: 3 }), { rows: 2, empty: false, footer: "Tổng 2 lớp", active: "1", first: "HSK5-FX10", heading: "Danh sách lớp học (2)" }],
  ];
  for (const [name, act, expected] of steps) {
    await act();
    await expect.poll(() => snap(page), { message: name }).toEqual(expected);
  }
  expect(app.problems).toEqual([]);
});

test("bấm mã lớp đi tới /admin/class-management/students?classId=… (màn học viên của lớp, M5) trong khung quản lý", async ({ page, app }) => {
  await stubSession(page, { user: adminUserFixture, classes: { body: classesFixture } });
  await stubApi(page, /\/api\/quiz\/grading\/admin\/classes\/fx-001\/students$/, () => ({ body: [] })); // màn học viên (nguồn quiz khi /api/lms chưa cấu hình): lớp rỗng
  await page.goto(app.url(ROUTE));
  await page.waitForSelector(".acm-class-link");
  await page.locator(".acm-class-link").first().click();
  await page.waitForURL(/\/admin\/class-management\/students\?classId=fx-001$/);
  await page.waitForSelector('[data-testid^="acs-"]'); // dải thông tin lớp / đang tải / không tìm thấy — đều là trang thật, không phải placeholder
  await expect(page.locator('[data-testid="migration-placeholder"]')).toHaveCount(0);
  // Mục "Quản lý lớp học" vẫn sáng (activePrefix) khi ở trang con.
  expect((await page.textContent(".sidebar-menu a.active"))?.includes("Quản lý lớp học")).toBe(true);
});

test("401 từ /users/me => chuyển Auth /login?redirect=<URL>, KHÔNG gọi API lớp", async ({ page, app }) => {
  const classCalls: string[] = [];
  await stubApi(page, ME, () => ({ status: 401 }));
  await stubApi(page, CLASSES, () => {
    classCalls.push("x");
    return { body: classesFixture };
  });
  await page.goto(app.url(ROUTE));
  await app.waitForLogin();
  expect(new URL(page.url()).searchParams.get("redirect")).toBe(app.url(ROUTE));
  expect(classCalls).toEqual([]);
});

test("không đủ quyền (ROLE_TEACHER ở /admin/*): hiện 'Không có quyền truy cập', không render sidebar/nội dung, không gọi API lớp", async ({ page, app }) => {
  const classCalls: string[] = [];
  await stubSession(page, { user: { ...adminUserFixture, roles: ["ROLE_TEACHER"] } });
  await stubApi(page, CLASSES, () => {
    classCalls.push("x");
    return { body: classesFixture };
  });
  await page.goto(app.url(ROUTE));
  await page.waitForSelector('[data-testid="auth-forbidden"]');
  expect(await page.locator(".acm-hero").count()).toBe(0);
  expect(await page.locator(".management-sidebar-column").count()).toBe(0);
  expect(classCalls).toEqual([]);
});

test("roles [USER, ADMIN] vào được (chỉ cần có ROLE_ADMIN)", async ({ page, app }) => {
  await stubSession(page, { user: { ...adminUserFixture, roles: ["ROLE_USER", "ROLE_ADMIN"] }, classes: { body: classesFixture } });
  await page.goto(app.url(ROUTE));
  await page.waitForSelector(rowsSel);
});

test("Auth mất kết nối => panel lỗi (không vào trang, không đá ra login); bấm 'Thử lại' khi Auth phục hồi => vào trang", async ({ page, app }) => {
  let fail = true;
  await stubSession(page, { user: adminUserFixture, classes: { body: classesFixture } });
  await stubApi(page, ME, () => (fail ? "abort" : { body: adminUserFixture }));
  await page.goto(app.url(ROUTE));
  await page.waitForSelector('[data-testid="auth-error"]');
  expect(await page.locator(".acm-hero").count()).toBe(0);
  expect(page.url()).toBe(app.url(ROUTE));
  fail = false;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await page.waitForSelector(rowsSel);
});

test("Auth trả 500 => panel lỗi, không bypass", async ({ page, app }) => {
  await stubApi(page, ME, () => ({ status: 500 }));
  await page.goto(app.url(ROUTE));
  await page.waitForSelector('[data-testid="auth-error"]');
  expect(await page.locator(".acm-hero").count()).toBe(0);
});

test.describe("trạng thái dữ liệu (không có dữ liệu giả tự động)", () => {
  test("API lớp lỗi 500 => trạng thái lỗi, thẻ thống kê '—'; 'Thử lại' tải được dữ liệu", async ({ page, app }) => {
    let fail = true;
    await stubSession(page, { user: adminUserFixture, classes: () => (fail ? { status: 500 } : { body: classesFixture }) });
    await page.goto(app.url(ROUTE));
    await page.waitForSelector('[data-testid="acm-state-error"]');
    expect(await page.locator(".acm-stat-value").allTextContents()).toEqual(["—", "—", "—", "—"]);
    fail = false;
    await page.getByRole("button", { name: "Thử lại" }).click();
    await page.waitForSelector(rowsSel);
  });

  test("API trả KHÔNG phải mảng => trạng thái lỗi (bản cũ im lặng coi là rỗng)", async ({ page, app }) => {
    await stubSession(page, { user: adminUserFixture, classes: { body: { items: [] } } });
    await page.goto(app.url(ROUTE));
    await page.waitForSelector('[data-testid="acm-state-error"]');
  });

  test("mảng rỗng => trạng thái rỗng của bản cũ", async ({ page, app }) => {
    await stubSession(page, { user: adminUserFixture, classes: { body: [] } });
    await page.goto(app.url(ROUTE));
    await page.waitForSelector(".acm-table tbody td[colspan]");
    await expect(page.locator(".acm-table tbody td[colspan]")).toContainText("Không tìm thấy lớp học phù hợp");
  });

  test("đang tải => Spin antd + thẻ thống kê 0 (như bản cũ)", async ({ page, app }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await stubSession(page, {
      user: adminUserFixture,
      classes: async () => {
        await gate;
        return { body: classesFixture };
      },
    });
    await page.goto(app.url(ROUTE));
    await page.waitForSelector(".ant-spin");
    expect(await page.locator(".acm-stat-value").allTextContents()).toEqual(["0", "0", "0", "0"]);
    release();
    await page.waitForSelector(rowsSel);
  });
});
