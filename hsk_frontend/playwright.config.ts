import { defineConfig, devices } from "@playwright/test";
import variants from "./e2e/variants.json";

// Kiểm thử trình duyệt (Playwright) cho frontend quản lý LMS HSK. Chạy: npm run e2e:build  rồi  npm run test:e2e   (xem docs/TESTING.md).
//
// MOCK / NOT INTEGRATED, CÁCH LY: Auth và backend là scripts/mock-server.mjs (cổng 3190). Trình duyệt chỉ nói chuyện với một gateway cách ly
// (scripts/e2e-gateway.mjs) đứng trước bản build production BÌNH THƯỜNG của app (không chứa URL mock, không dùng cờ bỏ qua guard):
//   cổng 3100 (app 3200)  đủ cấu hình (Auth, Quiz, Thông báo, Ticket)
//   cổng 3101 (app 3201)  Thông báo + Ticket CHƯA cấu hình (WAITING FOR BACKEND)
// Dùng chung một mock server có trạng thái => chạy tuần tự (workers: 1); mỗi test tự reset mock (e2e/support/test.ts).
export const E2E_PORTS = { configured: 3100, unconfigured: 3101, devProxy: 3102, mock: 3190, appConfigured: 3200, appUnconfigured: 3201 } as const;

const nextBin = "node node_modules/next/dist/bin/next";
const variantEnv = (dist: string) => {
  const variant = variants.variants.find((v) => v.dist === dist);
  if (!variant) throw new Error(`Không có biến thể e2e ${dist}`);
  // Cùng giá trị với lúc build (và tường minh, để .env.local không lọt vào lúc chạy); KHÔNG có HSK_ALLOW_MOCK_ENDPOINTS.
  return { ...variants.base, ...variant.env, NEXT_DIST_DIR: dist, NODE_ENV: "production", HSK_ALLOW_MOCK_ENDPOINTS: "" };
};

/** Một biến thể = `next start` (cổng nội bộ) + gateway cách ly (cổng mà trình duyệt dùng). */
const variantServers = (publicPort: number, appPort: number, dist: string) => [
  {
    command: `${nextBin} start --port ${appPort} --hostname 127.0.0.1`,
    url: `http://127.0.0.1:${appPort}/admin/class-management`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: variantEnv(dist),
  },
  {
    command: `node scripts/e2e-gateway.mjs --port ${publicPort} --app ${appPort} --mock ${E2E_PORTS.mock}`,
    url: `http://127.0.0.1:${publicPort}/__gateway-health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
];

export const baseUse = {
  ...devices["Desktop Chrome"],
  viewport: { width: 1440, height: 900 },
  locale: "vi-VN",
  timezoneId: "Asia/Ho_Chi_Minh",
  trace: "retain-on-failure" as const,
};

export const mockServer = {
  command: "node scripts/mock-server.mjs",
  url: `http://127.0.0.1:${E2E_PORTS.mock}/mock-state`,
  reuseExistingServer: !process.env.CI,
  timeout: 30_000,
};

export default defineConfig({
  testDir: "e2e/specs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Giới hạn tổng của cả lần chạy (M3B.4): đo thực tế ~20 phút với 274 test (bản sao sạch M3B.4: 20,2 phút; M3B.3: 14,7 phút với 232 test); 60 phút = 3 lần để dư cho máy chậm. Quá giới hạn thì Playwright DỪNG và báo rõ
  // thay vì chạy tiếp vô hạn (lần chạy "2,6 giờ" thực ra là máy ngủ 2h15m — xem docs/TESTING.md mục "Điều tra lần chạy 2,6 giờ"). KHÔNG tăng timeout từng test để che lỗi treo.
  globalTimeout: 60 * 60_000,
  reporter: [["list"], ["./e2e/support/run-diagnostics-reporter.ts"]],
  // Ảnh chuẩn theo nền tảng (font/khử răng cưa khác nhau giữa hệ điều hành): e2e/__screenshots__/<platform>/<tên>.png
  snapshotPathTemplate: "e2e/__screenshots__/{platform}/{arg}{ext}",
  use: baseUse,
  projects: [
    { name: "configured", testIgnore: [/unconfigured/, /dev-proxy/, /visual/], use: { baseURL: `http://localhost:${E2E_PORTS.configured}` } },
    { name: "unconfigured", testMatch: /unconfigured\.spec/, use: { baseURL: `http://localhost:${E2E_PORTS.unconfigured}` } },
    { name: "visual", testMatch: /visual\.spec/, use: { baseURL: `http://localhost:${E2E_PORTS.configured}` } },
  ],
  webServer: [
    mockServer,
    ...variantServers(E2E_PORTS.configured, E2E_PORTS.appConfigured, ".next-e2e"),
    ...variantServers(E2E_PORTS.unconfigured, E2E_PORTS.appUnconfigured, ".next-e2e-unconfigured"),
  ],
});
