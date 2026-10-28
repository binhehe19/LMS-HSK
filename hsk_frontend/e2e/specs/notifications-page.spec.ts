// Màn "Thông báo của tôi" /instructor/instructor-notifications (M3B.3). Dữ liệu = mock theo HỢP ĐỒNG THẬT của repo-notification (M5): GET /notifications?page&size
// (size ≤ 100), KHÔNG lọc phía server => khi có bộ lọc (trạng thái đọc / khoảng ngày) client lấy mọi trang (page=0&size=100) rồi lọc + cắt trang ở client.
// Mock mặc định: 4 thông báo (1-3 chưa đọc, 4 đã đọc); thông báo 1 có đích nội bộ (đặt bằng control({ notifTarget })).
import type { Page } from "@playwright/test";
import { control, mockState } from "../support/mock";
import { expect, test } from "../support/test";

const URL_PAGE = "/instructor/instructor-notifications";
const list = ".notification-list-items";
const rows = `${list} > div`;
const notice = '[data-testid="notifications-data-notice"]';
const markAll = (page: Page) => page.getByRole("button", { name: "Đánh dấu tất cả là đã đọc" });
const toastText = (page: Page) => page.locator("[data-sonner-toast]");
const LIST_PATH = /\/api\/notification\/notifications\/?$/;
const listRequests = (page: Page) => {
  const urls: URL[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (r.method() === "GET" && LIST_PATH.test(u.pathname)) urls.push(u);
  });
  return urls;
};
/** Lời gọi "lấy mọi trang để lọc ở client": page=0&size=100, không có tham số lọc nào (backend chung không hỗ trợ). */
const expectFetchAll = (u: URL) => {
  expect(u.searchParams.get("page")).toBe("0");
  expect(u.searchParams.get("size")).toBe("100");
  for (const k of ["readStatus", "fromDate", "toDate"]) expect(u.searchParams.has(k), k).toBe(false);
};

test.describe("Teacher và Mentor vào được; nội dung đúng dữ liệu mock", () => {
  for (const role of ["teacher", "mentor"] as const) {
    test(`${role}: tiêu đề, badge chưa đọc, 4 thông báo (3 chưa đọc), một sidebar, mục 'Thông báo của tôi' active, không vòng lặp redirect`, async ({ page, app }) => {
      const requests = listRequests(page);
      await app.signIn(URL_PAGE, { role });
      await page.waitForSelector(rows);
      await expect(page.locator(".card-header h4")).toHaveText("Thông báo của tôi");
      await expect(page.locator(".card-header .badge")).toHaveText("3 chưa đọc");
      await expect(page.locator(rows)).toHaveCount(4);
      await expect(page.locator(`${rows}.bg-light-primary`)).toHaveCount(3);
      await expect(page.locator(".management-sidebar-column")).toHaveCount(1);
      await expect(page.locator(".content > .container > .row")).toHaveClass("row"); // không có g-4 như bản cũ
      const active = await page.$$eval(".sidebar-middle .sidebar-menu a.active .sidebar-menu-text", (as) => as.map((a) => (a.textContent ?? "").trim()));
      expect(active).toEqual(["Thông báo của tôi"]);
      await expect(page.getByText("Gửi Thông Báo Mới")).toHaveCount(0); // composer chỉ cho Admin/Teacher-manager ở bản cũ
      expect(requests[0].searchParams.get("page")).toBe("0");
      expect(requests[0].searchParams.get("size")).toBe("10");
      expect(requests[0].searchParams.has("readStatus")).toBe(false); // ALL = không gửi
      await page.reload();
      await page.waitForSelector(rows);
      expect(page.url()).toBe(app.url(URL_PAGE));
      expect(app.loginVisits()).toBe(0);
      expect(app.problems).toEqual([]);
    });
  }
});

test.describe("quyền: chỉ TEACHER và MENTOR (quyết định giao diện; chưa phải xác nhận từ backend)", () => {
  for (const role of ["admin", "teacher-manager", "collaborator", "manager", "user", "none"] as const) {
    test(`${role} bị chặn, không thấy nội dung, không thấy sidebar`, async ({ page, app }) => {
      await app.signIn(URL_PAGE, { role });
      await page.waitForSelector('[data-testid="auth-forbidden"]');
      expect(await page.locator(list).count()).toBe(0);
      expect(await page.locator(".management-sidebar-column").count()).toBe(0);
    });
  }

  test("chưa đăng nhập => chuyển Auth đúng một lần, redirect về đúng URL, KHÔNG gọi API thông báo", async ({ page, app }) => {
    const calls: string[] = [];
    page.on("request", (r) => {
      if (/\/api\/(notification|tickets|quiz)/.test(r.url())) calls.push(r.url());
    });
    await page.goto(app.url(URL_PAGE));
    await app.waitForLogin();
    expect(new URL(page.url()).searchParams.get("redirect")).toBe(app.url(URL_PAGE));
    expect(app.loginVisits()).toBe(1);
    expect(calls).toEqual([]);
  });
});

test.describe("bộ lọc và phân trang", () => {
  test("lọc Chưa đọc / Đã đọc: client lấy mọi trang (page=0&size=100, không tham số lọc) rồi lọc ở client; về 'Tất cả' lại lấy một trang server (size=10)", async ({ page, app }) => {
    const requests = listRequests(page);
    await app.signIn(URL_PAGE, { role: "teacher" });
    await page.waitForSelector(rows);
    await page.locator("select.form-select").selectOption("UNREAD");
    await expect(page.locator(rows)).toHaveCount(3);
    expectFetchAll(requests.at(-1)!);
    await page.locator("select.form-select").selectOption("READ");
    await expect(page.locator(rows)).toHaveCount(1);
    expectFetchAll(requests.at(-1)!);
    await expect(page.locator(`${rows}.bg-light-primary`)).toHaveCount(0);
    await page.locator("select.form-select").selectOption("ALL");
    await expect(page.locator(rows)).toHaveCount(4);
    expect(requests.at(-1)!.searchParams.has("readStatus")).toBe(false);
    expect(requests.at(-1)!.searchParams.get("size")).toBe("10");
    expect(requests.at(-1)!.searchParams.get("page")).toBe("0");
  });

  test("khoảng ngày: lọc ở client theo đầu ngày/cuối ngày giờ VN (backend chung không nhận fromDate/toDate), chỉ hiện thông báo trong khoảng; xoá khoảng trả về đủ", async ({ page, app }) => {
    // Mỗi thông báo cách nhau 1 ngày: thông báo i = 09:00 (giờ VN) 23/10/2026 trừ i ngày
    await control({ now: "2026-10-23T09:00:00+07:00", notifTotal: 10, notifStepMin: 1440 });
    const requests = listRequests(page);
    await app.signIn(URL_PAGE, { role: "teacher" });
    await page.waitForSelector(rows);
    await expect(page.locator(rows)).toHaveCount(10);
    const inputs = page.locator(".ant-picker input");
    await inputs.first().click();
    await inputs.first().fill("20/10/2026");
    await inputs.first().press("Enter");
    await inputs.last().fill("21/10/2026");
    await inputs.last().press("Enter");
    await expect(page.locator(rows)).toHaveCount(2); // 00:00 20/10 → 23:59:59.999 21/10 giờ VN: thông báo 2 và 3
    expectFetchAll(requests.at(-1)!);
    await expect(page.locator(rows).first()).toContainText("Thông báo giả lập 2");
    await page.locator(".ant-picker").hover(); // biểu tượng xoá của antd chỉ hiện khi rê chuột
    await page.locator(".ant-picker-clear").click();
    await expect(page.locator(rows)).toHaveCount(10);
    expect(requests.at(-1)!.searchParams.has("fromDate")).toBe(false);
    expect(requests.at(-1)!.searchParams.get("size")).toBe("10"); // hết bộ lọc => một trang server
  });

  test("phân trang 25 thông báo: Trước/1/2/3/Sau, chuyển trang gọi page đúng, nút biên bị khoá, đổi bộ lọc về trang đầu", async ({ page, app }) => {
    await control({ notifTotal: 25 });
    const requests = listRequests(page);
    await app.signIn(URL_PAGE, { role: "teacher" });
    await page.waitForSelector(rows);
    await expect(page.locator(".pagination li")).toHaveText(["Trước", "1", "2", "3", "Sau"]);
    await expect(page.locator(rows)).toHaveCount(10);
    await expect(page.locator(".pagination li").first()).toHaveClass(/disabled/);
    await page.locator(".pagination .page-link", { hasText: /^3$/ }).click();
    await expect(page.locator(rows)).toHaveCount(5);
    expect(requests.at(-1)!.searchParams.get("page")).toBe("2");
    await expect(page.locator(".pagination li").last()).toHaveClass(/disabled/);
    await expect(page.locator(".pagination li.active")).toHaveText("3");
    await page.locator(".pagination .page-link", { hasText: "Trước" }).click();
    await expect(page.locator(".pagination li.active")).toHaveText("2");
    await page.locator("select.form-select").selectOption("UNREAD");
    await expect.poll(() => requests.at(-1)?.searchParams.get("size")).toBe("100"); // có bộ lọc => lấy mọi trang để lọc ở client
    expectFetchAll(requests.at(-1)!);
    await expect(page.locator(".pagination li.active")).toHaveText("1"); // đổi bộ lọc về trang đầu
  });

  test("không có phân trang khi tổng ≤ 10 thông báo", async ({ page, app }) => {
    await app.signIn(URL_PAGE, { role: "teacher" });
    await page.waitForSelector(rows);
    await expect(page.locator(".pagination")).toHaveCount(0);
  });
});

test.describe("đọc, đánh dấu và điều hướng", () => {
  test("bấm thông báo chưa đọc có đích: gọi 'đã đọc' đúng một lần, chuyển tới đích; quay lại thì thông báo đã đọc và badge giảm", async ({ page, app }) => {
    await control({ notifTarget: "/instructor/welcome" });
    await app.signIn(URL_PAGE, { role: "teacher" });
    await page.waitForSelector(rows);
    await expect(page.locator(".noti-badge")).toHaveText("3");
    await page.locator(rows).first().click();
    await page.waitForURL(app.url("/instructor/welcome"));
    await page.waitForSelector(".welcome-hero-card");
    expect((await mockState()).counters.notifRead).toBe(1);
    await page.goBack();
    await page.waitForSelector(rows);
    await expect(page.locator(`${rows}.bg-light-primary`)).toHaveCount(2);
    await expect(page.locator(".card-header .badge")).toHaveText("2 chưa đọc");
    await expect(page.locator(".noti-badge")).toHaveText("2");
  });

  test("bấm thông báo chưa đọc KHÔNG có đích: đánh dấu đã đọc, ở lại trang, danh sách và badge cập nhật", async ({ page, app }) => {
    await app.signIn(URL_PAGE, { role: "teacher" });
    await page.waitForSelector(rows);
    await page.locator(rows).nth(1).click(); // thông báo 2: không có payload
    await expect(page.locator(`${rows}.bg-light-primary`)).toHaveCount(2);
    expect(page.url()).toBe(app.url(URL_PAGE));
    expect((await mockState()).counters.notifRead).toBe(1);
    await expect(page.locator(".noti-badge")).toHaveText("2");
  });

  test("bấm thông báo đã đọc không có đích: không gọi 'đã đọc', ở lại trang", async ({ page, app }) => {
    await app.signIn(URL_PAGE, { role: "teacher" });
    await page.waitForSelector(rows);
    await page.locator(rows).last().click();
    await page.waitForTimeout(500);
    expect((await mockState()).counters.notifRead).toBe(0);
    expect(page.url()).toBe(app.url(URL_PAGE));
    await expect(page.locator(rows)).toHaveCount(4);
  });

  test("'Đánh dấu tất cả là đã đọc': toast thành công, hết chưa đọc, nút bị khoá, chuông ở sidebar cập nhật", async ({ page, app }) => {
    await app.signIn(URL_PAGE, { role: "teacher" });
    await page.waitForSelector(rows);
    await expect(page.locator(".noti-badge")).toHaveText("3");
    await markAll(page).click();
    await expect(toastText(page).first()).toContainText("Đã đánh dấu tất cả là đã đọc");
    await expect(page.locator(`${rows}.bg-light-primary`)).toHaveCount(0);
    await expect(page.locator(".card-header .badge")).toHaveCount(0);
    await expect(markAll(page)).toBeDisabled();
    await expect(page.locator(".noti-badge")).toHaveCount(0);
  });
});

test.describe("liên kết từ chuông ở sidebar", () => {
  test("'Xem tất cả thông báo' trong dropdown chuông mở màn danh sách; bấm một thông báo trong dropdown điều hướng và đánh dấu đã đọc; quay lại danh sách", async ({ page, app }) => {
    await control({ notifTarget: "/instructor/welcome" });
    await app.signIn("/instructor/welcome", { role: "teacher" });
    await page.waitForSelector(".welcome-hero-card");
    await page.click('[data-testid="notification-bell"]');
    await page.waitForSelector(".sb-noti-item");
    await page.getByRole("link", { name: "Xem tất cả thông báo" }).click();
    await page.waitForURL(app.url(URL_PAGE));
    await page.waitForSelector(rows);
    await expect(page.locator(rows)).toHaveCount(4);
    await page.click('[data-testid="notification-bell"]');
    await page.waitForSelector(".sb-noti-item");
    await page.locator(".sb-noti-item").first().click();
    await page.waitForURL(app.url("/instructor/welcome"));
    expect((await mockState()).counters.notifRead).toBe(1);
    await page.goBack();
    await page.waitForSelector(rows);
    await expect(page.locator(`${rows}.bg-light-primary`)).toHaveCount(2);
  });

  test("mục menu 'Thông báo của tôi' mở màn thật (không phải trang 'đang chuyển đổi')", async ({ page, app }) => {
    await app.signIn("/instructor/welcome", { role: "teacher" });
    await page.waitForSelector(".welcome-hero-card");
    await page.getByRole("link", { name: /Thông báo của tôi/ }).click();
    await page.waitForURL(app.url(URL_PAGE));
    await page.waitForSelector(rows);
    await expect(page.locator('[data-testid="migration-placeholder"]')).toHaveCount(0);
  });
});

test.describe("trạng thái dữ liệu", () => {
  test("đang tải (lời gọi danh sách bị giữ lại): spinner 'Đang tải...' và nút đánh dấu tất cả bị khoá", async ({ page, app }) => {
    // Giữ lời gọi danh sách ở trình duyệt cho tới khi test cho phép (xác định, không phụ thuộc thời gian).
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(/\/api\/notification\/notifications(\?|$)/, async (route) => {
      await gate;
      await route.continue();
    });
    await app.signIn(URL_PAGE, { role: "teacher" });
    await expect(page.getByText("Đang tải...")).toBeVisible();
    await expect(page.locator(`${list} .spinner-border`)).toBeVisible();
    await expect(markAll(page)).toBeDisabled();
    release();
    await page.waitForSelector(rows);
    await expect(page.getByText("Đang tải...")).toHaveCount(0);
  });

  test("rỗng thật: trạng thái 'Không tìm thấy thông báo nào', không có khối lỗi/chờ backend", async ({ page, app }) => {
    await control({ notif: "empty" });
    await app.signIn(URL_PAGE, { role: "teacher" });
    await expect(page.getByText("Không tìm thấy thông báo nào")).toBeVisible();
    await expect(page.getByText("Thử thay đổi bộ lọc hoặc quay lại sau nhé!")).toBeVisible();
    expect(await page.locator(notice).count()).toBe(0);
    await expect(markAll(page)).toBeDisabled();
  });

  test("API lỗi 500: khối lỗi + toast lỗi, KHÔNG nói 'không có thông báo'; 'Thử lại' tải lại được khi API phục hồi", async ({ page, app }) => {
    await control({ notif: "error" });
    await app.signIn(URL_PAGE, { role: "teacher" });
    // Toast của sonner chỉ tồn tại vài giây: kiểm tra NGAY khi khối lỗi xuất hiện, trước các kiểm tra khác (máy tải nặng từng làm toast biến mất trước khi test kịp xem).
    await expect(toastText(page).first()).toContainText("Không thể tải danh sách thông báo");
    await expect(page.locator(notice)).toHaveAttribute("data-kind", "error");
    await expect(page.getByText("Không tìm thấy thông báo nào")).toHaveCount(0);
    await control({ notif: "ok" });
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(page.locator(rows)).toHaveCount(4);
    expect(await page.locator(notice).count()).toBe(0);
  });
});

test.describe("responsive", () => {
  for (const [name, size] of [["tablet", { width: 820, height: 1180 }], ["mobile", { width: 390, height: 844 }]] as const) {
    test(`${name}: không cuộn ngang; sidebar xếp trên nội dung; bộ lọc xuống dòng`, async ({ page, app }) => {
      await page.setViewportSize(size);
      await app.signIn(URL_PAGE, { role: "teacher" });
      await page.waitForSelector(rows);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      const col = (await page.locator(".management-sidebar-column").boundingBox())!;
      const main = (await page.locator(".col-lg-9").boundingBox())!;
      expect(main.y).toBeGreaterThanOrEqual(col.y + col.height - 2);
      const card = (await page.locator(".col-lg-9 .card").boundingBox())!;
      expect(card.width).toBeLessThanOrEqual(size.width);
    });
  }
});
