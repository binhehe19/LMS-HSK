// Bản build KHÔNG cấu hình dịch vụ Thông báo/Ticket (WAITING FOR BACKEND): phải hiện trạng thái chờ, không gọi mạng, không số/toast giả. (M3A)
import { expect, test } from "../support/test";

test("chưa cấu hình: chuông có mặt ở trạng thái 'waiting', KHÔNG huy hiệu, KHÔNG toast, KHÔNG request tới dịch vụ thông báo/ticket; menu vẫn đủ", async ({ page, app }) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/(notification|tickets)/.test(r.url())) calls.push(r.url());
  });
  await app.signIn("/admin/class-management");
  await app.waitForSidebar();
  await expect(page.locator('[data-testid="notification-bell"]')).toHaveAttribute("data-unread-status", "waiting");
  await page.waitForTimeout(2000);
  expect(await page.locator(".noti-badge").count()).toBe(0);
  expect(await page.locator('[data-testid="menu-unread-badge"]').count()).toBe(0);
  expect(await page.locator('[data-testid="ticket-welcome-toast"]').count()).toBe(0);
  await page.click('[data-testid="notification-bell"]');
  await page.waitForSelector('[data-testid="notification-waiting"]');
  await expect(page.locator('[data-testid="notification-waiting"]')).toContainText("chờ backend");
  expect(calls).toEqual([]);
  expect(await app.menuTitles()).toHaveLength(22);
});

test("chưa cấu hình: Giảng viên cũng không có số/toast giả, placeholder vẫn hoạt động", async ({ page, app }) => {
  await app.signIn("/learning-path/manage", { role: "teacher" }); // route HSK cũ hợp lệ chưa chuyển (placeholder)
  await page.waitForSelector('[data-testid="migration-placeholder"]');
  await expect(page.locator('[data-testid="notification-bell"]')).toHaveAttribute("data-unread-status", "waiting");
  expect(await page.locator('[data-testid="ticket-welcome-toast"]').count()).toBe(0);
});

test("chưa cấu hình: màn Tổng quan giảng viên hiện '—' và thông báo WAITING FOR BACKEND (không số 0 giả), không gọi API thông báo/ticket", async ({ page, app }) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/(notification|tickets)/.test(r.url())) calls.push(r.url());
  });
  await app.signIn("/instructor/welcome", { role: "teacher" });
  await page.waitForSelector(".welcome-hero-card");
  const notice = page.locator('[data-testid="welcome-data-notice"]');
  await expect(notice).toHaveAttribute("data-kind", "waiting");
  await expect(notice).toContainText("WAITING FOR BACKEND");
  await expect(page.locator(".welcome-stat-card h3")).toHaveText(["—", "—", "—", "—"]);
  await expect(page.getByText("— thông báo chưa đọc")).toBeVisible();
  expect(calls).toEqual([]);
});

test("chưa cấu hình: màn Thông báo của tôi hiện WAITING FOR BACKEND, không danh sách giả, không toast lỗi, không gọi API thông báo", async ({ page, app }) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/(notification|tickets)/.test(r.url())) calls.push(r.url());
  });
  await app.signIn("/instructor/instructor-notifications", { role: "teacher" });
  const notice = page.locator('[data-testid="notifications-data-notice"]');
  await notice.waitFor();
  await expect(notice).toHaveAttribute("data-kind", "waiting");
  await expect(notice).toContainText("WAITING FOR BACKEND");
  await expect(page.getByText("Không tìm thấy thông báo nào")).toHaveCount(0);
  await expect(page.locator(".notification-list-items > div > div")).toHaveCount(1); // chỉ có khối thông báo
  await expect(page.getByRole("button", { name: "Đánh dấu tất cả là đã đọc" })).toBeDisabled();
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Thử lại" })).toHaveCount(0);
  expect(calls).toEqual([]);
});

test("chưa cấu hình: màn Quản lý thông báo của Admin — giữ giao diện, đánh dấu WAITING FOR BACKEND, KHÔNG có đường nào tới request gửi/lịch sử/người dùng", async ({ page, app }) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/(notification|tickets|admin)/.test(r.url())) calls.push(`${r.method()} ${r.url()}`);
  });
  await app.signIn("/admin/settings/notifications", { role: "admin" });
  await expect(page.locator('[data-testid="notifications-data-notice"]')).toHaveAttribute("data-kind", "waiting");
  await page.getByRole("button", { name: /Gửi Thông Báo Mới/ }).click();
  await expect(page.getByTestId("campaign-send-notice")).toContainText("WAITING FOR BACKEND");
  await expect(page.getByRole("button", { name: "Xem trước & Gửi" })).toBeDisabled();
  await page.getByLabel(/Tiêu đề thông báo/).fill("Tiêu đề");
  await page.getByLabel(/Nội dung thông báo/).fill("Nội dung");
  await page.getByRole("button", { name: "Xem trước & Gửi", disabled: true }).click({ force: true }).catch(() => {});
  await expect(page.getByTestId("campaign-preview-modal")).toHaveCount(0);
  await page.getByRole("button", { name: /Chọn người nhận/ }).click();
  await expect(page.getByTestId("recipient-data-notice")).toHaveAttribute("data-kind", "waiting");
  await expect(page.getByTestId("recipient-data-notice")).toContainText("WAITING FOR BACKEND");
  await page.getByTestId("recipient-selector-modal").getByRole("button", { name: "Hủy" }).click();
  await page.getByRole("button", { name: "Hủy", exact: true }).click(); // đóng form
  await page.getByRole("button", { name: /Thông báo đã gửi/ }).click();
  await expect(page.getByTestId("campaign-data-notice")).toHaveAttribute("data-kind", "waiting");
  await expect(page.getByText("Chưa có thông báo nào được gửi.")).toHaveCount(0);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0); // không toast lỗi, không "đã gửi" giả
  expect(calls).toEqual([]); // không một request nào tới dịch vụ thông báo/ticket/người dùng
});
