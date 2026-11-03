// Token được lưu ở localStorage — giống IELTS (lib/auth/auth-storage.ts, mirror ERP_Frontend/Exam_Frontend) thay vì chỉ giữ
// trong biến bộ nhớ của tab: bản trước mất token mỗi khi tải lại trang/mở tab mới (phải vòng qua Authentication_Frontend để
// lấy lại), gây văng phiên giả ngay sau khi vừa đăng nhập xong (reload hoặc điều hướng cứng là mất token). Auth backend luôn
// set cookie HttpOnly; token chỉ xuất hiện trong hash ở profile không phải prod (isExposeTokensEnabled), tức môi trường
// dev/staging chạy từ host khác ROOT_DOMAIN (vd localhost) nơi cookie không đi kèm. Ở production phiên chỉ là cookie, không
// có token nào ở đây. Không bao giờ ghi token vào log.
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

const TOKEN_PARAMS = ["access_token", "refresh_token"] as const;
// Dạng JWT (3 đoạn base64url); chỉ kiểm tra hình dạng để loại rác, chữ ký do server kiểm tra.
const JWT_SHAPE = /^[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*$/;
const MAX_TOKEN_LENGTH = 8192;

function isPlausibleToken(value: string | null): value is string {
  return !!value && value.length <= MAX_TOKEN_LENGTH && JWT_SHAPE.test(value);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: { accessToken?: string | null; refreshToken?: string | null }): void {
  if (typeof window === "undefined") return;
  if (tokens.accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  if (tokens.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Nhận callback từ Authentication_Frontend: `#access_token=...&refresh_token=...` (chỉ có khi Auth chạy profile không phải prod).
 * Luôn xóa các tham số token khỏi URL (kể cả khi không hợp lệ); chỉ nhận token đúng hình dạng JWT.
 * @returns true nếu nhận được access token hợp lệ.
 */
export function consumeTokensFromUrlHash(): boolean {
  if (typeof window === "undefined" || !window.location.hash) return false;

  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (!TOKEN_PARAMS.some((name) => params.has(name))) return false;

  const access = params.get("access_token");
  const refresh = params.get("refresh_token");
  const accepted = isPlausibleToken(access);
  if (accepted) {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    if (isPlausibleToken(refresh)) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }

  for (const name of TOKEN_PARAMS) params.delete(name);
  const rest = params.toString();
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, "", `${pathname}${search}${rest ? `#${rest}` : ""}`);
  return accepted;
}
