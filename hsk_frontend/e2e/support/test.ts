import { expect, test as base, type Page } from "@playwright/test";
import { AUTH_LOGIN_URL, isAllowedE2eUrl, mockLoginUrl, resetMock, type LoginOptions } from "./mock";

export interface App {
  /** URL tuyệt đối trên app đang kiểm thử. */
  url(path: string): string;
  /** Đăng nhập qua trang Auth GIẢ LẬP rồi quay lại `path` (đúng luồng trình duyệt thật: Auth → cookie/hash → app). */
  signIn(path: string, options?: LoginOptions): Promise<void>;
  /** Chờ tới khi trình duyệt bị chuyển sang trang đăng nhập của mock Auth. */
  waitForLogin(): Promise<void>;
  /** Số lần trình duyệt điều hướng tới trang đăng nhập của Auth (>1 = có vòng lặp chuyển hướng). */
  loginVisits(): number;
  /** Cảnh báo hydration / lỗi trang thu được trong console. */
  problems: string[];
  /** Chờ sidebar quản lý hiện ra. */
  waitForSidebar(): Promise<void>;
  /** Nhãn các mục menu chính trong sidebar, theo thứ tự. */
  menuTitles(): Promise<string[]>;
}

function track(page: Page, problems: string[]) {
  const visits: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && AUTH_LOGIN_URL.test(frame.url())) visits.push(frame.url());
  });
  page.on("console", (m) => {
    if (/hydrat|did not match/i.test(m.text())) problems.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  return visits;
}

export const test = base.extend<{ app: App }>({
  // Mỗi test bắt đầu từ trạng thái mock sạch (phiên, bộ đếm, điều khiển, thông báo).
  // Cách ly: trình duyệt chỉ được gọi loopback (gateway/mock/app) và Google Fonts; bất kỳ lời gọi nào khác (Auth/backend thật, CDN...) bị chặn VÀ làm test thất bại.
  page: async ({ page, context }, use) => {
    await resetMock();
    const blocked: string[] = [];
    await context.route(
      (url) => !isAllowedE2eUrl(url),
      (route) => {
        blocked.push(route.request().url());
        return route.abort("blockedbyclient");
      },
    );
    await use(page);
    expect(blocked, "e2e không được gọi ra ngoài loopback (trừ Google Fonts)").toEqual([]);
  },
  app: async ({ page, baseURL }, use) => {
    const problems: string[] = [];
    const visits = track(page, problems);
    const url = (path: string) => new URL(path, baseURL).toString();
    await use({
      url,
      signIn: async (path, options) => {
        await page.goto(mockLoginUrl(url(path), options), { waitUntil: "load" });
      },
      waitForLogin: () => page.waitForURL(AUTH_LOGIN_URL),
      loginVisits: () => visits.length,
      problems,
      waitForSidebar: async () => {
        await page.waitForSelector(".management-sidebar-column .sidebar-menu li a");
      },
      menuTitles: () => page.$$eval(".sidebar-middle .sidebar-menu a", (as) => as.map((a) => (a.textContent ?? "").trim())),
    });
  },
});

export { expect };
