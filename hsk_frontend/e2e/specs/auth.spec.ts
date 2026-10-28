// Luồng Authentication M2 trên trình duyệt thật với máy chủ GIẢ LẬP (MOCK — chưa kiểm chứng với Auth thật).
// Port từ kịch bản m2-auth.mjs (34 kiểm tra) + m2-runtime-guard.mjs.
import { AUTH_LOGIN_URL, control, mockState, MOCK_PUBLIC, ROLES } from "../support/mock";
import { expect, test } from "../support/test";

const ROUTE = "/admin/class-management";
const rows = (page: import("@playwright/test").Page) => page.locator(".acm-table tbody tr.acm-row");
const waitRows = (page: import("@playwright/test").Page) => page.waitForSelector(".acm-table tbody tr.acm-row");
const testId = (page: import("@playwright/test").Page, id: string) => page.waitForSelector(`[data-testid="${id}"]`);

test("chưa đăng nhập => chuyển Auth /login?redirect=<đúng URL ban đầu gồm query>, đúng một lần (không bypass)", async ({ page, app }) => {
  await page.goto(`${app.url(ROUTE)}?foo=bar`);
  await app.waitForLogin();
  expect(new URL(page.url()).searchParams.get("redirect")).toBe(`${app.url(ROUTE)}?foo=bar`);
  expect(app.loginVisits()).toBe(1);
});

test("đăng nhập cookie (như production): về đúng route + query, tải lại và tab mới giữ phiên, không token trong web storage", async ({ page, app, context }) => {
  await app.signIn(`${ROUTE}?foo=bar`);
  await waitRows(page);
  expect(page.url()).toBe(`${app.url(ROUTE)}?foo=bar`);
  await expect(rows(page)).toHaveCount(10);
  await page.reload();
  await waitRows(page);
  expect(page.url()).toBe(`${app.url(ROUTE)}?foo=bar`);
  expect(app.loginVisits()).toBe(0);
  const tab2 = await context.newPage();
  await tab2.goto(app.url(ROUTE));
  await waitRows(tab2);
  expect(tab2.url()).toBe(app.url(ROUTE));
  const noTokenInStorage = await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)].every((v) => !/mock|eyJ/.test(String(v))));
  expect(noTokenInStorage).toBe(true);
  expect((await context.cookies(MOCK_PUBLIC)).some((c) => c.name === "access_token" && c.httpOnly)).toBe(true);
  expect(app.problems).toEqual([]);
});

test("đăng nhập hash (dev/staging khác miền gốc): URL được dọn token, token chỉ ở bộ nhớ; tải lại mất token => đi vòng Auth đúng một lần", async ({ page, app, context }) => {
  await app.signIn(ROUTE, { transport: "hash" });
  await waitRows(page);
  expect(page.url()).toBe(app.url(ROUTE));
  expect(page.url()).not.toContain("access_token");
  const stored = await page.evaluate(() => [...Object.entries(localStorage), ...Object.entries(sessionStorage)].filter(([, v]) => /eyJ/.test(String(v))).length);
  expect(stored).toBe(0);
  expect((await context.cookies(MOCK_PUBLIC)).some((c) => c.name === "access_token")).toBe(false);
  await page.reload();
  await app.waitForLogin();
  expect(app.loginVisits()).toBe(1);
});

test("callback hash rác: bị bỏ qua, hash được dọn, rồi chuyển Auth (redirect không chứa token)", async ({ page, app }) => {
  await page.goto(`${app.url(ROUTE)}#access_token=garbage&refresh_token=nope`);
  await app.waitForLogin();
  expect(new URL(page.url()).searchParams.get("redirect") ?? "").not.toMatch(/access_token|garbage/);
  expect(app.loginVisits()).toBe(1);
});

test("token giả dạng JWT bị server từ chối => 'Chưa thiết lập được phiên', không tự chuyển Auth lần nữa; chỉ khi bấm 'Đăng nhập lại'", async ({ page, app }) => {
  await page.goto(app.url(ROUTE));
  await app.waitForLogin();
  await app.signIn(ROUTE, { transport: "hash", bad: "1" });
  await testId(page, "auth-redirect-loop");
  expect(app.loginVisits()).toBe(1);
  expect(page.url()).toBe(app.url(ROUTE));
  const before = app.loginVisits();
  await page.getByRole("button", { name: "Đăng nhập lại" }).click();
  await app.waitForLogin();
  expect(app.loginVisits()).toBe(before + 1);
});

test.describe("ma trận role trên luồng thật (cookie)", () => {
  const MATRIX: [string, boolean, boolean][] = [
    ["admin", true, false], ["teacher", false, true], ["mentor", false, true], ["teacher-manager", false, false],
    ["manager", false, false], ["collaborator", false, false], ["user", false, false], ["none", false, false],
  ];
  test("danh sách role khớp mock", () => {
    expect(MATRIX.map((m) => m[0]).sort()).toEqual([...ROLES].sort());
  });
  for (const [role, adminOk, instructorOk] of MATRIX) {
    test(`role ${role}: /admin ${adminOk ? "vào được" : "bị chặn"}, /instructor/list-class ${instructorOk ? "vào được" : "bị chặn"}`, async ({ page, app }) => {
      await app.signIn(ROUTE, { role: role as (typeof ROLES)[number] });
      const adminState = await Promise.race([waitRows(page).then(() => "page"), testId(page, "auth-forbidden").then(() => "forbidden")]);
      await page.goto(app.url("/instructor/list-class/submissions")); // cùng quyền TEACHER/MENTOR như /instructor/list-class; trang thật (M5), thiếu query => dòng thông báo tham số
      const insState = await Promise.race([testId(page, "submissions-notice").then(() => "page"), testId(page, "auth-forbidden").then(() => "forbidden")]);
      expect(adminState === "page").toBe(adminOk);
      expect(insState === "page").toBe(instructorOk);
    });
  }
});

for (const transport of ["cookie", "hash"] as const) {
  test(`refresh thành công (${transport}): access hết hạn => đúng 1 lần refresh rồi vào trang, không chuyển Auth`, async ({ page, app }) => {
    await app.signIn(ROUTE, { transport, access: "expired", refresh: "ok" });
    await waitRows(page);
    const st = await mockState();
    expect(st.counters.refresh).toBe(1);
    expect(app.loginVisits()).toBe(0);
  });
}

test("refresh bị từ chối (401) => hết phiên, chuyển Auth đúng một lần, không lặp", async ({ app }) => {
  await app.signIn(ROUTE, { access: "expired", refresh: "fail" });
  await app.waitForLogin();
  const st = await mockState();
  expect(app.loginVisits()).toBe(1);
  expect(st.counters.refresh).toBeGreaterThanOrEqual(1);
  expect(st.counters.refresh).toBeLessThanOrEqual(2);
});

test("Auth refresh lỗi 500 => panel lỗi + Thử lại, KHÔNG chuyển Auth, KHÔNG vào trang", async ({ page, app }) => {
  await app.signIn(ROUTE, { access: "expired", refresh: "down" });
  await testId(page, "auth-error");
  expect(app.loginVisits()).toBe(0);
  expect(page.url()).toBe(app.url(ROUTE));
  await expect(rows(page)).toHaveCount(0);
});

test("/users/me lỗi 500 => panel lỗi (không chuyển Auth); Auth phục hồi + 'Thử lại' => vào trang", async ({ page, app }) => {
  await app.signIn(ROUTE);
  await waitRows(page);
  await control({ meDown: 1 });
  await page.reload();
  await testId(page, "auth-error");
  expect(app.loginVisits()).toBe(0);
  await expect(rows(page)).toHaveCount(0);
  await control({ meDown: 0 });
  await page.getByRole("button", { name: "Thử lại" }).click();
  await waitRows(page);
});

test("mất kết nối tới Auth => panel lỗi (không nhầm là chưa đăng nhập, không chuyển Auth)", async ({ page, app }) => {
  await app.signIn(ROUTE);
  await waitRows(page);
  await page.route(/\/api\/auth\//, (route) => route.abort("failed"));
  await page.reload();
  await testId(page, "auth-error");
  expect(app.loginVisits()).toBe(0);
  await expect(rows(page)).toHaveCount(0);
});

test("API nghiệp vụ 401 một lần => refresh 1 lần, thử lại, hiện dữ liệu (không chuyển Auth)", async ({ page, app }) => {
  await control({ classes401: "once" });
  await app.signIn(ROUTE);
  await waitRows(page);
  const st = await mockState();
  expect(st.counters.refresh).toBe(1);
  // Strict mode ở dev gọi effect hai lần; production gọi một lần: chấp nhận 2–3 lần gọi classes (1 lần 401 + thử lại).
  expect(st.counters.classes).toBeGreaterThanOrEqual(2);
  expect(st.counters.classes).toBeLessThanOrEqual(3);
  expect(app.loginVisits()).toBe(0);
});

test("API nghiệp vụ 401 + refresh bị từ chối => hết phiên, chuyển Auth một lần", async ({ app }) => {
  await control({ classes401: "always" });
  await app.signIn(ROUTE, { refresh: "fail" });
  await app.waitForLogin();
  expect(app.loginVisits()).toBe(1);
});

test("đăng xuất (cookie): POST /logout, xóa cookie, về Auth /login KHÔNG kèm redirect; vào lại route bảo vệ phải đăng nhập", async ({ page, app, context }) => {
  await app.signIn(ROUTE);
  await waitRows(page);
  await page.getByRole("link", { name: "Đăng xuất" }).click();
  await app.waitForLogin();
  const st = await mockState();
  expect(st.counters.logout).toBe(1);
  expect((await context.cookies(MOCK_PUBLIC)).some((c) => c.name === "access_token" && c.value)).toBe(false);
  expect(new URL(page.url()).pathname).toMatch(/\/login$/); // /__auth/login (gateway) hoặc /login (mock trực tiếp)
  expect(new URL(page.url()).search).toBe(""); // KHÔNG kèm redirect
  const page2 = await context.newPage();
  await page2.goto(app.url(ROUTE));
  await page2.waitForURL(AUTH_LOGIN_URL);
  expect(app.problems).toEqual([]);
});

test("đăng xuất (hash): POST /logout kèm refresh token, phiên phía server bị xóa", async ({ page, app }) => {
  await app.signIn(ROUTE, { transport: "hash" });
  await waitRows(page);
  await page.getByRole("link", { name: "Đăng xuất" }).click();
  await app.waitForLogin();
  const st = await mockState();
  expect(st.counters.logout).toBe(1);
  expect(st.sessions).toBe(0);
});

