// Màn "Tổng quan" giảng viên /instructor/welcome (M3B.2): trang thật đầu tiên của Teacher. Dữ liệu = mock (không phải API thật; trạng thái tích hợp: WAITING FOR BACKEND).
import { control } from "../support/mock";
import { expect, test } from "../support/test";

const URL_WELCOME = "/instructor/welcome";
const hero = ".welcome-hero-card";
const notice = '[data-testid="welcome-data-notice"]';
const cardValue = (page: import("@playwright/test").Page, title: string) =>
  page.locator(".welcome-stat-card", { has: page.getByText(title, { exact: true }) }).locator("h3");

test.describe("Teacher và Mentor vào được; nội dung đúng dữ liệu mock", () => {
  for (const role of ["teacher", "mentor"] as const) {
    test(`${role}: lời chào, email, vai trò 'Giảng viên', số công việc của chính mình, tỷ lệ hoàn tất, thông báo chưa đọc`, async ({ page, app }) => {
      await app.signIn(URL_WELCOME, { role });
      await page.waitForSelector(hero);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(`Xin chào, Người dùng giả lập (${role})!`);
      await expect(page.locator(".welcome-hero-card .col-lg-8")).toContainText(`${role}@mock.invalid`);
      await expect(page.locator(".welcome-hero-card .col-lg-8")).toContainText("Giảng viên");
      // mock: t1 OPEN, t3 DONE, t4 CLOSE của người dùng này; t2 OPEN của người khác => tổng 2, mở 1, xong 1, 50%
      await expect(cardValue(page, "Công việc đang phụ trách")).toHaveText("2");
      await expect(cardValue(page, "Đang mở")).toHaveText("1");
      await expect(cardValue(page, "Đã hoàn tất")).toHaveText("1");
      await expect(page.getByText("50%")).toBeVisible();
      await expect(cardValue(page, "Thông báo chưa đọc")).toHaveText("3");
      await expect(page.getByText("3 thông báo chưa đọc")).toBeVisible();
      expect(await page.locator(notice).count()).toBe(0);
      expect(app.problems).toEqual([]);
    });
  }

  test("dùng chung khung/sidebar: một sidebar duy nhất, menu Giảng viên, mục 'Tổng quan' active, hàng cột có g-4; tải lại giữ nguyên, không vòng lặp redirect", async ({ page, app }) => {
    await app.signIn(URL_WELCOME, { role: "teacher" });
    await page.waitForSelector(hero);
    await expect(page.locator(".management-sidebar-column")).toHaveCount(1);
    await expect(page.locator(".brand-subtitle")).toHaveText("LMS · Quản lý");
    await expect(page.locator(".content > .container > .row.g-4")).toHaveCount(1);
    const active = () => page.$$eval(".sidebar-middle .sidebar-menu a.active .sidebar-menu-text", (as) => as.map((a) => (a.textContent ?? "").trim()));
    expect(await active()).toEqual(["Tổng quan"]);
    await page.reload();
    await page.waitForSelector(hero);
    expect(page.url()).toBe(app.url(URL_WELCOME));
    expect(await active()).toEqual(["Tổng quan"]);
    expect(app.loginVisits()).toBe(0);
  });
});

test.describe("quyền: chỉ TEACHER và MENTOR (quyết định giao diện; chưa phải xác nhận từ backend)", () => {
  for (const role of ["admin", "teacher-manager", "collaborator", "manager", "user", "none"] as const) {
    test(`${role} bị chặn, không thấy nội dung, không thấy sidebar`, async ({ page, app }) => {
      await app.signIn(URL_WELCOME, { role });
      await page.waitForSelector('[data-testid="auth-forbidden"]');
      expect(await page.locator(hero).count()).toBe(0);
      expect(await page.locator(".management-sidebar-column").count()).toBe(0);
    });
  }

  test("chưa đăng nhập => chuyển Auth đúng một lần, redirect về đúng URL", async ({ page, app }) => {
    await page.goto(app.url(URL_WELCOME));
    await app.waitForLogin();
    expect(new URL(page.url()).searchParams.get("redirect")).toBe(app.url(URL_WELCOME));
    expect(app.loginVisits()).toBe(1);
  });
});

test.describe("điều hướng từ màn", () => {
  test("'Xem công việc' → /instructor/instructor-tickets (màn phân công công việc, M5; giống URL HSK cũ); 'Cài đặt hồ sơ' → /instructor/instructor-settings (UNKNOWN ⇒ 404)", async ({ page, app }) => {
    await app.signIn(URL_WELCOME, { role: "teacher" });
    await page.waitForSelector(hero);
    await page.getByRole("button", { name: /Xem công việc/ }).click();
    await page.waitForURL(app.url("/instructor/instructor-tickets"));
    await page.waitForSelector(".col-lg-9 .card"); // trang thật trong khung quản lý
    await expect(page.locator('[data-testid="migration-placeholder"]')).toHaveCount(0);
    await page.goBack();
    await page.waitForSelector(hero);
    await page.getByRole("button", { name: /Cài đặt hồ sơ/ }).click();
    await page.waitForURL(app.url("/instructor/instructor-settings"));
    await expect(page.locator(hero)).toHaveCount(0);
    expect((await page.goto(app.url("/instructor/instructor-settings")))?.status()).toBe(404);
  });
});

test.describe("trạng thái dữ liệu", () => {
  test("không có ticket và không có thông báo: số 0 thật, không có dòng thông báo chờ/lỗi", async ({ page, app }) => {
    await control({ tickets: "none", notif: "empty" });
    await app.signIn(URL_WELCOME, { role: "teacher" });
    await page.waitForSelector(hero);
    await expect(cardValue(page, "Công việc đang phụ trách")).toHaveText("0");
    await expect(cardValue(page, "Thông báo chưa đọc")).toHaveText("0");
    await expect(page.getByText("0%")).toBeVisible();
    expect(await page.locator(notice).count()).toBe(0);
  });

  test("API ticket lỗi 500: thông báo lỗi + '—' (không số 0 giả); 'Thử lại' tải lại được khi API phục hồi", async ({ page, app }) => {
    await control({ tickets: "error" });
    await app.signIn(URL_WELCOME, { role: "teacher" });
    await page.waitForSelector(notice);
    await expect(page.locator(notice)).toHaveAttribute("data-kind", "error");
    await expect(cardValue(page, "Đang mở")).toHaveText("—");
    await control({ tickets: "some" });
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(cardValue(page, "Đang mở")).toHaveText("1");
    expect(await page.locator(notice).count()).toBe(0);
  });

  test("API thông báo lỗi: ô thông báo không có số giả ('—'), phần còn lại vẫn dùng được", async ({ page, app }) => {
    await control({ notif: "error" });
    await app.signIn(URL_WELCOME, { role: "teacher" });
    await page.waitForSelector(hero);
    await expect(cardValue(page, "Thông báo chưa đọc")).toHaveText("—");
    await expect(cardValue(page, "Công việc đang phụ trách")).toHaveText("2");
  });
});

test.describe("responsive", () => {
  for (const [name, size] of [["tablet", { width: 820, height: 1180 }], ["mobile", { width: 390, height: 844 }]] as const) {
    test(`${name}: không cuộn ngang; sidebar xếp trên nội dung; thẻ thống kê xếp theo lưới Bootstrap`, async ({ page, app }) => {
      await page.setViewportSize(size);
      await app.signIn(URL_WELCOME, { role: "teacher" });
      await page.waitForSelector(hero);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      const col = (await page.locator(".management-sidebar-column").boundingBox())!;
      const main = (await page.locator(".col-lg-9").boundingBox())!;
      expect(main.y).toBeGreaterThanOrEqual(col.y + col.height - 2);
      const cards = await page.locator(".welcome-stat-card").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
      expect(cards).toHaveLength(4);
      if (name === "mobile") expect(new Set(cards).size).toBe(1); // một cột: bốn thẻ cùng chiều rộng
    });
  }
});
