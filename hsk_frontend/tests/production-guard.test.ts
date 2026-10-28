import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

// BẰNG CHỨNG rằng guard production của next.config.ts vẫn nguyên: chạy `next build` THẬT (tiến trình con) với cấu hình mock/local và kiểm tra bị TỪ CHỐI
// ngay lúc nạp cấu hình (trước khi biên dịch, nên nhanh). Bản build e2e không cần ngoại lệ nào (nó chỉ dùng đường dẫn cùng origin), nên các ca dưới đây
// là toàn bộ cách một bản triển khai production có thể mang cấu hình mock — và không ca nào qua được.
const root = path.resolve(__dirname, "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

// Tường minh mọi biến liên quan (kể cả rỗng) để .env.local của người chạy không ảnh hưởng kết quả.
const CLEAN = {
  NEXT_PUBLIC_AUTH_FRONTEND_URL: "",
  NEXT_PUBLIC_AUTH_API_BASE_URL: "",
  NEXT_PUBLIC_QUIZ_API_BASE_PATH: "",
  NEXT_PUBLIC_LMS_API_BASE_PATH: "",
  NEXT_PUBLIC_STORAGE_API_BASE_PATH: "",
  NEXT_PUBLIC_HSK_API_BASE_PATH: "",
  HSK_API_PROXY_TARGET: "",
  NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH: "",
  NEXT_PUBLIC_TICKET_API_BASE_PATH: "",
  NEXT_PUBLIC_ADMIN_USER_API_BASE_PATH: "",
  NEXT_PUBLIC_NOTIFICATION_CAMPAIGN_SEND: "",
  NEXT_PUBLIC_DEMO_MODE: "",
  QUIZ_API_PROXY_TARGET: "",
  LMS_API_PROXY_TARGET: "",
  STORAGE_API_PROXY_TARGET: "",
  NOTIFICATION_API_PROXY_TARGET: "",
  TICKET_API_PROXY_TARGET: "",
  ADMIN_USER_API_PROXY_TARGET: "",
  HSK_ALLOW_MOCK_ENDPOINTS: "",
  CI: "",
};

function productionBuild(env: Record<string, string>) {
  const result = spawnSync(process.execPath, [nextBin, "build", "--webpack"], {
    cwd: root,
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, ...CLEAN, ...env, NODE_ENV: "production", NEXT_DIST_DIR: ".next-guard-test", NEXT_TELEMETRY_DISABLED: "1" },
  });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

// Mỗi ca chạy `next build` thật bằng spawnSync (tới 60 giây): timeout mặc định 5 giây của vitest làm ca đầu tiên hết giờ khi máy lạnh (thấy ở bản sao sạch M3B.3).
describe("guard production chống cấu hình mock (build thật)", { timeout: 120_000 }, () => {
  it.each([
    ["URL Auth trỏ localhost", { NEXT_PUBLIC_AUTH_API_BASE_URL: "http://localhost:3190/api/auth" }],
    ["URL Auth Frontend trỏ 127.0.0.1", { NEXT_PUBLIC_AUTH_FRONTEND_URL: "http://127.0.0.1:3190" }],
    ["host .invalid", { NEXT_PUBLIC_QUIZ_API_BASE_PATH: "http://lms.hsk-test.invalid/api/quiz" }],
    ["backend chung (LMS) trỏ localhost", { NEXT_PUBLIC_LMS_API_BASE_PATH: "http://localhost:3190/api/lms" }],
    ["có đích proxy dev (LMS_API_PROXY_TARGET)", { LMS_API_PROXY_TARGET: "http://127.0.0.1:3190/api/lms" }],
    ["thông báo trỏ localhost", { NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH: "http://localhost:3190/api/notification" }],
    ["ticket trỏ localhost", { NEXT_PUBLIC_TICKET_API_BASE_PATH: "http://localhost:3190/api/tickets" }],
    ["danh sách người dùng (Admin) trỏ localhost", { NEXT_PUBLIC_ADMIN_USER_API_BASE_PATH: "http://localhost:3190/api/admin/users" }],
    ["có đích proxy dev (QUIZ_API_PROXY_TARGET)", { QUIZ_API_PROXY_TARGET: "http://127.0.0.1:3190/api/quiz" }],
  ])("%s => build production bị từ chối", (_name, env) => {
    const { status, output } = productionBuild(env);
    expect(status).not.toBe(0);
    expect(output).toContain("MOCK/local");
  });

  it("cờ HSK_ALLOW_MOCK_ENDPOINTS=1 KHÔNG cứu được cấu hình mock khi có biến CI (không chỉ bỏ điều kiện CI)", () => {
    const { status, output } = productionBuild({ NEXT_PUBLIC_AUTH_API_BASE_URL: "http://localhost:3190/api/auth", HSK_ALLOW_MOCK_ENDPOINTS: "1", CI: "true" });
    expect(status).not.toBe(0);
    expect(output).toContain("không được dùng trong CI");
  });

  it("cấu hình theo đường dẫn cùng origin (như triển khai sau gateway thật và như bản build e2e) KHÔNG bị guard từ chối", async () => {
    // Không build đầy đủ ở đây (tốn ~20 giây; npm run e2e:build đã build thật với đúng cấu hình này): chỉ kiểm tra guard không có cớ để từ chối.
    const { mockLikeConfigNames } = await import("@/lib/api/endpoint-safety");
    const keys = ["NEXT_PUBLIC_AUTH_FRONTEND_URL", "NEXT_PUBLIC_AUTH_API_BASE_URL", "NEXT_PUBLIC_QUIZ_API_BASE_PATH", "NEXT_PUBLIC_LMS_API_BASE_PATH", "NEXT_PUBLIC_STORAGE_API_BASE_PATH", "NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH", "NEXT_PUBLIC_TICKET_API_BASE_PATH", "NEXT_PUBLIC_ADMIN_USER_API_BASE_PATH"];
    const values = ["/__auth", "/api/auth", "/api/quiz", "/api/lms", "/api/storage", "/api/notification", "/api/tickets", "/api/admin/users"];
    const previous = keys.map((k) => process.env[k]);
    keys.forEach((k, i) => (process.env[k] = values[i]));
    try {
      expect(mockLikeConfigNames()).toEqual([]);
    } finally {
      keys.forEach((k, i) => (previous[i] === undefined ? delete process.env[k] : (process.env[k] = previous[i])));
    }
  });
});
