// Chế độ DEMO (MOCK / NOT INTEGRATED). Bản build demo là bản build production BÌNH THƯỜNG mang cờ NEXT_PUBLIC_DEMO_MODE=1, chạy sau gateway cách ly
// (scripts/demo.mjs) cùng máy chủ giả lập (scripts/mock-server.mjs, MOCK_PROFILE=demo). Cờ demo KHÔNG đổi nguồn dữ liệu (vẫn là các biến
// NEXT_PUBLIC_*_API_BASE_PATH) và KHÔNG tạo fallback mock trong code ứng dụng; nó chỉ:
//   (1) hiện băng-rôn "CHẾ ĐỘ DEMO" + nút Reset dữ liệu / Đổi vai trò (components/demo/),
//   (2) mở write gate cho các thao tác ghi chưa có hợp đồng backend (lib/api/write-gate.ts),
//   (3) bật trang /demo chọn tài khoản demo.
// An toàn: demo chỉ hoạt động khi trang được phục vụ từ host loopback hoặc mạng riêng (RFC1918, *.local/*.localhost/*.test/*.invalid/*.lan/*.internal).
// Ở host khác, AuthInitializer từ chối chạy (cùng cơ chế với guard cấu hình mock), nên không thể vô tình dùng bản demo trên production thật.
import { isLoopbackHostname } from "@/lib/api/endpoint-safety";
import { buildAuthFrontendUrl } from "@/lib/auth/auth-redirect";

export function isDemoBuild(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE?.trim() === "1";
}

const PRIVATE_IPV4 = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/;
const PRIVATE_TLD = /\.(local|localhost|test|invalid|lan|internal)$/i;

export function isDemoHostAllowed(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return isLoopbackHostname(h) || PRIVATE_IPV4.test(h) || PRIVATE_TLD.test(h);
}

export function isDemoActive(hostname: string): boolean {
  return isDemoBuild() && isDemoHostAllowed(hostname);
}

/** Bản build demo nhưng đang được phục vụ từ host không được phép: phải từ chối chạy. */
export function isDemoBlockedOnHost(hostname: string): boolean {
  return isDemoBuild() && !isDemoHostAllowed(hostname);
}

export type DemoRole = "admin" | "teacher" | "mentor" | "user";

/**
 * URL điểm điều khiển của máy chủ giả lập, đi qua địa chỉ Authentication_Frontend GIẢ LẬP (cùng origin `/__auth` → gateway → mock, hoặc
 * `http://localhost:3190` khi `next dev`). Chỉ có nghĩa trong chế độ demo; null khi chưa cấu hình Auth hoặc đang render phía server.
 */
export function demoControlUrl(action: "mock-reset" | "mock-state"): string | null {
  return buildAuthFrontendUrl(`/${action}`, "");
}

/** URL đăng nhập nhanh một tài khoản demo rồi quay về `redirectPath` của app (tuyệt đối theo origin hiện tại). */
export function demoLoginUrl(role: DemoRole, redirectPath: string): string | null {
  if (typeof window === "undefined") return null;
  const target = buildAuthFrontendUrl("/mock-login", new URL(redirectPath, window.location.origin).toString());
  if (!target) return null;
  const url = new URL(target);
  url.searchParams.set("role", role);
  return url.toString();
}
