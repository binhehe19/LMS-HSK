// Màn "Quản lý thông báo" của Admin /admin/settings/notifications (M3B.4). MOCK / NOT INTEGRATED: danh sách người dùng, lịch sử và việc GỬI chiến dịch đều do
// scripts/mock-server.mjs giả lập (không gọi backend thật, không có thao tác ghi thật). Mock mặc định: 25 người dùng, 3 chiến dịch, 4 thông báo của chính Admin.
import type { Page } from "@playwright/test";
import { control, mockState } from "../support/mock";
import { expect, test } from "../support/test";

const URL_PAGE = "/admin/settings/notifications";
const list = ".notification-list-items";
const toastText = (page: Page) => page.locator("[data-sonner-toast]");
const recipientModal = (page: Page) => page.getByTestId("recipient-selector-modal");
const historyModal = (page: Page) => page.getByTestId("campaign-history-modal");
const previewModal = (page: Page) => page.getByTestId("campaign-preview-modal");
const composer = (page: Page) => page.getByTestId("notification-composer");
const selected = (page: Page) => recipientModal(page).locator("span.text-muted", { hasText: "Đã chọn:" });

async function openComposer(page: Page) {
  await page.waitForSelector(list);
  await page.getByRole("button", { name: /Gửi Thông Báo Mới/ }).click();
  await composer(page).waitFor();
}
async function fillForm(page: Page, title = "Tiêu đề thử nghiệm", message = "Nội dung thử nghiệm") {
  await page.getByLabel(/Tiêu đề thông báo/).fill(title);
  await page.getByLabel(/Nội dung thông báo/).fill(message);
}
async function pickFirstUsers(page: Page, count: number) {
  await page.getByRole("button", { name: /Chọn người nhận/ }).click();
  await recipientModal(page).getByTestId("recipient-row").first().waitFor();
  const rows = recipientModal(page).getByTestId("recipient-row");
  for (let i = 0; i < count; i++) await rows.nth(i).getByRole("button", { name: "Chọn" }).click();
  await recipientModal(page).getByRole("button", { name: /Hoàn tất chọn/ }).click();
}

test.describe("Admin vào được; các role khác bị chặn (không tự cấp quyền cho Teacher-manager/Collaborator)", () => {
  test("admin: tiêu đề, hai nút, danh sách thông báo của chính mình, mục menu 'Quản lý thông báo' active, không vòng lặp redirect", async ({ page, app }) => {
    await app.signIn(URL_PAGE, { role: "admin" });
    await page.waitForSelector(list);
    await expect(page.locator(".card-header h4")).toHaveText("Quản lý thông báo");
    await expect(page.getByRole("button", { name: /Thông báo đã gửi/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Gửi Thông Báo Mới/ })).toBeVisible();
    await expect(page.locator(`${list} > div`)).toHaveCount(4);
    await expect(page.locator(".content > .container > .row")).toHaveClass("row");
    await expect(page.locator(".brand-subtitle")).toHaveText("LMS · Admin");
    const active = await page.$$eval(".sidebar-middle .sidebar-menu a.active .sidebar-menu-text", (as) => as.map((a) => (a.textContent ?? "").trim()));
    expect(active).toEqual(["Quản lý thông báo"]);
    await page.reload();
    await page.waitForSelector(list);
    expect(app.loginVisits()).toBe(0);
    expect(app.problems).toEqual([]);
  });

  for (const role of ["teacher", "mentor", "teacher-manager", "collaborator", "manager", "user", "none"] as const) {
    test(`${role} bị chặn, không thấy nội dung, không thấy sidebar, không có request tới chiến dịch/người dùng`, async ({ page, app }) => {
      const calls: string[] = [];
      page.on("request", (r) => {
        if (/\/api\/(admin\/users|notification\/admin)/.test(r.url())) calls.push(r.url());
      });
      await app.signIn(URL_PAGE, { role });
      await page.waitForSelector('[data-testid="auth-forbidden"]');
      expect(await page.locator(list).count()).toBe(0);
      expect(await page.locator(".management-sidebar-column").count()).toBe(0);
      expect(calls).toEqual([]);
    });
  }

  test("chưa đăng nhập => chuyển Auth đúng một lần, redirect về đúng URL, KHÔNG gọi API", async ({ page, app }) => {
    const calls: string[] = [];
    page.on("request", (r) => {
      if (/\/api\/(notification|tickets|quiz|admin)/.test(r.url())) calls.push(r.url());
    });
    await page.goto(app.url(URL_PAGE));
    await app.waitForLogin();
    expect(new URL(page.url()).searchParams.get("redirect")).toBe(app.url(URL_PAGE));
    expect(app.loginVisits()).toBe(1);
    expect(calls).toEqual([]);
  });

  test("Teacher vẫn dùng màn của mình (/instructor/instructor-notifications), không có form gửi", async ({ page, app }) => {
    await app.signIn("/instructor/instructor-notifications", { role: "teacher" });
    await page.waitForSelector(list);
    await expect(page.getByRole("button", { name: /Gửi Thông Báo Mới/ })).toHaveCount(0);
    await expect(page.locator(".card-header h4")).toHaveText("Thông báo của tôi");
  });
});

test.describe("form gửi thông báo (gửi GIẢ LẬP tới mock)", () => {
  test("mở/đóng form: hai nút ở tiêu đề ẩn khi mở; Hủy và nút đóng quay lại", async ({ page, app }) => {
    await app.signIn(URL_PAGE, { role: "admin" });
    await openComposer(page);
    await expect(page.getByRole("button", { name: /Gửi Thông Báo Mới/ })).toHaveCount(0);
    await expect(page.getByTestId("campaign-send-notice")).toHaveCount(0); // build có bật gửi (mock)
    await composer(page).getByRole("button", { name: "Hủy" }).click();
    await expect(composer(page)).toHaveCount(0);
    await openComposer(page);
    await page.getByRole("button", { name: "Đóng form gửi thông báo" }).click();
    await expect(composer(page)).toHaveCount(0);
  });

  test("validation: thiếu nội dung / chỉ khoảng trắng / chưa chọn người nhận => toast lỗi, không mở xác nhận, KHÔNG có request gửi", async ({ page, app }) => {
    await app.signIn(URL_PAGE, { role: "admin" });
    await openComposer(page);
    await page.getByRole("button", { name: "Xem trước & Gửi" }).click();
    await expect(toastText(page).first()).toContainText("Vui lòng nhập đầy đủ tiêu đề, nội dung và chọn ít nhất 1 người nhận.");
    await fillForm(page, "   ", "Nội dung");
    await page.getByRole("button", { name: "Xem trước & Gửi" }).click();
    await fillForm(page, "Tiêu đề", "Nội dung"); // đủ chữ nhưng chưa chọn người nhận
    await page.getByRole("button", { name: "Xem trước & Gửi" }).click();
    await expect(previewModal(page)).toHaveCount(0);
    expect((await mockState()).counters.campaignSend).toBe(0);
  });

  test("luồng đầy đủ: chọn 2 người → xem trước → xác nhận → mock nhận ĐÚNG MỘT yêu cầu đúng nội dung; toast thành công; đóng form; lịch sử có chiến dịch mới ở đầu", async ({ page, app }) => {
    await app.signIn(URL_PAGE, { role: "admin" });
    await openComposer(page);
    await fillForm(page, "  Thông báo bảo trì ", "Hệ thống bảo trì lúc 22:00.");
    await pickFirstUsers(page, 2);
    await expect(page.getByText(/Người nhận \(2\)/)).toBeVisible();
    await expect(page.getByTestId("recipient-chip")).toHaveCount(2);
    await page.getByRole("button", { name: "Xem trước & Gửi" }).click();
    await expect(previewModal(page)).toContainText("tới 2 người dùng");
    await expect(previewModal(page)).toContainText("Hệ thống bảo trì lúc 22:00.");
    await previewModal(page).getByRole("button", { name: "Xác nhận & Gửi" }).click();
    await expect(toastText(page).first()).toContainText("Thông báo đã được gửi thành công!");
    await expect(composer(page)).toHaveCount(0);
    const state = await mockState();
    expect(state.counters.campaignSend).toBe(1);
    expect((state as unknown as { campaignsSent: unknown[] }).campaignsSent).toEqual([{ title: "Thông báo bảo trì", message: "Hệ thống bảo trì lúc 22:00.", userIds: ["mock-user-1", "mock-user-2"] }]);
    await page.getByRole("button", { name: /Thông báo đã gửi/ }).click();
    await expect(historyModal(page).getByTestId("campaign-row").first()).toContainText("Thông báo bảo trì");
    await expect(historyModal(page).getByTestId("campaign-row")).toHaveCount(4);
  });

  test("chống gửi trùng: bấm 'Xác nhận & Gửi' nhiều lần khi mock trả chậm => mock chỉ nhận MỘT yêu cầu", async ({ page, app }) => {
    await control({ send: "slow" });
    await app.signIn(URL_PAGE, { role: "admin" });
    await openComposer(page);
    await fillForm(page);
    await pickFirstUsers(page, 1);
    await page.getByRole("button", { name: "Xem trước & Gửi" }).click();
    const confirm = previewModal(page).getByRole("button", { name: /Xác nhận & Gửi/ });
    await confirm.dblclick();
    await confirm.click({ force: true, timeout: 1000 }).catch(() => {});
    await expect(previewModal(page).getByRole("button", { name: /Đang gửi/ })).toBeDisabled();
    await expect(toastText(page).first()).toContainText("Thông báo đã được gửi thành công!", { timeout: 15_000 });
    expect((await mockState()).counters.campaignSend).toBe(1);
  });

  test("gửi lỗi (mock 500): toast lỗi, KHÔNG báo thành công, giữ nguyên nội dung + người nhận; thử lại thành công khi mock phục hồi", async ({ page, app }) => {
    await control({ send: "error" });
    await app.signIn(URL_PAGE, { role: "admin" });
    await openComposer(page);
    await fillForm(page, "Giữ lại", "Nội dung giữ lại");
    await pickFirstUsers(page, 1);
    await page.getByRole("button", { name: "Xem trước & Gửi" }).click();
    await previewModal(page).getByRole("button", { name: "Xác nhận & Gửi" }).click();
    await expect(toastText(page).first()).toContainText("Gửi thất bại, vui lòng thử lại.");
    await expect(page.getByText("Thông báo đã được gửi thành công!")).toHaveCount(0);
    await expect(previewModal(page)).toHaveCount(0);
    await expect(page.getByLabel(/Tiêu đề thông báo/)).toHaveValue("Giữ lại");
    await expect(page.getByTestId("recipient-chip")).toHaveCount(1);
    expect(((await mockState()) as unknown as { campaignsSent: unknown[] }).campaignsSent).toEqual([]); // lỗi => không lưu chiến dịch giả
    await control({ send: "ok" });
    await page.getByRole("button", { name: "Xem trước & Gửi" }).click();
    await previewModal(page).getByRole("button", { name: "Xác nhận & Gửi" }).click();
    await expect(toastText(page).first()).toContainText("Thông báo đã được gửi thành công!");
    expect((await mockState()).counters.campaignSend).toBe(2); // 1 lỗi + 1 thành công, mỗi lần bấm xác nhận đúng một request
  });
});

test.describe("bộ chọn người nhận", () => {
  test("danh sách 10/trang (25 người = 3 trang), họ tên/email/nhãn vai trò; phân trang giữ bộ lọc; đổi bộ lọc về trang đầu", async ({ page, app }) => {
    await app.signIn(URL_PAGE, { role: "admin" });
    await openComposer(page);
    const calls: URL[] = [];
    page.on("request", (r) => {
      if (/\/api\/admin\/users/.test(r.url())) calls.push(new URL(r.url()));
    });
    await page.getByRole("button", { name: /Chọn người nhận/ }).click();
    const modal = recipientModal(page);
    await modal.getByTestId("recipient-row").first().waitFor();
    await expect(modal.getByTestId("recipient-row")).toHaveCount(10);
    await expect(modal).toContainText("Trang 1 / 3");
    await expect(modal.getByTestId("recipient-row").first()).toContainText("nguoidung1@mock.invalid");
    await expect(modal.getByTestId("recipient-row").nth(6)).toContainText("Chưa cập nhật"); // người dùng số 7 không có họ tên
    expect(calls[0].searchParams.get("page")).toBe("0");
    expect(calls[0].searchParams.get("size")).toBe("10");
    expect(calls[0].searchParams.has("search")).toBe(false);
    expect(calls[0].searchParams.has("role")).toBe(false);
    await modal.locator("select").selectOption("ROLE_USER");
    await expect.poll(() => calls.at(-1)?.searchParams.get("role")).toBe("ROLE_USER");
    await expect(modal).toContainText("Trang 1 / 2"); // mock: 13 người có ROLE_USER => 2 trang
    await modal.getByRole("button", { name: /Trang sau/ }).click();
    await expect.poll(() => calls.at(-1)?.searchParams.get("page")).toBe("1");
    expect(calls.at(-1)!.searchParams.get("role")).toBe("ROLE_USER"); // chuyển trang giữ bộ lọc
    await expect(modal.getByRole("button", { name: /Trang sau/ })).toBeDisabled();
    await modal.locator("select").selectOption("ROLE_TEACHER");
    await expect.poll(() => calls.at(-1)?.searchParams.get("role")).toBe("ROLE_TEACHER");
    expect(calls.at(-1)!.searchParams.get("page")).toBe("0"); // đổi bộ lọc => trang đầu
  });

  test("tìm kiếm chỉ chạy khi bấm 'Tìm kiếm'; kết quả khớp; không có kết quả => 'Không tìm thấy người dùng'", async ({ page, app }) => {
    await app.signIn(URL_PAGE, { role: "admin" });
    await openComposer(page);
    await page.getByRole("button", { name: /Chọn người nhận/ }).click();
    const modal = recipientModal(page);
    await modal.getByTestId("recipient-row").first().waitFor();
    const before = (await mockState()).counters.users;
    await modal.getByPlaceholder("Tìm theo tên, email...").fill("nguoidung12@");
    expect((await mockState()).counters.users).toBe(before); // gõ chưa gọi API
    await modal.getByRole("button", { name: "Tìm kiếm" }).click();
    await expect(modal.getByTestId("recipient-row")).toHaveCount(1);
    await expect(modal.getByTestId("recipient-row")).toContainText("nguoidung12@mock.invalid");
    await modal.getByPlaceholder("Tìm theo tên, email...").fill("khong-ton-tai-xyz");
    await modal.getByRole("button", { name: "Tìm kiếm" }).click();
    await expect(modal.getByText("Không tìm thấy người dùng")).toBeVisible();
  });

  test("chọn từng người, 'Chọn tất cả trang này', 'Chọn tất cả …' theo bộ lọc, chip trong form, bỏ chọn, 'Xóa tất cả'", async ({ page, app }) => {
    await app.signIn(URL_PAGE, { role: "admin" });
    await openComposer(page);
    await page.getByRole("button", { name: /Chọn người nhận/ }).click();
    const modal = recipientModal(page);
    await modal.getByTestId("recipient-row").first().waitFor();
    await modal.getByTestId("recipient-row").first().getByRole("button", { name: "Chọn" }).click();
    await expect(selected(page)).toContainText("1");
    await modal.getByRole("button", { name: "Chọn tất cả trang này" }).click();
    await expect(selected(page)).toContainText("10");
    await modal.locator("select").selectOption("ROLE_TEACHER"); // mock: người dùng số 2, 6, 8, 12... có ROLE_TEACHER
    await modal.getByTestId("recipient-row").first().waitFor();
    await modal.getByRole("button", { name: "Chọn tất cả TEACHER" }).click();
    await expect(toastText(page).first()).toContainText("Đã chọn tất cả");
    const count = Number((await selected(page).innerText()).replace(/\D+/g, ""));
    expect(count).toBeGreaterThan(10);
    await modal.getByRole("button", { name: /Hoàn tất chọn/ }).click();
    await expect(page.getByText(new RegExp(`Người nhận \\(${count}\\)`))).toBeVisible();
    await expect(page.getByTestId("recipient-chip").first()).toBeVisible();
    await page.getByRole("button", { name: /^Bỏ chọn / }).first().click();
    await expect(page.getByText(new RegExp(`Người nhận \\(${count - 1}\\)`))).toBeVisible();
    await page.getByRole("button", { name: /Xóa tất cả/ }).click();
    await expect(page.getByText("Chưa có người dùng nào được chọn.")).toBeVisible();
  });

  test("danh sách rỗng / lỗi 500 (có 'Thử lại') — hiển thị đúng trạng thái, không dữ liệu giả", async ({ page, app }) => {
    await control({ users: "empty" });
    await app.signIn(URL_PAGE, { role: "admin" });
    await openComposer(page);
    await page.getByRole("button", { name: /Chọn người nhận/ }).click();
    await expect(recipientModal(page).getByText("Không tìm thấy người dùng")).toBeVisible();
    await recipientModal(page).getByRole("button", { name: "Hủy" }).click();
    await control({ users: "error" });
    await page.getByRole("button", { name: /Chọn người nhận/ }).click();
    const notice = recipientModal(page).getByTestId("recipient-data-notice");
    await expect(notice).toHaveAttribute("data-kind", "error");
    await expect(toastText(page).first()).toContainText("Không tải được danh sách người dùng");
    await control({ users: "ok" });
    await recipientModal(page).getByRole("button", { name: "Thử lại" }).click();
    await expect(recipientModal(page).getByTestId("recipient-row")).toHaveCount(10);
  });
});

test.describe("lịch sử chiến dịch (chỉ đọc)", () => {
  test("liệt kê 3 chiến dịch (trạng thái có màu), xem chi tiết đầy đủ nội dung nhiều dòng, quay lại danh sách, đóng", async ({ page, app }) => {
    await app.signIn(URL_PAGE, { role: "admin" });
    await page.waitForSelector(list);
    await page.getByRole("button", { name: /Thông báo đã gửi/ }).click();
    const modal = historyModal(page);
    await expect(modal.getByTestId("campaign-row")).toHaveCount(3);
    await expect(modal.getByTestId("campaign-row").nth(0)).toContainText("SUCCESS");
    await expect(modal.getByTestId("campaign-row").nth(1)).toContainText("PROCESSING");
    await expect(modal.getByTestId("campaign-row").nth(2)).toContainText("FAILED");
    expect(await modal.getByTestId("campaign-row").nth(0).locator(".badge.rounded-pill").getAttribute("class")).toContain("text-success");
    await modal.getByTestId("campaign-row").first().click();
    const detail = modal.getByTestId("campaign-detail");
    await expect(detail).toContainText("Chiến dịch giả lập 1");
    await expect(detail).toContainText("Dòng thứ hai của nội dung.");
    await detail.getByRole("button", { name: /Quay lại danh sách/ }).click();
    await expect(modal.getByTestId("campaign-row")).toHaveCount(3);
    await modal.getByRole("button", { name: "Đóng", exact: true }).last().click();
    await expect(historyModal(page)).toHaveCount(0);
    expect((await mockState()).counters.campaignSend).toBe(0); // chỉ đọc
  });

  test("phân trang 25 chiến dịch: Trước/Sau, 'Trang N / 3', đúng trang; rỗng; lỗi + 'Thử lại'", async ({ page, app }) => {
    await control({ campaignTotal: 25 });
    await app.signIn(URL_PAGE, { role: "admin" });
    await page.waitForSelector(list);
    await page.getByRole("button", { name: /Thông báo đã gửi/ }).click();
    const modal = historyModal(page);
    await expect(modal.getByTestId("campaign-row")).toHaveCount(10);
    await expect(modal).toContainText("Trang 1 / 3");
    await expect(modal.getByRole("button", { name: /Trước/ })).toBeDisabled();
    await modal.getByRole("button", { name: /Sau/ }).click();
    await expect(modal).toContainText("Trang 2 / 3");
    await modal.getByRole("button", { name: /Sau/ }).click();
    await expect(modal.getByTestId("campaign-row")).toHaveCount(5);
    await expect(modal.getByRole("button", { name: /Sau/ })).toBeDisabled();
    await modal.getByRole("button", { name: "Đóng", exact: true }).last().click();

    await control({ campaigns: "empty" });
    await page.getByRole("button", { name: /Thông báo đã gửi/ }).click();
    await expect(historyModal(page).getByText("Chưa có thông báo nào được gửi.")).toBeVisible();
    await historyModal(page).getByRole("button", { name: "Đóng", exact: true }).last().click();

    await control({ campaigns: "error" });
    await page.getByRole("button", { name: /Thông báo đã gửi/ }).click();
    await expect(historyModal(page).getByTestId("campaign-data-notice")).toHaveAttribute("data-kind", "error");
    await expect(historyModal(page).getByText("Chưa có thông báo nào được gửi.")).toHaveCount(0);
    await control({ campaigns: "ok" });
    await historyModal(page).getByRole("button", { name: "Thử lại" }).click();
    await expect(historyModal(page).getByTestId("campaign-row").first()).toBeVisible();
  });
});

test.describe("danh sách thông báo của Admin (dùng lại màn Teacher): phân trang đúng trang", () => {
  // Hợp đồng thật repo-notification (M5): không lọc phía server. Không bộ lọc => một trang server (size=10); có bộ lọc => client lấy mọi trang
  // (page=0&size=100, không tham số lọc) rồi lọc + cắt trang ở client, kể cả khi chuyển trang trong lúc đang lọc.
  test("25 thông báo: bấm trang 3 lấy page=2; lọc Chưa đọc => lấy mọi trang rồi lọc ở client, chuyển trang giữ bộ lọc", async ({ page, app }) => {
    await control({ notifTotal: 25 });
    const requests: URL[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (r.method() === "GET" && /\/api\/notification\/notifications\/?$/.test(u.pathname)) requests.push(u);
    });
    await app.signIn(URL_PAGE, { role: "admin" });
    await page.waitForSelector(list);
    await page.locator(".pagination .page-link", { hasText: /^3$/ }).click();
    await expect(page.locator(`${list} > div`)).toHaveCount(5);
    expect(requests.at(-1)!.searchParams.get("page")).toBe("2");
    expect(requests.at(-1)!.searchParams.get("size")).toBe("10");
    await page.locator("select.form-select").selectOption("UNREAD");
    await expect.poll(() => requests.at(-1)?.searchParams.get("size")).toBe("100");
    expect(requests.at(-1)!.searchParams.get("page")).toBe("0");
    expect(requests.at(-1)!.searchParams.has("readStatus")).toBe(false);
    await expect(page.locator(`${list} > div`)).toHaveCount(10); // 14 chưa đọc (1-3 + số lẻ ≥ 5): trang 1 đủ 10
    const before = requests.length;
    await page.locator(".pagination .page-link", { hasText: /^2$/ }).click();
    await expect(page.locator(`${list} > div`)).toHaveCount(4); // trang 2 của bộ lọc Chưa đọc: 4 còn lại
    await expect.poll(() => requests.length).toBeGreaterThan(before); // chuyển trang khi đang lọc = lấy lại mọi trang rồi cắt ở client
    expect(requests.at(-1)!.searchParams.get("page")).toBe("0");
    expect(requests.at(-1)!.searchParams.get("size")).toBe("100");
    expect(requests.at(-1)!.searchParams.has("readStatus")).toBe(false);
    await expect(page.locator(".pagination li.active")).toHaveText("2");
  });
});

test.describe("responsive", () => {
  for (const [name, size] of [["tablet", { width: 820, height: 1180 }], ["mobile", { width: 390, height: 844 }]] as const) {
    test(`${name}: không cuộn ngang với trang, form và 3 modal; modal nằm gọn trong màn hình`, async ({ page, app }) => {
      await page.setViewportSize(size);
      await app.signIn(URL_PAGE, { role: "admin" });
      await page.waitForSelector(list);
      const noHScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
      expect(await noHScroll()).toBe(true);
      await page.getByRole("button", { name: /Gửi Thông Báo Mới/ }).click();
      await composer(page).waitFor();
      expect(await noHScroll()).toBe(true);
      await fillForm(page);
      await page.getByRole("button", { name: /Chọn người nhận/ }).click();
      await recipientModal(page).getByTestId("recipient-row").first().waitFor();
      expect(await noHScroll()).toBe(true);
      const box = (await recipientModal(page).locator(".modal-dialog").boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      await recipientModal(page).getByTestId("recipient-row").first().getByRole("button", { name: "Chọn" }).click();
      await recipientModal(page).getByRole("button", { name: /Hoàn tất chọn/ }).click();
      await page.getByRole("button", { name: "Xem trước & Gửi" }).click();
      await previewModal(page).waitFor();
      const pbox = (await previewModal(page).locator(".modal-dialog").boundingBox())!;
      expect(pbox.x + pbox.width).toBeLessThanOrEqual(size.width);
      await previewModal(page).getByRole("button", { name: "Quay lại" }).click();
      await composer(page).getByRole("button", { name: "Hủy" }).click();
      await page.getByRole("button", { name: /Thông báo đã gửi/ }).click();
      await historyModal(page).getByTestId("campaign-row").first().waitFor();
      expect(await noHScroll()).toBe(true);
      const hbox = (await historyModal(page).locator(".modal-dialog").boundingBox())!;
      expect(hbox.x + hbox.width).toBeLessThanOrEqual(size.width);
    });
  }
});
