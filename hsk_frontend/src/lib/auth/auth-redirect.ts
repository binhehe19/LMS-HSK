/* eslint-disable @next/next/no-location-assign-relative-destination -- /oauth2/* do gateway (Traefik → oauth2-proxy) phục vụ, không phải trang Next.js */
// Đăng nhập tập trung theo luồng IdP của LMS_IELTS: đăng nhập đi qua oauth2-proxy của app (`/oauth2/start` → IdP → quay lại
// đường dẫn hiện tại), phiên là cookie của proxy cùng origin, FE không giữ token. Các trang khác của Authentication_Frontend
// (hồ sơ, đổi mật khẩu...) mở thẳng ở host của IdP (`buildAuthFrontendUrl`).
// Chạy local (`next dev`) không có oauth2-proxy: đăng nhập ở trang tài khoản rồi nhận token qua hash ở /dev-auth/callback
// (xem dev-token-session.ts). Chỉ khi đó mới cần NEXT_PUBLIC_AUTH_FRONTEND_URL cho việc đăng nhập (fail-closed nếu thiếu).
import { buildLoginUrl, isDevIdpLogin, signOutDevSession } from "./dev-token-session";

// Client OAuth dùng chung với LMS (gateway HSK đăng nhập bằng client `lms`): đăng xuất phải báo đúng client này cho IdP.
const OAUTH_CLIENT_ID = "lms";

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

/**
 * Chuyển trình duyệt đi đăng nhập (`path` = "/login", `redirectUrl` = đường dẫn quay lại, mặc định trang đang xem) hoặc sang
 * trang khác của Auth. Trả false (không làm gì) nếu thiếu cấu hình cần thiết.
 */
export function redirectToAuthFrontend(path = "/login", redirectUrl?: string): boolean {
  if (typeof window === "undefined") return false;
  if (path !== "/login") {
    const target = buildAuthFrontendUrl(path, redirectUrl);
    if (!target) return false;
    window.location.assign(target);
    return true;
  }
  const returnTo = redirectUrl || window.location.pathname + window.location.search;
  if (isDevIdpLogin()) {
    const base = getAuthFrontendBaseUrl();
    if (!base) return false;
    window.location.assign(buildLoginUrl(base, window.location.origin, returnTo));
    return true;
  }
  window.location.assign(`/oauth2/start?rd=${encodeURIComponent(returnTo)}`);
  return true;
}

/** Xóa phiên của proxy rồi sang IdP kết thúc phiên đăng nhập chung, quay về trang gốc của app. */
export function redirectToSignOut(): void {
  if (typeof window === "undefined") return;
  if (isDevIdpLogin()) {
    // shortcut: chỉ kết thúc phiên của app local; phiên ở trang tài khoản còn nguyên, đăng xuất ở đó nếu cần.
    void signOutDevSession().finally(() => window.location.assign("/"));
    return;
  }
  const base = getAuthFrontendBaseUrl();
  const back = new URLSearchParams({ client_id: OAUTH_CLIENT_ID, post_logout_redirect_uri: `${window.location.origin}/` });
  const next = base ? `${base}/api/auth/logout/idp?${back.toString()}` : "/";
  window.location.assign(`/oauth2/sign_out?rd=${encodeURIComponent(next)}`);
}
