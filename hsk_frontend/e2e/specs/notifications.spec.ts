// Chuông thông báo, huy hiệu chưa đọc, toast ticket (UI COMPLETE; API WAITING FOR BACKEND — ở đây kiểm thử với MOCK). Port từ m3a-browser.mjs.
import { control, mockState } from "../support/mock";
import { expect, test } from "../support/test";

const ADMIN = "/admin/class-management";
const INS = "/instructor/list-class"; // màn Quản lý lớp học của Giảng viên (trang thật; chỉ cần một trang trong khung Giảng viên để đo chuông/toast)
const bell = '[data-testid="notification-bell"]';

test.describe("chuông + huy hiệu", () => {
  test("Admin: huy hiệu = số chưa đọc của mock (3) ở chuông và ở 'Quản lý thông báo'; dropdown mở trong khung nhìn; Escape / bấm ngoài / Enter", async ({ page, app }) => {
    await app.signIn(ADMIN);
    await page.waitForSelector(".noti-badge");
    expect(await page.textContent(".noti-badge")).toBe("3");
    expect(await page.locator('[data-testid="menu-unread-badge"]').textContent()).toBe("3");
    await page.click(bell);
    await page.waitForSelector(".sb-noti-item");
    await expect(page.locator(".sb-noti-item")).toHaveCount(4);
    await expect(page.locator(".sb-noti-dropdown.show")).toHaveCount(1);
    const box = (await page.locator(".sb-noti-dropdown").boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1440);
    await page.keyboard.press("Escape");
    await expect(page.locator(".sb-noti-dropdown.show")).toHaveCount(0);
    await page.click(bell);
    await page.waitForSelector(".sb-noti-item");
    await page.mouse.click(900, 600);
    await expect(page.locator(".sb-noti-dropdown.show")).toHaveCount(0);
    await page.focus(bell);
    await page.keyboard.press("Enter");
    await expect(page.locator(".sb-noti-dropdown.show")).toHaveCount(1);
  });

  test("bấm thông báo: POST đọc 1 lần, huy hiệu 3→2, điều hướng tới targetUrl nội bộ; 'Đọc tất cả' xóa huy hiệu", async ({ page, app }) => {
    await app.signIn(ADMIN);
    await page.waitForSelector(".noti-badge");
    await page.click(bell);
    await page.waitForSelector(".sb-noti-item");
    await page.locator(".sb-noti-item").first().click();
    await expect(page.locator(".noti-badge")).toHaveText("2");
    expect((await mockState()).counters.notifRead).toBe(1);
    expect(page.url()).toBe(app.url(ADMIN));
    await page.click(bell);
    await page.waitForSelector(".sb-noti-item");
    await page.getByText("Đọc tất cả").click();
    await expect(page.locator(".noti-badge")).toHaveCount(0);
    await expect(page.locator('[data-testid="menu-unread-badge"]')).toHaveCount(0);
  });

  test("số > 99 hiện '99+'", async ({ page, app }) => {
    await control({ unread: 150 });
    await app.signIn(ADMIN);
    await page.waitForSelector(".noti-badge");
    expect(await page.textContent(".noti-badge")).toBe("99+");
  });

  test("Giảng viên: huy hiệu ở 'Thông báo của tôi'", async ({ page, app }) => {
    await app.signIn(INS, { role: "teacher" });
    await page.waitForSelector(".noti-badge");
    await expect(page.locator('.sidebar-middle a:has-text("Thông báo của tôi") [data-testid="menu-unread-badge"]')).toHaveText("3");
  });

  test("API lỗi 500: không huy hiệu giả, trang vẫn dùng được, dropdown báo lỗi (không phải 'chưa tích hợp')", async ({ page, app }) => {
    await control({ notif: "error" });
    await app.signIn(ADMIN);
    await app.waitForSidebar();
    await expect(page.locator(bell)).toHaveAttribute("data-unread-status", "error");
    expect(await page.locator(".noti-badge").count()).toBe(0);
    expect(await app.menuTitles()).toHaveLength(22);
    await page.click(bell);
    await page.waitForSelector('[data-testid="notification-error"]');
    expect(await page.locator('[data-testid="notification-waiting"]').count()).toBe(0);
  });

  test("không có thông báo: dropdown trạng thái rỗng, không huy hiệu", async ({ page, app }) => {
    await control({ notif: "empty" });
    await app.signIn(ADMIN);
    await app.waitForSidebar();
    await page.click(bell);
    await page.waitForSelector("text=Không có thông báo nào");
    expect(await page.locator(".noti-badge").count()).toBe(0);
  });

  test("danh sách chậm: hiện spinner đang tải rồi hiện dữ liệu", async ({ page, app }) => {
    await control({ notif: "slow" });
    await app.signIn(ADMIN);
    await page.waitForSelector(".noti-badge");
    await page.click(bell);
    await expect(page.locator(".sb-noti-list .spinner-border")).toHaveCount(1);
    await page.waitForSelector(".sb-noti-item");
  });

  for (const [name, size] of [["tablet", { width: 820, height: 1180 }], ["mobile", { width: 390, height: 844 }]] as const) {
    test(`${name}: dropdown thông báo nằm trong khung nhìn`, async ({ page, app }) => {
      await page.setViewportSize(size);
      await app.signIn(ADMIN);
      await page.waitForSelector(".noti-badge");
      await page.click(bell);
      await page.waitForSelector(".sb-noti-item");
      const box = (await page.locator(".sb-noti-dropdown").boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    });
  }
});

test.describe("toast ticket", () => {
  test("Admin: biến thể manager đếm mọi ticket (mở 2, chờ duyệt 1); tải lại trong cùng tab KHÔNG hiện lại; tự đóng sau ~10 giây", async ({ page, app }) => {
    await app.signIn(ADMIN);
    const toast = page.locator('[data-testid="ticket-welcome-toast"]');
    await toast.waitFor();
    await expect(toast).toContainText("Đang mở: 2");
    await expect(toast).toContainText("Đang chờ duyệt: 1");
    await expect(page.locator(".ticket-toast-container.is-manager")).toHaveCount(1);
    await expect(toast).toHaveCount(0, { timeout: 20_000 }); // tự đóng
    await page.reload();
    await app.waitForSidebar();
    await page.waitForTimeout(1500);
    await expect(toast).toHaveCount(0);
  });

  test("Giảng viên: chỉ ticket giao cho mình (thực hiện 1, báo cáo 1); nút đóng ẩn toast", async ({ page, app }) => {
    await app.signIn(INS, { role: "teacher" });
    const toast = page.locator('[data-testid="ticket-welcome-toast"]');
    await toast.waitFor();
    await expect(toast).toContainText("Đang thực hiện: 1");
    await expect(toast).toContainText("Đã báo cáo: 1");
    await expect(page.locator(".ticket-toast-container.is-instructor")).toHaveCount(1);
    await page.click(".ticket-toast-close");
    await expect(toast).toHaveCount(0);
  });

  for (const mode of ["none", "error"] as const) {
    test(`tickets=${mode} => không hiện toast`, async ({ page, app }) => {
      await control({ tickets: mode });
      await app.signIn(ADMIN);
      await app.waitForSidebar();
      await page.waitForTimeout(2500);
      await expect(page.locator('[data-testid="ticket-welcome-toast"]')).toHaveCount(0);
    });
  }
});
