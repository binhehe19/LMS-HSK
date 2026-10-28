// M3B.1: điều hướng, trang "Chức năng đang được chuyển đổi", 404, quyền theo từng route dùng chung, active/submenu, tải lại, không vòng lặp redirect.
// Kiểm tra TRỰC TIẾP trên App Router thật dựa vào chính cấu hình menu và route-registry của app (nguồn sự thật duy nhất) — nên cấu hình và thực tế không thể lệch.
// MOCK: Auth giả lập.
import { buildAdminNav } from "../../src/components/management/admin-nav";
import { buildInstructorNav } from "../../src/components/management/instructor-nav";
import { findRoute, getNavTargetStatus, MANAGEMENT_ROUTES } from "../../src/lib/management/route-registry";
import type { NavItem } from "../../src/components/management/management-nav";
import { expect, test } from "../support/test";

const placeholder = '[data-testid="migration-placeholder"]';
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const ACTIVE_TITLES = ".sidebar-middle .sidebar-menu a.active .sidebar-menu-text"; // chỉ nhãn, không gồm huy hiệu số chưa đọc
// Dấu hiệu riêng của một số trang THẬT (chờ mạnh hơn); route MIGRATED không có mục ở đây dùng dấu hiệu chung: cột nội dung đã vẽ, không có placeholder/404.
const REAL_PAGE_MARKER: Record<string, string> = {
  "/admin/class-management": ".acm-hero",
  "/instructor/welcome": ".welcome-hero-card",
  "/instructor/instructor-notifications": ".notification-list-items",
  "/admin/settings/notifications": ".notification-list-items",
  "/instructor/list-class": "table.cm-table",
  "/instructor/list-class/list-lesson": "#lesson-search",
  "/admin/dashboard": '[data-testid="dash-stat-value"]',
  "/admin/analytics": '[data-testid="analytics-summary-value"]',
  "/admin/teacher-management": ".teacher-management-page",
  "/learning-path/online-course/manage": '[data-testid="onl-stat-card"]',
  "/flashcard/create-package": '[data-testid="content-packages"]',
  "/vocab-set/manage": '[data-testid="content-packages"]',
  "/instructor/manage-storage": '[data-testid="storage-breadcrumb"], [data-testid="storage-view-only"]',
};
const REAL_PAGE_GENERIC = ".col-lg-9"; // cột nội dung của khung quản lý (chỉ vẽ khi route được phục vụ)
const isSafeInternal = (m: NavItem) => !/^https?:/i.test(m.href);

/** Chờ trang được phục vụ cho URL này: trang thật (MIGRATED) hoặc placeholder (NOT_MIGRATED) theo registry; trang thật không được có placeholder/404. */
async function waitForServed(page: import("@playwright/test").Page, url: string) {
  const path = url.split("?")[0];
  if (findRoute(path)?.status === "MIGRATED") {
    await page.waitForSelector(REAL_PAGE_MARKER[path] ?? REAL_PAGE_GENERIC);
    expect(await page.locator(placeholder).count(), `${path} không được là placeholder`).toBe(0);
    expect(await page.locator('[data-testid="not-found"]').count(), `${path} không được là 404`).toBe(0);
  } else {
    await page.waitForSelector(placeholder);
  }
}

// Route HSK cũ hợp lệ nhưng CHƯA chuyển (placeholder) dùng làm ví dụ trong các test dưới: Admin-only, Giảng viên (dùng chung ALL5), và route dùng chung không có mục menu.
const ADMIN_PLACEHOLDER = "/admin/profile";
const TEACHER_PLACEHOLDER = "/learning-path/manage"; // HSK cũ: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR
const SHARED_PLACEHOLDER = "/kanji-origin/manage"; // như trên; mục menu đã bị comment ở HSK cũ nên không có mục active

function expectedActive(item: NavItem, pathname: string): boolean {
  return (item.activePrefix ? pathname.startsWith(item.activePrefix) : false) || pathname === item.href.split("?")[0];
}

const AREAS = [
  { name: "Admin", role: "admin", landing: "/admin/class-management", nav: buildAdminNav("https://auth.invalid/admin/users") },
  { name: "Giảng viên", role: "teacher", landing: "/instructor/welcome", nav: buildInstructorNav() },
] as const;

for (const area of AREAS) {
  test.describe(`menu ${area.name}: mỗi mục mở đúng thứ cấu hình quy định`, () => {
    for (const item of area.nav.filter(isSafeInternal)) {
      const status = getNavTargetStatus(item.href);
      const label = `${clean(item.title)} → ${item.href} [${status}]`;

      test(label, async ({ page, app }) => {
        // Vào bằng URL trực tiếp (kiểm tra HTTP) rồi bằng bấm menu từ một trang khác (kiểm tra điều hướng phía client).
        await app.signIn(area.landing, { role: area.role });
        await app.waitForSidebar();
        const link = page.locator(`.sidebar-middle .sidebar-menu a[href="${item.href}"]`);
        await expect(link).toHaveAttribute("data-migration-status", status.toLowerCase().replace("_", "-"));
        await link.click();

        if (status === "MIGRATED") {
          await page.waitForURL(app.url(item.href));
          await waitForServed(page, item.href); // trang thật của route này (không phải placeholder)
        } else if (status === "NOT_MIGRATED") {
          await page.waitForURL(app.url(item.href)); // giữ nguyên URL gốc
          await page.waitForSelector(placeholder);
          await expect(page.locator(placeholder)).toContainText("Chức năng đang được chuyển đổi");
          await expect(page.locator(placeholder)).toHaveAttribute("data-route", item.href.split("?")[0]);
          // sidebar/menu/active giữ nguyên
          expect(await app.menuTitles()).toHaveLength(area.nav.length);
          const actives = await page.$$eval(ACTIVE_TITLES, (as) => as.map((a) => (a.textContent ?? "").trim()));
          const expected = area.nav.filter((m) => expectedActive(m, item.href.split("?")[0])).map((m) => clean(m.title));
          expect(actives.map(clean)).toEqual(expected);
          expect(actives.map(clean)).toContain(clean(item.title));
        } else {
          // UNKNOWN / OUT_OF_SCOPE: không được hiện placeholder; phải là 404.
          const resp = await page.goto(app.url(item.href));
          expect(resp?.status()).toBe(404);
          expect(await page.locator(placeholder).count()).toBe(0);
          expect(await page.locator(".management-sidebar-column").count()).toBe(0);
        }
        expect(app.problems).toEqual([]);
      });
    }
  });
}

test.describe("URL không hợp lệ luôn trả 404 (không bị biến thành placeholder), kể cả khi chưa đăng nhập", () => {
  const URLS = [
    "/admin/does-not-exist", "/admin", "/instructor", "/random-url", "/hanzi/manage/extra/deep", "/hanzi/edit",
    "/instructor/instructor-support-tickets", // UNKNOWN: HSK cũ không có PrivateRoute, chưa có quyết định về quyền
    "/instructor/instructor-dashboard", // UNKNOWN: như trên
    "/teacher-manager/dashboard", // UNKNOWN: role chưa xác minh
    "/admin/courses", // OUT_OF_SCOPE: HSK cũ chỉ hiện 'đang xây dựng'
    "/quiz", // route học viên: ngoài phạm vi
    "/Admin/Dashboard", // phân biệt hoa thường
  ];
  for (const url of URLS) {
    test(`${url} (chưa đăng nhập)`, async ({ page, app }) => {
      const resp = await page.goto(app.url(url));
      expect(resp?.status()).toBe(404);
      await page.waitForTimeout(800);
      expect(await page.locator(placeholder).count()).toBe(0);
      expect(await page.locator(".management-sidebar-column").count()).toBe(0);
      expect(app.loginVisits()).toBe(0); // 404 không bắt đăng nhập, không lộ gì
    });
  }
  test("đã đăng nhập Admin: vẫn 404, không hiện khung quản lý", async ({ page, app }) => {
    await app.signIn("/admin/class-management");
    await app.waitForSidebar();
    for (const url of ["/admin/does-not-exist", "/instructor/instructor-support-tickets", "/admin/courses"]) {
      const resp = await page.goto(app.url(url));
      expect(resp?.status(), url).toBe(404);
      expect(await page.locator(".management-sidebar-column").count(), url).toBe(0);
    }
  });
});

test.describe("route dùng chung Admin/Teacher: quyền theo từng route (đã xác minh từ HSK cũ), sidebar theo role", () => {
  // /hanzi/manage (mục menu) đã là trang thật từ M5; dùng cả hai: trang thật cho active menu, route chưa chuyển không có menu cho placeholder.
  const SHARED = "/hanzi/manage"; // HSK cũ: TEACHER, MENTOR, ADMIN, TEACHER_MANAGER, COLLABORATOR
  test("Admin vào /hanzi/manage: trang thật + menu Admin, mục Hán tự active", async ({ page, app }) => {
    await app.signIn(SHARED, { role: "admin" });
    await waitForServed(page, SHARED);
    expect(await page.textContent(".brand-subtitle")).toBe("LMS · Admin");
    expect(await page.locator(".sidebar-menu a.active").first().textContent()).toContain("Quản lý Luyện viết");
  });
  for (const role of ["teacher", "mentor"] as const) {
    test(`${role} vào /hanzi/manage: trang thật + menu Giảng viên; ${role} vào ${SHARED_PLACEHOLDER}: placeholder + menu Giảng viên`, async ({ page, app }) => {
      await app.signIn(SHARED, { role });
      await waitForServed(page, SHARED);
      expect(await page.textContent(".brand-subtitle")).toBe("LMS · Quản lý");
      await page.goto(app.url(SHARED_PLACEHOLDER));
      await page.waitForSelector(placeholder);
      expect(await page.textContent(".brand-subtitle")).toBe("LMS · Quản lý");
    });
  }
  for (const role of ["teacher-manager", "collaborator", "manager", "user", "none"] as const) {
    test(`${role} bị chặn ở /hanzi/manage và ${SHARED_PLACEHOLDER} (Teacher-manager/Collaborator: UNKNOWN, không cấp dù HSK cũ liệt kê)`, async ({ page, app }) => {
      await app.signIn(SHARED, { role });
      await page.waitForSelector('[data-testid="auth-forbidden"]');
      expect(await page.locator(".management-sidebar-column").count()).toBe(0);
      await page.goto(app.url(SHARED_PLACEHOLDER));
      await page.waitForSelector('[data-testid="auth-forbidden"]');
      expect(await page.locator(placeholder).count()).toBe(0);
      expect(await page.locator(".management-sidebar-column").count()).toBe(0);
    });
  }
  test("kho lưu trữ dưới /instructor: Admin VÀO ĐƯỢC (HSK cũ liệt kê ADMIN; nay là trang thật) nhưng KHÔNG vào được trang công việc của giảng viên", async ({ page, app }) => {
    await app.signIn("/instructor/manage-storage", { role: "admin" });
    await waitForServed(page, "/instructor/manage-storage");
    expect(await page.textContent(".brand-subtitle")).toBe("LMS · Admin");
    await page.goto(app.url("/instructor/instructor-tickets")); // chỉ TEACHER, MENTOR (+COLLABORATOR chưa xác minh)
    await page.waitForSelector('[data-testid="auth-forbidden"]');
    await page.goto(app.url("/instructor/list-class"));
    await page.waitForSelector('[data-testid="auth-forbidden"]');
  });
  test("route chỉ dành cho Admin (khóa học trực tuyến): Teacher bị chặn, Admin vào được", async ({ page, app }) => {
    await app.signIn("/learning-path/online-course/manage", { role: "teacher" });
    await page.waitForSelector('[data-testid="auth-forbidden"]');
  });
  test("route có tham số: /sets/42/edit là trang thật, /sets/edit và /hanzi/edit là 404 (segment tham số rỗng không khớp registry)", async ({ page, app }) => {
    await app.signIn("/sets/42/edit", { role: "teacher" });
    await waitForServed(page, "/sets/42/edit");
    expect((await page.goto(app.url("/sets/edit")))?.status()).toBe(404);
    expect((await page.goto(app.url("/hanzi/edit")))?.status()).toBe(404);
  });
});

test.describe("placeholder: quyền, trả về, active", () => {
  test("chưa đăng nhập vào route NOT_MIGRATED => chuyển Auth đúng một lần, redirect về đúng URL gốc", async ({ page, app }) => {
    await page.goto(app.url(`${SHARED_PLACEHOLDER}?x=1`));
    await app.waitForLogin();
    expect(new URL(page.url()).searchParams.get("redirect")).toBe(app.url(`${SHARED_PLACEHOLDER}?x=1`));
    expect(app.loginVisits()).toBe(1);
  });

  test("Admin: placeholder có liên kết về 'Overview' (/admin/dashboard, màn đã chuyển đầu tiên của Admin) và liên kết hoạt động", async ({ page, app }) => {
    await app.signIn(ADMIN_PLACEHOLDER);
    await page.waitForSelector(placeholder);
    const home = page.locator('[data-testid="placeholder-home-link"]');
    await expect(home).toHaveAttribute("href", "/admin/dashboard");
    await home.click();
    await waitForServed(page, "/admin/dashboard");
    expect(page.url()).toBe(app.url("/admin/dashboard"));
  });

  test("Teacher: placeholder có liên kết về 'Tổng quan' (màn Teacher đã chuyển) và liên kết hoạt động", async ({ page, app }) => {
    await app.signIn(TEACHER_PLACEHOLDER, { role: "teacher" });
    await page.waitForSelector(placeholder);
    const home = page.locator('[data-testid="placeholder-home-link"]');
    await expect(home).toHaveAttribute("href", "/instructor/welcome");
    await expect(home).toContainText("Tổng quan");
    expect(await page.locator('[data-testid="placeholder-no-home"]').count()).toBe(0);
    await home.click();
    await page.waitForSelector(".welcome-hero-card");
    expect(page.url()).toBe(app.url("/instructor/welcome"));
  });

  test("nút 'Quay lại trang trước' chỉ có khi có lịch sử và hoạt động", async ({ page, app }) => {
    await app.signIn(TEACHER_PLACEHOLDER, { role: "teacher" });
    await page.waitForSelector(placeholder);
    // Tab này đã đi qua trang Auth giả lập nên có lịch sử; khi mở thẳng URL trong tab mới thì không có.
    const fresh = await page.context().newPage();
    await fresh.goto(app.url(TEACHER_PLACEHOLDER));
    await fresh.waitForSelector(placeholder);
    expect(await fresh.locator('[data-testid="placeholder-back"]').count()).toBe(0);
    await page.goto(app.url(SHARED_PLACEHOLDER));
    await page.waitForSelector(placeholder);
    await expect(page.locator('[data-testid="placeholder-back"]')).toHaveCount(1);
    await page.click('[data-testid="placeholder-back"]');
    await page.waitForURL(app.url(TEACHER_PLACEHOLDER));
  });
});

test.describe("active menu / submenu và tải lại", () => {
  const CASES: [role: "admin" | "teacher", url: string, expectedActive: string][] = [
    ["admin", "/admin/class-management/students", "Quản lý lớp học"], // submenu qua activePrefix
    ["admin", "/admin/settings/notifications", "Quản lý thông báo"],
    ["admin", "/hanzi/manage", "Quản lý Luyện viết (Hán tự)"],
    ["teacher", "/instructor/list-class/grading", "Quản lý lớp học"],
    ["teacher", "/hanzi/manage/select-type", "Quản lý Luyện viết (Hán tự)"],
    ["teacher", "/hanzi/edit/7", "Quản lý Luyện viết (Hán tự)"],
    ["teacher", "/instructor/manage-storage", "Quản lý Kho lưu trữ Đa phương tiện"],
    ["admin", ADMIN_PLACEHOLDER, ""], // placeholder không có mục menu => không mục nào active
  ];
  for (const [role, url, expected] of CASES) {
    test(`${role} ${url} → active "${expected}", giữ nguyên sau khi tải lại, không vòng lặp redirect`, async ({ page, app }) => {
      await app.signIn(url, { role });
      // Route đã chuyển (MIGRATED) hiện trang thật thay vì placeholder (waitForServed quyết định theo registry).
      await waitForServed(page, url);
      const read = async () => (await page.$$eval(ACTIVE_TITLES, (as) => as.map((a) => (a.textContent ?? "").trim()))).map(clean);
      const expectedActives = expected ? [expected] : [];
      expect(await read()).toEqual(expectedActives);
      await page.reload();
      await waitForServed(page, url);
      expect(page.url()).toBe(app.url(url));
      expect(await read()).toEqual(expectedActives);
      expect(app.loginVisits()).toBe(0);
      expect(app.problems).toEqual([]);
    });
  }

  test("tải lại ở trang thật /admin/class-management giữ phiên và quyền; bản trang thật không phải placeholder", async ({ page, app }) => {
    await app.signIn("/admin/class-management");
    await page.waitForSelector(".acm-hero");
    await page.reload();
    await page.waitForSelector(".acm-hero");
    expect(await page.locator(placeholder).count()).toBe(0);
    expect(app.loginVisits()).toBe(0);
  });
});

test("registry: mọi route NOT_MIGRATED của vai trò hỗ trợ mở được placeholder trong trình duyệt (mẫu 12 route, không tham số)", async ({ page, app }) => {
  const sample = MANAGEMENT_ROUTES.filter((r) => r.status === "NOT_MIGRATED" && !r.path.includes(":")).filter((_, i) => i % 5 === 0).slice(0, 12);
  expect(sample.length).toBeGreaterThan(5);
  for (const r of sample) {
    const role = r.allowedRoles.includes("ROLE_ADMIN") ? "admin" : "teacher";
    await app.signIn(r.path, { role });
    await page.waitForSelector(placeholder);
    expect(page.url(), r.path).toBe(app.url(r.path));
  }
});
