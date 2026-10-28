// Build production cho kiểm thử trình duyệt (npm run e2e:build). Hai biến thể, mỗi biến thể một thư mục riêng (NEXT_DIST_DIR):
//   .next-e2e              đủ cấu hình: Auth, Quiz, Thông báo, Ticket
//   .next-e2e-unconfigured Auth + Quiz; Thông báo + Ticket TRỐNG (WAITING FOR BACKEND)
//
// ĐÂY LÀ BUILD PRODUCTION BÌNH THƯỜNG. Cấu hình chỉ gồm đường dẫn cùng origin (/api/..., /__auth) như khi triển khai sau gateway thật, KHÔNG có URL mock,
// KHÔNG đặt HSK_ALLOW_MOCK_ENDPOINTS, KHÔNG bỏ qua guard của next.config.ts; vì vậy chạy được cả trong CI. "Giả" nằm ở scripts/e2e-gateway.mjs và
// scripts/mock-server.mjs (chỉ bind 127.0.0.1, do Playwright khởi động), không nằm trong artifact. Sau khi build, script quét artifact để chắc chắn nó không
// chứa địa chỉ mock nào, và từ chối bất kỳ biến cấu hình nào trông giống mock/local.
//
// Mọi biến NEXT_PUBLIC_* / *_PROXY_TARGET đều được đặt TƯỜNG MINH (kể cả chuỗi rỗng) để .env.local của người dùng không lọt vào build.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Nguồn duy nhất của cấu hình e2e: e2e/variants.json (playwright.config.ts đọc cùng file để khởi động server với đúng giá trị).
const config = JSON.parse(fs.readFileSync(path.join(root, "e2e", "variants.json"), "utf8"));
const E2E_VARIANTS = config.variants.map((v) => ({ dist: v.dist, env: { ...config.base, ...v.env } }));

const MOCK_LIKE = /(^|\/\/)(localhost|127\.\d+\.\d+\.\d+|\[::1\]|[^/:]+\.(invalid|test|localhost))(:|\/|$)/i;
const MOCK_ADDRESS_IN_ARTIFACT = /(localhost|127\.0\.0\.1):3190|\.hsk-test\.invalid/;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function main() {
  for (const { env } of E2E_VARIANTS) {
    for (const [name, value] of Object.entries(env)) {
      if (MOCK_LIKE.test(value)) throw new Error(`Cấu hình e2e không được trông giống mock/local: ${name}=${value}`);
    }
  }
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  for (const { dist, env } of E2E_VARIANTS) {
    console.log(`\n==> next build → ${dist}`);
    // Không đặt HSK_ALLOW_MOCK_ENDPOINTS; nếu người chạy có đặt sẵn trong môi trường của họ thì bỏ ra để build này luôn đi qua guard đầy đủ.
    const childEnv = { ...process.env, ...env, NEXT_DIST_DIR: dist, NODE_ENV: "production" };
    delete childEnv.HSK_ALLOW_MOCK_ENDPOINTS;
    const result = spawnSync(process.execPath, [nextBin, "build", "--webpack"], { cwd: root, stdio: "inherit", env: childEnv });
    if (result.status !== 0) process.exit(result.status ?? 1);

    const offenders = [];
    for (const sub of ["static", "server"]) {
      const dir = path.join(root, dist, sub);
      if (!fs.existsSync(dir)) continue;
      for (const file of walk(dir)) {
        if (!/\.(js|css|html|json|rsc|txt|map)$/.test(file) || file.endsWith(".map")) continue;
        if (MOCK_ADDRESS_IN_ARTIFACT.test(fs.readFileSync(file, "utf8"))) offenders.push(path.relative(root, file));
      }
    }
    if (offenders.length) {
      console.error(`\nArtifact ${dist} chứa địa chỉ mock (không được phép):\n  ${offenders.slice(0, 10).join("\n  ")}`);
      process.exit(1);
    }
    console.log(`==> ${dist}: không chứa địa chỉ mock nào (đã quét static + server)`);
  }
  console.log("\nXong. Chạy: npm run test:e2e");
}

main();
