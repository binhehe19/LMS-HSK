import type { Page, Route } from "@playwright/test";

// Chặn một API (khác origin với app) và trả phản hồi giả có đủ header CORS, kể cả bước preflight. Dùng để dựng tình huống cụ thể (lỗi 500, rỗng, chậm...)
// mà mock server không mô phỏng. Chỉ nằm trong e2e/, không bao giờ trong code app.
export type StubReply = { status?: number; body?: unknown } | "abort";

const cors = (origin: string | undefined) => ({
  "access-control-allow-origin": origin ?? "*",
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
});

export async function stubApi(page: Page, url: RegExp, reply: (route: Route) => StubReply | Promise<StubReply>) {
  await page.route(url, async (route) => {
    const request = route.request();
    const headers = cors(request.headers()["origin"]);
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const r = await reply(route);
    if (r === "abort") return route.abort("failed");
    const status = r.status ?? 200;
    return route.fulfill({
      status,
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(status >= 400 ? { success: false, errorMessage: "lỗi giả lập (stub)" } : { success: true, data: r.body ?? null }),
    });
  });
}

export const ME = /\/api\/auth\/users\/me$/;
export const CLASSES = /\/api\/quiz\/grading\/admin\/classes$/;

// M5: notification-client theo hợp đồng thật của repo-notification => đường dẫn /notifications/unread-count (trước: /unread-count).
export const UNREAD = /\/api\/notification\/notifications\/unread-count$/;
export const NOTIFICATIONS = /\/api\/notification\/notifications(\?|$)/;
export const TICKETS = /\/api\/tickets(\?|$)/;
export const LOGOUT = /\/api\/auth\/logout$/;

/**
 * Dựng một phiên hoàn toàn bằng stub (không dùng phiên của mock server): người dùng + API lớp + thông báo/ticket rỗng + logout.
 * Cần đủ các API sidebar gọi, nếu không chúng chạm mock server không có cookie → 401 → hết phiên → chuyển Auth.
 */
export async function stubSession(page: Page, opts: { user: unknown; classes?: StubReply | (() => StubReply | Promise<StubReply>) }) {
  await stubApi(page, ME, () => ({ body: opts.user }));
  await stubApi(page, UNREAD, () => ({ body: 0 }));
  await stubApi(page, TICKETS, () => ({ body: [] }));
  await stubApi(page, LOGOUT, () => ({ body: null }));
  if (opts.classes !== undefined) {
    const c = opts.classes;
    await stubApi(page, CLASSES, () => (typeof c === "function" ? c() : c));
  }
}
