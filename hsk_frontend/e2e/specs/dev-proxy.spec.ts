// Chế độ `next dev` với proxy cùng origin (NEXT_PUBLIC_QUIZ_API_BASE_PATH=/api/quiz + QUIZ_API_PROXY_TARGET → mock). Chạy bằng: npm run test:e2e:dev
// (M1.5 — q1-same-origin). Chỉ có ý nghĩa ở dev; production dùng gateway.
import { expect, test } from "../support/test";

test("gọi API cùng origin /api/quiz (dev rewrite → mock) và hiển thị dữ liệu qua proxy", async ({ page, app, baseURL }) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (/grading|users\/me/.test(r.url())) calls.push(`${r.method()} ${r.url()}`);
  });
  await app.signIn("/admin/class-management");
  await page.waitForSelector(".acm-table tbody tr.acm-row");
  await expect(page.locator(".acm-table tbody tr.acm-row")).toHaveCount(10);
  expect(calls.some((c) => c.includes(`${baseURL}/api/quiz/grading/admin/classes`))).toBe(true);
});
