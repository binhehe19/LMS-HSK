import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import { mockLikeConfigNames } from "./src/lib/api/endpoint-safety";

// Thư mục gốc của dự án này. Cần chỉ định rõ vì thư mục cha D:\PRJ-2026\LMS có package-lock.json riêng
// khiến Next suy ra sai workspace root (cảnh báo "multiple lockfiles").
const projectRoot = path.resolve(import.meta.dirname);

const isDev = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";

// Mỗi backend service có một biến base path (NEXT_PUBLIC_<SVC>_API_BASE_PATH, trình duyệt gọi) và một đích proxy chỉ
// dùng khi dev (<SVC>_API_PROXY_TARGET, chỉ phía server Next). Thêm service mới = thêm một dòng ở đây.
const API_SERVICES = [
  { basePath: process.env.NEXT_PUBLIC_QUIZ_API_BASE_PATH, proxyTarget: process.env.QUIZ_API_PROXY_TARGET },
  { basePath: process.env.NEXT_PUBLIC_LMS_API_BASE_PATH, proxyTarget: process.env.LMS_API_PROXY_TARGET },
  {
    basePath: process.env.NEXT_PUBLIC_STORAGE_API_BASE_PATH || "/api/storage",
    proxyTarget: process.env.STORAGE_API_PROXY_TARGET || process.env.NEXT_PUBLIC_STORAGE_API_BASE_URL,
  },
  { basePath: process.env.NEXT_PUBLIC_HSK_API_BASE_PATH, proxyTarget: process.env.HSK_API_PROXY_TARGET },
  { basePath: process.env.NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH, proxyTarget: process.env.NOTIFICATION_API_PROXY_TARGET },
  { basePath: process.env.NEXT_PUBLIC_TICKET_API_BASE_PATH, proxyTarget: process.env.TICKET_API_PROXY_TARGET },
  { basePath: process.env.NEXT_PUBLIC_ADMIN_USER_API_BASE_PATH, proxyTarget: process.env.ADMIN_USER_API_PROXY_TARGET },
];

// Chặn build/chạy production mang cấu hình MOCK/local. Lớp 1 trong 3 lớp độc lập (lớp 2: AuthInitializer từ chối chạy khi
// trang được phục vụ từ host không phải loopback mà cấu hình vẫn trỏ mock; lớp 3: mock server tách riêng, chỉ bind 127.0.0.1).
// Ngoại lệ HSK_ALLOW_MOCK_ENDPOINTS=1 chỉ để kiểm thử production-build cục bộ và bị từ chối khi: có biến CI, hoặc cờ nằm trong
// bất kỳ file .env* (tránh vô tình commit/triển khai cờ); chỉ được đặt trên dòng lệnh của người chạy.
function assertSafeForProduction() {
  if (!isProduction) return;

  if (process.env.HSK_ALLOW_MOCK_ENDPOINTS === "1") {
    if (process.env.CI) {
      throw new Error("HSK_ALLOW_MOCK_ENDPOINTS không được dùng trong CI/build tự động.");
    }
    const envFilesWithFlag = fs
      .readdirSync(projectRoot)
      .filter((name) => /^\.env(\..+)?$/.test(name) && name !== ".env.example")
      .filter((name) => /^\s*HSK_ALLOW_MOCK_ENDPOINTS\s*=/m.test(fs.readFileSync(path.join(projectRoot, name), "utf8")));
    if (envFilesWithFlag.length > 0) {
      throw new Error(
        `HSK_ALLOW_MOCK_ENDPOINTS không được đặt trong file ${envFilesWithFlag.join(", ")}; chỉ đặt trên dòng lệnh khi kiểm thử cục bộ.`,
      );
    }
    console.warn("[HSK] CẢNH BÁO: đang build/chạy production với cờ cho phép cấu hình MOCK/local. KHÔNG triển khai bản này.");
    return;
  }

  const offenders = mockLikeConfigNames();
  for (const name of ["QUIZ_API_PROXY_TARGET", "LMS_API_PROXY_TARGET", "STORAGE_API_PROXY_TARGET", "HSK_API_PROXY_TARGET", "NOTIFICATION_API_PROXY_TARGET", "TICKET_API_PROXY_TARGET", "ADMIN_USER_API_PROXY_TARGET"]) {
    if (process.env[name]) offenders.push(name);
  }
  if (offenders.length > 0) {
    throw new Error(
      `Cấu hình có vẻ là MOCK/local nhưng đang build/chạy production: ${offenders.join(", ")}. ` +
        "Dùng URL thật hoặc đường dẫn cùng origin (xem .env.example).",
    );
  }
}
assertSafeForProduction();

const nextConfig: NextConfig = {
  // Docker/self-host: sinh .next/standalone (cùng cách IELTS frontend).
  output: "standalone",
  // Build/dev dùng webpack (`next build --webpack`, `next dev --webpack`), KHÔNG dùng Turbopack mặc định: bộ xử lý CSS của Turbopack (lightningcss) làm rơi rule
  // `.shadow-sm { box-shadow: … !important }` của SCSS cũ (và có thể các rule khác chưa được kiểm tra), nên giao diện lệch HSK cũ. Webpack giữ nguyên CSS như sass sinh ra.
  // Bằng chứng và test chặn tái phát: docs/M3B2-WELCOME.md mục "Phát hiện CSS", e2e/specs/css-fidelity.spec.ts.
  // Mặc định ".next". Kiểm thử trình duyệt (npm run e2e:build) dùng thư mục riêng để không đè bản build/dev của người phát triển và để
  // build được hai biến thể cấu hình (có/không cấu hình thông báo-ticket) cạnh nhau.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  outputFileTracingRoot: projectRoot,
  turbopack: { root: projectRoot },
  sassOptions: {
    // Giữ nguyên cấu hình của LMS_Frontend cũ (vite.config.ts): SCSS template còn dùng @import.
    silenceDeprecations: ["import", "global-builtin", "color-functions", "mixed-decls"],
    quietDeps: true,
  },
  // Đăng nhập dev mở app ở http://127.0.0.1:3000 (origin phải khớp allowlist của trang tài khoản), khác `localhost` (giống IELTS).
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    // Chỉ khi chạy `next dev` trên máy cá nhân (giống IELTS): đưa đường dẫn cùng origin tới backend dev để tránh CORS.
    // Production: gateway/Traefik định tuyến trực tiếp.
    if (!isDev) return [];
    // /api/auth/* (users/me, refresh, logout) cùng origin, dev server chuyển tới trang tài khoản (xem lib/auth/dev-token-session.ts).
    const authBase = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL?.trim().replace(/\/+$/, "");
    const authRewrites = authBase ? [{ source: "/api/auth/:path*", destination: `${authBase}/:path*` }] : [];
    return [...authRewrites, ...API_SERVICES.flatMap(({ basePath, proxyTarget }) =>
      basePath?.startsWith("/") && proxyTarget
        ? [{ source: `${basePath.replace(/\/+$/, "")}/:path*`, destination: `${proxyTarget.replace(/\/+$/, "")}/:path*` }]
        : [],
    )];
  },
};

export default nextConfig;
