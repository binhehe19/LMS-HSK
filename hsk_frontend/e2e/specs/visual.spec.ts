// Hồi quy giao diện (visual regression): sidebar Admin/Giảng viên (chuông, huy hiệu, dropdown, toast, thu gọn), màn lớp học, trang placeholder.
//
// ẢNH CHUẨN là ảnh của CHÍNH app này ở trạng thái đã được duyệt — KHÔNG phải ảnh HSK cũ. Việc đối chiếu với HSK cũ (React/Vite) làm một lần ở M1.5/M3A bằng công cụ
// ngoài repo: sidebar, chuông, dropdown, toast và /admin/class-management khớp từng pixel (xem docs/TESTING.md). Trang placeholder là màn MỚI (không có bản cũ để so).
//
// Điều kiện tái lập (đã nêu trong docs/TESTING.md): ảnh chuẩn được tạo trên Windows + Chromium của Playwright, có Internet để tải Google Fonts (Inter/Nunito như HSK cũ).
// Nền tảng khác hoặc không có Internet => test TỰ BỎ QUA (không báo lỗi giả); tạo ảnh chuẩn riêng bằng `npm run test:e2e:update-snapshots`.
import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { control } from "../support/mock";
import { expect, test } from "../support/test";

const FIXED = new Date("2026-10-23T09:00:00+07:00");
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, tablet: { width: 820, height: 1180 }, mobile: { width: 390, height: 844 } } as const;
const bell = '[data-testid="notification-bell"]';
const SHOT = { threshold: 0.1, maxDiffPixels: 50, animations: "disabled", caret: "hide" } as const;

const baselineDir = path.resolve(__dirname, "..", "__screenshots__", process.platform);
const hasBaselines = fs.existsSync(baselineDir);
let fontsReachable = false;

test.beforeAll(async () => {
  try {
    const res = await fetch("https://fonts.googleapis.com/css2?family=Inter&display=swap", { signal: AbortSignal.timeout(8000) });
    fontsReachable = res.ok;
  } catch {
    fontsReachable = false;
  }
});

test.beforeEach(async ({ page }, testInfo) => {
  const updating = testInfo.config.updateSnapshots === "all" || testInfo.config.updateSnapshots === "changed";
  test.skip(!hasBaselines && !updating, `Chưa có ảnh chuẩn cho nền tảng "${process.platform}". Tạo bằng: npm run test:e2e:update-snapshots`);
  test.skip(!fontsReachable, "Không truy cập được Google Fonts (cần Internet để chữ giống ảnh chuẩn)");
  await page.clock.setFixedTime(FIXED);
  await control({ now: FIXED.toISOString() });
});

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready); // font dùng bởi phần tử xuất hiện muộn (toast, dropdown)
  await page.waitForTimeout(1200);
}

type Scenario = { id: string; mock: Record<string, string | number>; act?: (page: Page) => Promise<void>; toast?: boolean; collapse?: boolean; openBell?: boolean; desktopOnly?: boolean };
const NO_TICKETS = { tickets: "none" } as const;
const SCENARIOS: Scenario[] = [
  { id: "default", mock: { notif: "empty", ...NO_TICKETS } },
  { id: "unread", mock: { ...NO_TICKETS } },
  { id: "unread-99", mock: { unread: 150, ...NO_TICKETS } },
  { id: "bell-open", mock: { ...NO_TICKETS }, openBell: true },
  { id: "toast", mock: { notif: "empty" }, toast: true },
  { id: "collapsed", mock: { ...NO_TICKETS }, collapse: true, desktopOnly: true },
];

const AREAS = [
  { name: "admin", role: "admin", path: "/admin/class-management", skip: [] as string[] },
  { name: "teacher", role: "teacher", path: "/instructor/list-class", skip: ["unread-99"] }, // trang thật (M4A), mục "Quản lý lớp học" active như ảnh chuẩn; chỉ chụp cột sidebar nên nội dung trang không ảnh hưởng
] as const;

for (const area of AREAS) {
  for (const sc of SCENARIOS) {
    if ((area.skip as readonly string[]).includes(sc.id)) continue;
    for (const [vpName, size] of Object.entries(VIEWPORTS)) {
      if (sc.desktopOnly && vpName !== "desktop") continue;
      test(`sidebar ${area.name} / ${sc.id} / ${vpName}`, async ({ page, app }) => {
        await control(sc.mock);
        await page.setViewportSize(size);
        await app.signIn(area.path, { role: area.role as "admin" | "teacher" });
        await app.waitForSidebar();
        if (sc.id !== "default" && sc.mock.notif !== "empty") await page.waitForSelector(".noti-badge");
        if (sc.toast) await page.waitForSelector('[data-testid="ticket-welcome-toast"]');
        if (sc.collapse) {
          await page.click(".sidebar-collapse-button");
          await page.waitForSelector(".management-sidebar-column.is-collapsed");
        }
        if (sc.openBell) {
          await page.click(bell);
          await page.waitForSelector(".sb-noti-item");
        }
        await settle(page);
        const name = `${area.name}-${sc.id}-${vpName}.png`;
        const column = page.locator(".management-sidebar-column");
        if (sc.openBell) {
          const b = (await column.boundingBox())!;
          const clip = { x: Math.max(0, b.x), y: Math.max(0, b.y), width: Math.min(size.width - b.x, b.width + 420), height: Math.min(size.height - b.y, 640) };
          await expect(page).toHaveScreenshot(name, { ...SHOT, clip });
        } else {
          await expect(column).toHaveScreenshot(name, SHOT);
        }
        if (sc.toast) await expect(page.locator('[data-testid="ticket-welcome-toast"] .ticket-toast-container, .ticket-toast-container').first()).toHaveScreenshot(`${area.name}-${sc.id}-${vpName}-toast.png`, SHOT);
        expect(app.problems).toEqual([]);
      });
    }
  }
}

for (const [vpName, size] of Object.entries(VIEWPORTS)) {
  test(`màn lớp học (/admin/class-management) toàn trang / ${vpName}`, async ({ page, app }) => {
    await control({ notif: "empty", ...NO_TICKETS });
    await page.setViewportSize(size);
    await app.signIn("/admin/class-management");
    await page.waitForSelector(".acm-table tbody tr.acm-row");
    await settle(page);
    await expect(page).toHaveScreenshot(`class-management-${vpName}.png`, { ...SHOT, fullPage: true });
  });

  // M5: route trong menu đều đã chuyển; placeholder chụp trên route HSK cũ hợp lệ chưa chuyển không có mục menu (ảnh chuẩn đổi có chủ đích: không còn tên mục menu).
  for (const [who, role, url] of [["admin", "admin", "/admin/profile"], ["teacher", "teacher", "/learning-path/manage"]] as const) {
    test(`placeholder ${who} (${url}) / ${vpName}`, async ({ page, app }) => {
      await control({ notif: "empty", ...NO_TICKETS });
      await page.setViewportSize(size);
      await app.signIn(url, { role });
      await page.waitForSelector('[data-testid="migration-placeholder"]');
      await settle(page);
      // Chụp riêng thẻ nội dung (ở tablet/mobile sidebar xếp trên cùng nên thẻ nằm dưới nếp gấp; chụp phần tử sẽ cuộn tới và đưa thẻ vào ảnh).
      await expect(page.locator('[data-testid="migration-placeholder"]')).toHaveScreenshot(`placeholder-${who}-${vpName}.png`, SHOT);
    });
  }
}

// Màn Tổng quan giảng viên (M3B.2). Đối chiếu với HSK cũ làm riêng bằng công cụ ngoài repo (xem docs/M3B2-WELCOME.md); ảnh ở đây để hồi quy về sau.
async function openWelcome(page: Page, app: { signIn: (path: string, o: { role: "teacher" }) => Promise<void> }) {
  await app.signIn("/instructor/welcome", { role: "teacher" });
  await page.waitForSelector(".welcome-hero-card");
  await page.locator(".ticket-toast-close").click({ timeout: 4000 }).catch(() => {}); // toast chào ở sidebar che một phần nội dung
}

for (const [vpName, size] of Object.entries(VIEWPORTS)) {
  test(`welcome giảng viên (có dữ liệu mock) / ${vpName}`, async ({ page, app }) => {
    await page.setViewportSize(size);
    await openWelcome(page, app);
    await expect(page.locator(".welcome-stat-card h3").first()).toHaveText("2");
    await expect(page.locator(".welcome-stat-card h3").last()).toHaveText("3");
    await settle(page);
    await expect(page.locator(".col-lg-9")).toHaveScreenshot(`welcome-teacher-${vpName}.png`, SHOT);
  });
}

test("welcome giảng viên: không có ticket/thông báo (số 0 thật) / desktop", async ({ page, app }) => {
  await control({ tickets: "none", notif: "empty" });
  await openWelcome(page, app);
  await expect(page.locator(".welcome-stat-card h3").first()).toHaveText("0");
  await settle(page);
  await expect(page.locator(".col-lg-9")).toHaveScreenshot("welcome-teacher-empty-desktop.png", SHOT);
});

test("welcome giảng viên: API ticket lỗi (— + thông báo, nút Thử lại) / desktop", async ({ page, app }) => {
  await control({ tickets: "error" });
  await openWelcome(page, app);
  await page.waitForSelector('[data-testid="welcome-data-notice"]');
  await settle(page);
  await expect(page.locator(".col-lg-9")).toHaveScreenshot("welcome-teacher-error-desktop.png", SHOT);
});

// Màn "Thông báo của tôi" giảng viên (M3B.3). Đối chiếu với HSK cũ làm riêng bằng công cụ ngoài repo (xem docs/M3B3-NOTIFICATIONS.md); ảnh ở đây để hồi quy về sau.
async function openNotifications(page: Page, app: { signIn: (path: string, o: { role: "teacher" }) => Promise<void> }, ready: string) {
  await control({ tickets: "none" });
  await app.signIn("/instructor/instructor-notifications", { role: "teacher" });
  await page.waitForSelector(ready);
}

for (const [vpName, size] of Object.entries(VIEWPORTS)) {
  test(`thông báo giảng viên (3 chưa đọc + 1 đã đọc) / ${vpName}`, async ({ page, app }) => {
    await page.setViewportSize(size);
    await openNotifications(page, app, ".notification-list-items > div");
    await settle(page);
    await expect(page.locator(".col-lg-9")).toHaveScreenshot(`notifications-teacher-${vpName}.png`, SHOT);
  });
}

test("thông báo giảng viên: rỗng / desktop", async ({ page, app }) => {
  await control({ notif: "empty" });
  await openNotifications(page, app, ".notification-list-items .isax-notification-bing");
  await settle(page);
  await expect(page.locator(".col-lg-9")).toHaveScreenshot("notifications-teacher-empty-desktop.png", SHOT);
});

test("thông báo giảng viên: API lỗi (khối lỗi + Thử lại) / desktop", async ({ page, app }) => {
  await control({ notif: "error" });
  await openNotifications(page, app, '[data-testid="notifications-data-notice"]');
  await page.locator("[data-sonner-toast]").first().waitFor({ state: "hidden", timeout: 8000 }).catch(() => {}); // toast lỗi che nội dung; chờ tự tắt
  await settle(page);
  await expect(page.locator(".col-lg-9")).toHaveScreenshot("notifications-teacher-error-desktop.png", SHOT);
});

test("thông báo giảng viên: có phân trang (25 thông báo) / desktop", async ({ page, app }) => {
  await control({ notifTotal: 25 });
  await openNotifications(page, app, ".pagination");
  await settle(page);
  await expect(page.locator(".col-lg-9")).toHaveScreenshot("notifications-teacher-paged-desktop.png", SHOT);
});

// Màn "Quản lý thông báo" của Admin (M3B.4). Đối chiếu với HSK cũ làm riêng bằng công cụ ngoài repo (xem docs/M3B4-ADMIN-NOTIFICATIONS.md); ảnh ở đây để hồi quy về sau.
// Dữ liệu = MOCK (người dùng/chiến dịch/gửi giả lập).
async function openAdminNotifications(page: Page, app: { signIn: (path: string, o: { role: "admin" }) => Promise<void> }) {
  await control({ tickets: "none" });
  await app.signIn("/admin/settings/notifications", { role: "admin" });
  await page.waitForSelector(".notification-list-items > div");
}

for (const [vpName, size] of Object.entries(VIEWPORTS)) {
  test(`admin thông báo: danh sách + hai nút / ${vpName}`, async ({ page, app }) => {
    await page.setViewportSize(size);
    await openAdminNotifications(page, app);
    await settle(page);
    await expect(page.locator(".col-lg-9")).toHaveScreenshot(`admin-notifications-${vpName}.png`, SHOT);
  });

  test(`admin thông báo: form gửi (đã chọn 2 người) / ${vpName}`, async ({ page, app }) => {
    await page.setViewportSize(size);
    await openAdminNotifications(page, app);
    await page.getByRole("button", { name: /Gửi Thông Báo Mới/ }).click();
    await page.getByLabel(/Tiêu đề thông báo/).fill("Thông báo bảo trì hệ thống");
    await page.getByLabel(/Nội dung thông báo/).fill("Hệ thống sẽ bảo trì lúc 22:00 tối nay.");
    await page.getByRole("button", { name: /Chọn người nhận/ }).click();
    const rows = page.getByTestId("recipient-selector-modal").getByTestId("recipient-row");
    await rows.first().waitFor();
    await rows.nth(0).getByRole("button", { name: "Chọn" }).click();
    await rows.nth(1).getByRole("button", { name: "Chọn" }).click();
    await page.getByTestId("recipient-selector-modal").getByRole("button", { name: /Hoàn tất chọn/ }).click();
    await settle(page);
    await expect(page.getByTestId("notification-composer")).toHaveScreenshot(`admin-notifications-composer-${vpName}.png`, SHOT);
  });

  test(`admin thông báo: modal chọn người nhận / ${vpName}`, async ({ page, app }) => {
    await page.setViewportSize(size);
    await openAdminNotifications(page, app);
    await page.getByRole("button", { name: /Gửi Thông Báo Mới/ }).click();
    await page.getByRole("button", { name: /Chọn người nhận/ }).click();
    const modal = page.getByTestId("recipient-selector-modal");
    await modal.getByTestId("recipient-row").first().waitFor();
    await modal.getByTestId("recipient-row").nth(1).getByRole("button", { name: "Chọn" }).click();
    await settle(page);
    await expect(page).toHaveScreenshot(`admin-notifications-recipients-${vpName}.png`, { ...SHOT, fullPage: false });
  });

  test(`admin thông báo: modal xác nhận gửi / ${vpName}`, async ({ page, app }) => {
    await page.setViewportSize(size);
    await openAdminNotifications(page, app);
    await page.getByRole("button", { name: /Gửi Thông Báo Mới/ }).click();
    await page.getByLabel(/Tiêu đề thông báo/).fill("Thông báo bảo trì hệ thống");
    await page.getByLabel(/Nội dung thông báo/).fill("Hệ thống sẽ bảo trì lúc 22:00 tối nay.");
    await page.getByRole("button", { name: /Chọn người nhận/ }).click();
    await page.getByTestId("recipient-selector-modal").getByTestId("recipient-row").first().getByRole("button", { name: "Chọn" }).click();
    await page.getByTestId("recipient-selector-modal").getByRole("button", { name: /Hoàn tất chọn/ }).click();
    await page.getByRole("button", { name: "Xem trước & Gửi" }).click();
    await page.getByTestId("campaign-preview-modal").waitFor();
    await settle(page);
    await expect(page).toHaveScreenshot(`admin-notifications-preview-${vpName}.png`, { ...SHOT, fullPage: false });
  });

  test(`admin thông báo: lịch sử chiến dịch / ${vpName}`, async ({ page, app }) => {
    await page.setViewportSize(size);
    await openAdminNotifications(page, app);
    await page.getByRole("button", { name: /Thông báo đã gửi/ }).click();
    await page.getByTestId("campaign-row").first().waitFor();
    await settle(page);
    await expect(page).toHaveScreenshot(`admin-notifications-history-${vpName}.png`, { ...SHOT, fullPage: false });
  });
}

test("admin thông báo: chi tiết một chiến dịch / desktop", async ({ page, app }) => {
  await openAdminNotifications(page, app);
  await page.getByRole("button", { name: /Thông báo đã gửi/ }).click();
  await page.getByTestId("campaign-row").first().click();
  await page.getByTestId("campaign-detail").waitFor();
  await settle(page);
  await expect(page).toHaveScreenshot("admin-notifications-history-detail-desktop.png", { ...SHOT, fullPage: false });
});

test("admin thông báo: modal người nhận lỗi API / desktop", async ({ page, app }) => {
  await control({ users: "error" });
  await openAdminNotifications(page, app);
  await page.getByRole("button", { name: /Gửi Thông Báo Mới/ }).click();
  await page.getByRole("button", { name: /Chọn người nhận/ }).click();
  await page.getByTestId("recipient-data-notice").waitFor();
  await page.locator("[data-sonner-toast]").first().waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
  await settle(page);
  await expect(page).toHaveScreenshot("admin-notifications-recipients-error-desktop.png", { ...SHOT, fullPage: false });
});

// Màn "Quản lý lớp học" của Giảng viên (M4A). Đối chiếu với HSK cũ làm riêng bằng công cụ ngoài repo (xem docs/M4A-LIST-CLASS.md); ảnh ở đây để hồi quy về sau.
// Dữ liệu = MOCK (25 lớp giả lập, ngày theo thời gian đóng băng).
async function openClassList(page: Page, app: { signIn: (path: string, o: { role: "teacher"; state?: "ok" | "empty" | "error" }) => Promise<void> }, state: "ok" | "empty" | "error" = "ok") {
  await control({ tickets: "none" });
  await app.signIn("/instructor/list-class", { role: "teacher", state });
  await page.waitForSelector(".card-header.bg-light");
  await page.waitForFunction(() => !document.querySelector(".card-body .spinner-border"));
}

for (const [vpName, size] of Object.entries(VIEWPORTS)) {
  test(`lớp học giảng viên: danh sách 25 lớp / ${vpName}`, async ({ page, app }) => {
    await page.setViewportSize(size);
    await openClassList(page, app);
    await settle(page);
    await expect(page.locator(".col-lg-9")).toHaveScreenshot(`instructor-class-list-${vpName}.png`, SHOT);
  });
}

test("lớp học giảng viên: trang 3 / desktop", async ({ page, app }) => {
  await openClassList(page, app);
  await page.locator(".ant-pagination").getByTitle("3").click();
  await settle(page);
  await expect(page.locator(".col-lg-9")).toHaveScreenshot("instructor-class-list-page3-desktop.png", SHOT);
});

test("lớp học giảng viên: lọc 'Ngày chính xác' / desktop", async ({ page, app }) => {
  await openClassList(page, app);
  await page.getByLabel("Thời gian").selectOption("EXACT");
  await settle(page);
  await expect(page.locator(".col-lg-9")).toHaveScreenshot("instructor-class-list-exact-desktop.png", SHOT);
});

test("lớp học giảng viên: rỗng / desktop", async ({ page, app }) => {
  await openClassList(page, app, "empty");
  await settle(page);
  await expect(page.locator(".col-lg-9")).toHaveScreenshot("instructor-class-list-empty-desktop.png", SHOT);
});

test("lớp học giảng viên: API lỗi (khối lỗi + Thử lại) / desktop", async ({ page, app }) => {
  await control({ tickets: "none" });
  await app.signIn("/instructor/list-class", { role: "teacher", state: "error" });
  await page.waitForSelector('[data-testid="class-list-notice"]');
  await page.locator("[data-sonner-toast]").first().waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
  await settle(page);
  await expect(page.locator(".col-lg-9")).toHaveScreenshot("instructor-class-list-error-desktop.png", SHOT);
});

// Màn "Danh sách bài học" của Giảng viên (M4B). Đối chiếu với HSK cũ (bản build production) làm riêng bằng công cụ ngoài repo (xem docs/M4B-LIST-LESSON.md); ảnh ở đây để hồi quy về sau.
// Dữ liệu = MOCK (lớp mock-tc-4, 23 buổi trả đảo ngược thứ tự).
async function openLessonList(page: Page, app: { signIn: (path: string, o: { role: "teacher"; state?: "ok" | "empty" | "error" }) => Promise<void> }, query = "?classId=mock-tc-4&courseId=mock-course-0", state: "ok" | "empty" | "error" = "ok") {
  await control({ tickets: "none" });
  await app.signIn(`/instructor/list-class/list-lesson${query}`, { role: "teacher", state });
  await page.waitForSelector(".card-header.bg-light");
  await page.waitForFunction(() => !document.querySelector(".card-body .spinner-border"));
}

for (const [vpName, size] of Object.entries(VIEWPORTS)) {
  test(`bài học giảng viên: danh sách 23 buổi / ${vpName}`, async ({ page, app }) => {
    await page.setViewportSize(size);
    await openLessonList(page, app);
    await settle(page);
    await expect(page.locator(".col-lg-9")).toHaveScreenshot(`instructor-lesson-list-${vpName}.png`, SHOT);
  });
}

test("bài học giảng viên: trang 3 qua ?page=3 / desktop", async ({ page, app }) => {
  await openLessonList(page, app, "?classId=mock-tc-4&courseId=mock-course-0&page=3");
  await settle(page);
  await expect(page.locator(".col-lg-9")).toHaveScreenshot("instructor-lesson-list-page3-desktop.png", SHOT);
});

test("bài học giảng viên: tìm kiếm / desktop", async ({ page, app }) => {
  await openLessonList(page, app);
  await page.getByLabel("Tìm kiếm").fill("chủ đề 1");
  await settle(page);
  await expect(page.locator(".col-lg-9")).toHaveScreenshot("instructor-lesson-list-search-desktop.png", SHOT);
});

test("bài học giảng viên: rỗng / desktop", async ({ page, app }) => {
  await openLessonList(page, app, undefined, "empty");
  await settle(page);
  await expect(page.locator(".col-lg-9")).toHaveScreenshot("instructor-lesson-list-empty-desktop.png", SHOT);
});

test("bài học giảng viên: API lỗi (khối lỗi + Thử lại) / desktop", async ({ page, app }) => {
  await control({ tickets: "none" });
  await app.signIn("/instructor/list-class/list-lesson?classId=mock-tc-4&courseId=mock-course-0", { role: "teacher", state: "error" });
  await page.waitForSelector('[data-testid="lesson-list-notice"]');
  await page.locator("[data-sonner-toast]").first().waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
  await settle(page);
  await expect(page.locator(".col-lg-9")).toHaveScreenshot("instructor-lesson-list-error-desktop.png", SHOT);
});

test("bài học giảng viên: thiếu classId (thông báo, không gọi API) / desktop", async ({ page, app }) => {
  await control({ tickets: "none" });
  await app.signIn("/instructor/list-class/list-lesson", { role: "teacher" });
  await page.waitForSelector('[data-testid="lesson-list-notice"]');
  await settle(page);
  await expect(page.locator(".col-lg-9")).toHaveScreenshot("instructor-lesson-list-missing-class-desktop.png", SHOT);
});
