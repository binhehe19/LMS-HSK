// Ghi lại giá trị CHUẨN cho e2e/specs/css-fidelity.spec.ts từ HSK CŨ (React/Vite) — chỉ đọc, không sửa gì ở HSK cũ.
//
// Khi nào chạy: chỉ khi muốn mở rộng danh sách thành phần được kiểm tra (e2e/support/css-probe.ts) hoặc HSK cũ thay đổi giao diện có chủ đích. KHÔNG chạy trong test/CI.
//
// Cách chạy (cần checkout LMS_Frontend và trình duyệt Playwright):
//   1) Chạy HSK cũ cách ly bằng host giả để không gọi hệ thống thật (đây chỉ là server dev của Vite, không có backend):
//        cd <LMS_Frontend> && VITE_LMS_API_URL=http://lms.hsk-test.invalid/api/lms VITE_AUTH_API_URL=http://auth.hsk-test.invalid/api/auth \
//          VITE_AUTH_FRONTEND_URL=http://auth.hsk-test.invalid VITE_ENABLE_LOCAL_DEV_MODE=false npx vite --port 3101
//      (lệnh trên giả định Vite mặc định; nếu dự án cũ cần cấu hình riêng thì dùng cấu hình cách ly tương ứng của bạn)
//   2) node scripts/record-css-golden.mjs --url http://localhost:3101/instructor/welcome
// Trang được chặn mạng: mọi request tới host *.invalid được trả lời giả tại đây; không có request nào ra ngoài.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const url = arg("url", "http://localhost:3101/instructor/welcome");
const out = path.resolve(root, arg("out", "e2e/fixtures/css-golden.json"));
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
  console.error("--url phải là máy chủ dev cục bộ của HSK cũ (http://localhost:<cổng>/…)");
  process.exit(1);
}

// Nạp css-probe.ts (dùng cùng mã với spec) bằng cách dịch TypeScript → JS.
const source = fs.readFileSync(path.join(root, "e2e/support/css-probe.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function("module", "exports", js)(mod, mod.exports);
const { PROBE_CLASSES, PROBE_PROPS, runProbe, normalizeProbeValue, HOVER_CLASSES, HOVER_PROPS, injectHoverProbe } = mod.exports;

const teacher = { id: "u-teacher-1", email: "teacher@example.test", fullName: "Giáo Viên", avatarUrl: null, roles: ["ROLE_TEACHER"], emailVerified: true, status: "ACTIVE" };
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "vi-VN" });
await context.route(/\.invalid(:\d+)?\//, (route) => {
  const req = route.request();
  const headers = { "access-control-allow-origin": req.headers()["origin"] ?? "*", "access-control-allow-credentials": "true", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "content-type": "application/json" };
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
  const body = /\/api\/auth\/refresh$/.test(req.url()) && req.method() === "POST" ? { expiresInSeconds: 3600, user: teacher } : 0;
  return route.fulfill({ status: 200, headers, body: JSON.stringify({ success: true, data: body }) });
});
const page = await context.newPage();
await page.goto(url, { waitUntil: "load", timeout: 180000 });
await page.waitForSelector(".welcome-hero-card, .management-sidebar-column", { timeout: 90000 });
await page.waitForTimeout(800);

const rest = await page.evaluate(new Function("args", `return (${runProbe.toString()})(args)`), { classes: PROBE_CLASSES, props: PROBE_PROPS });
await page.evaluate(new Function("c", `return (${injectHoverProbe.toString()})(c)`), HOVER_CLASSES);
const hover = [];
for (let i = 0; i < HOVER_CLASSES.length; i++) {
  const el = page.locator(`[data-probe-hover="${i}"]`);
  await el.hover();
  await page.waitForTimeout(150);
  hover.push({ cls: HOVER_CLASSES[i], props: await el.evaluate((node, props) => Object.fromEntries(props.map((p) => [p, getComputedStyle(node).getPropertyValue(p)])), HOVER_PROPS) });
}
await browser.close();

const norm = (props) => Object.fromEntries(Object.entries(props).map(([k, v]) => [k, normalizeProbeValue(v)]));
fs.writeFileSync(
  out,
  `${JSON.stringify({ source: `HSK cũ (React/Vite) — ${new URL(url).pathname}`, rest: rest.map((r) => ({ cls: r.cls, props: norm(r.props) })), hover: hover.map((r) => ({ cls: r.cls, props: norm(r.props) })) }, null, 1)}\n`,
);
console.log(`Đã ghi ${rest.length} phần tử + ${hover.length} trạng thái hover vào ${path.relative(root, out)}`);
