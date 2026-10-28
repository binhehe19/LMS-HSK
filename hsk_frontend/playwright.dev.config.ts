import { defineConfig } from "@playwright/test";
import base, { baseUse, E2E_PORTS, mockServer } from "./playwright.config";

// Kiểm thử chế độ `next dev` với proxy cùng origin (QUIZ_API_PROXY_TARGET → mock). Tách cấu hình riêng để `npm run test:e2e` không phải khởi động dev server.
// Chạy: npm run test:e2e:dev
export default defineConfig({
  ...base,
  projects: [{ name: "dev-proxy", testMatch: /dev-proxy\.spec/, use: { ...baseUse, baseURL: `http://localhost:${E2E_PORTS.devProxy}` } }],
  webServer: [
    mockServer,
    {
      command: `node node_modules/next/dist/bin/next dev --webpack --port ${E2E_PORTS.devProxy}`,
      url: `http://localhost:${E2E_PORTS.devProxy}/admin/class-management`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        NEXT_DIST_DIR: ".next-e2e-dev",
        NEXT_PUBLIC_AUTH_FRONTEND_URL: `http://localhost:${E2E_PORTS.mock}`,
        NEXT_PUBLIC_AUTH_API_BASE_URL: `http://localhost:${E2E_PORTS.mock}/api/auth`,
        NEXT_PUBLIC_QUIZ_API_BASE_PATH: "/api/quiz",
        QUIZ_API_PROXY_TARGET: `http://127.0.0.1:${E2E_PORTS.mock}/api/quiz`,
        NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH: "",
        NEXT_PUBLIC_TICKET_API_BASE_PATH: "",
        NEXT_PUBLIC_ADMIN_USER_API_BASE_PATH: "",
        NEXT_PUBLIC_NOTIFICATION_CAMPAIGN_SEND: "",
      },
    },
  ],
});
