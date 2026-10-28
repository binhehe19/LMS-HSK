// XEM TRƯỚC CỤC BỘ với dữ liệu GIẢ LẬP (MOCK / NOT INTEGRATED): một lệnh dựng toàn bộ: build production thật (cờ NEXT_PUBLIC_DEMO_MODE=1, cấu hình
// đường dẫn cùng origin) → máy chủ giả lập (MOCK_PROFILE=demo) → `next start` → gateway cách ly đứng trước (cùng cách bộ e2e chạy, scripts/e2e-gateway.mjs).
// Bản build KHÔNG chứa URL mock, KHÔNG dùng HSK_ALLOW_MOCK_ENDPOINTS, không nới guard của next.config.ts; "giả" nằm ở hai tiến trình ngoài app.
//
//   npm run preview:local               build (vào .next-preview) rồi chạy, mở http://localhost:3100/demo
//   npm run preview:local -- --no-build  dùng bản build .next-preview sẵn có
//   npm run preview:build               chỉ build
//   tuỳ chọn: --port 3100 (cổng trình duyệt dùng), --app 3300, --mock 3390
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(argv[i + 1]) : NaN;
  return Number.isInteger(v) && v > 0 && v < 65536 ? v : fallback;
};
const PORT = opt("port", 3100);
const APP = opt("app", 3300);
const MOCK = opt("mock", 3390);
const DIST = ".next-preview";

// Mọi biến NEXT_PUBLIC_* / *_PROXY_TARGET đặt TƯỜNG MINH (kể cả rỗng) để .env.local của người chạy không lọt vào build/start.
const APP_ENV = {
  NEXT_PUBLIC_AUTH_FRONTEND_URL: "/__auth",
  NEXT_PUBLIC_AUTH_API_BASE_URL: "/api/auth",
  NEXT_PUBLIC_LMS_API_BASE_PATH: "/api/lms",
  NEXT_PUBLIC_STORAGE_API_BASE_PATH: "/api/storage",
  NEXT_PUBLIC_HSK_API_BASE_PATH: "/api/hsk",
  NEXT_PUBLIC_QUIZ_API_BASE_PATH: "/api/quiz",
  NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH: "/api/notification",
  NEXT_PUBLIC_TICKET_API_BASE_PATH: "/api/tickets",
  NEXT_PUBLIC_ADMIN_USER_API_BASE_PATH: "/api/admin/users",
  NEXT_PUBLIC_NOTIFICATION_CAMPAIGN_SEND: "",
  NEXT_PUBLIC_WRITE_QUIZ_GRADING: "",
  NEXT_PUBLIC_WRITE_TEACHER_NOTE: "",
  NEXT_PUBLIC_WRITE_LESSON_DETAIL: "",
  NEXT_PUBLIC_WRITE_TEACHER_MANAGEMENT: "",
  NEXT_PUBLIC_WRITE_CONTENT: "",
  NEXT_PUBLIC_WRITE_ONLINE_COURSE: "",
  NEXT_PUBLIC_WRITE_LESSON_MATERIALS: "",
  NEXT_PUBLIC_WRITE_STORAGE: "",
  NEXT_PUBLIC_WRITE_WORK_TICKETS: "",
  NEXT_PUBLIC_WRITE_MEMBERSHIP: "",
  NEXT_PUBLIC_DEMO_MODE: "1",
  QUIZ_API_PROXY_TARGET: "",
  LMS_API_PROXY_TARGET: "",
  STORAGE_API_PROXY_TARGET: "",
  HSK_API_PROXY_TARGET: "",
  NOTIFICATION_API_PROXY_TARGET: "",
  TICKET_API_PROXY_TARGET: "",
  ADMIN_USER_API_PROXY_TARGET: "",
  NEXT_DIST_DIR: DIST,
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
};
const MOCK_LIKE = /(^|\/\/)(localhost|127\.\d+\.\d+\.\d+|\[::1\]|[^/:]+\.(invalid|test|localhost))(:|\/|$)/i;
for (const [k, v] of Object.entries(APP_ENV)) if (MOCK_LIKE.test(v)) throw new Error(`Cấu hình xem trước không được trông giống mock/local: ${k}=${v}`);

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const childEnv = { ...process.env, ...APP_ENV };
delete childEnv.HSK_ALLOW_MOCK_ENDPOINTS;

if (!flag("no-build")) {
  console.log(`\n==> next build (production, webpack) → ${DIST}`);
  const result = spawnSync(process.execPath, [nextBin, "build", "--webpack"], { cwd: root, stdio: "inherit", env: childEnv });
  if (result.status !== 0) process.exit(result.status ?? 1);
} else if (!fs.existsSync(path.join(root, DIST, "BUILD_ID"))) {
  console.error(`Chưa có bản build ${DIST}; bỏ --no-build hoặc chạy npm run preview:build.`);
  process.exit(1);
}
if (flag("build-only")) process.exit(0);

const children = [];
const start = (name, args, env) => {
  const child = spawn(process.execPath, args, { cwd: root, stdio: ["ignore", "inherit", "inherit"], env });
  child.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`\n[${name}] đã thoát (mã ${code}); dừng toàn bộ.`);
      shutdown(1);
    }
  });
  children.push(child);
  return child;
};
let shuttingDown = false;
const shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) c.kill();
  setTimeout(() => process.exit(code), 300);
};
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const waitFor = (url, label, timeoutMs = 60_000) =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      http
        .get(url, (res) => {
          res.resume();
          res.statusCode && res.statusCode < 500 ? resolve() : retry();
        })
        .on("error", retry);
    };
    const retry = () => (Date.now() > deadline ? reject(new Error(`${label} không sẵn sàng sau ${timeoutMs / 1000}s`)) : setTimeout(tick, 400));
    tick();
  });

(async () => {
  start("mock", [path.join(root, "scripts", "mock-server.mjs")], { ...process.env, MOCK_PROFILE: "demo", MOCK_PORT: String(MOCK) });
  await waitFor(`http://127.0.0.1:${MOCK}/mock-state`, "máy chủ giả lập");
  start("next", [nextBin, "start", "--port", String(APP), "--hostname", "127.0.0.1"], childEnv);
  await waitFor(`http://127.0.0.1:${APP}/demo`, "ứng dụng Next", 120_000);
  start("gateway", [path.join(root, "scripts", "e2e-gateway.mjs"), "--port", String(PORT), "--app", String(APP), "--mock", String(MOCK)], process.env);
  await waitFor(`http://127.0.0.1:${PORT}/__gateway-health`, "gateway");
  console.log(`
=========================================================================
  XEM TRƯỚC CỤC BỘ (dữ liệu GIẢ LẬP, không phải hệ thống thật)
  Mở:  http://localhost:${PORT}/demo
       -> chọn Quản trị viên / Giảng viên / Trợ giảng / Học viên
  Reset dữ liệu: nút trên thanh vàng, hoặc http://localhost:${PORT}/__auth/mock-reset
  Dừng: Ctrl+C
=========================================================================
`);
})().catch((error) => {
  console.error(error.message);
  shutdown(1);
});
