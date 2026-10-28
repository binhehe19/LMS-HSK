// Chuyển sang Authentication_Frontend (đăng nhập tập trung): /login?redirect=<url hiện tại>, cùng giao thức với
// LMS_Frontend cũ và LMS_IELTS. Authentication_Frontend chỉ chấp nhận redirect về localhost hoặc https thuộc BASE_DOMAIN.
// Không có URL mặc định trỏ hệ thống thật: thiếu NEXT_PUBLIC_AUTH_FRONTEND_URL thì không chuyển trang (fail-closed).

function getAuthFrontendBaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_AUTH_FRONTEND_URL?.trim().replace(/\/+$/, "");
  return url || null;
}

export function isAuthFrontendConfigured(): boolean {
  return getAuthFrontendBaseUrl() !== null;
}

/**
 * Trả null nếu chưa cấu hình Authentication_Frontend, hoặc nếu cấu hình là đường dẫn cùng origin (vd "/__auth", Auth được gateway phục vụ chung origin
 * với app) mà chưa có window để biết origin (khi render phía server). Cấu hình tuyệt đối (https://accounts…) hoạt động ở mọi nơi như trước.
 */
export function buildAuthFrontendUrl(path = "/login", redirectUrl?: string): string | null {
  const base = getAuthFrontendBaseUrl();
  if (!base) return null;
  const origin = typeof window === "undefined" ? undefined : window.location.origin;
  if (!/^https?:\/\//i.test(base) && !origin) return null;
  const redirect = redirectUrl ?? (typeof window === "undefined" ? "" : window.location.href);
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`, origin);
  if (redirect) url.searchParams.set("redirect", redirect);
  return url.toString();
}

/** Chuyển trình duyệt sang Auth. Trả false (không làm gì) nếu chưa cấu hình. */
export function redirectToAuthFrontend(path = "/login", redirectUrl?: string): boolean {
  if (typeof window === "undefined") return false;
  const target = buildAuthFrontendUrl(path, redirectUrl);
  if (!target) return false;
  window.location.assign(target);
  return true;
}
