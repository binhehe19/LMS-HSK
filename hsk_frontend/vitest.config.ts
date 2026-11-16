import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Node >= 22.? bật `localStorage` thử nghiệm toàn cục (rỗng khi thiếu --localstorage-file) và nó che mất bản của jsdom, làm `window.localStorage`
// là undefined trong test. Tắt nó cho tiến trình chạy test; Node cũ (engines >= 20.9) không biết cờ này nên chỉ thêm khi được hỗ trợ.
const WEBSTORAGE_FLAG = "--no-experimental-webstorage";
const execArgv = process.allowedNodeEnvironmentFlags.has(WEBSTORAGE_FLAG) ? [WEBSTORAGE_FLAG] : [];

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    poolOptions: { forks: { execArgv } },
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    css: false,
  },
});
