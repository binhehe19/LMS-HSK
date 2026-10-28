// Token chỉ tồn tại TRONG BỘ NHỚ của tab (khác IELTS: localStorage). Lý do: Auth backend luôn set cookie HttpOnly;
// token chỉ xuất hiện trong body/hash ở profile không phải prod (isExposeTokensEnabled), tức môi trường dev/staging chạy
// từ host khác ROOT_DOMAIN (vd localhost) nơi cookie không đi kèm. Ở production phiên chỉ là cookie, không có token nào ở đây.
// Hệ quả đã chấp nhận: chế độ hash mất token khi tải lại trang/mở tab mới; khi đó đi vòng qua Authentication_Frontend
// (đã có phiên cookie của chính nó thì đăng nhập lại nhanh). Không bao giờ ghi token vào log hoặc web storage.
let accessToken: string | null = null;
let refreshToken: string | null = null;

const TOKEN_PARAMS = ["access_token", "refresh_token"] as const;
// Dạng JWT (3 đoạn base64url); chỉ kiểm tra hình dạng để loại rác, chữ ký do server kiểm tra.
const JWT_SHAPE = /^[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*$/;
const MAX_TOKEN_LENGTH = 8192;

function isPlausibleToken(value: string | null): value is string {
  return !!value && value.length <= MAX_TOKEN_LENGTH && JWT_SHAPE.test(value);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export function setTokens(tokens: { accessToken?: string | null; refreshToken?: string | null }): void {
  if (tokens.accessToken) accessToken = tokens.accessToken;
  if (tokens.refreshToken) refreshToken = tokens.refreshToken;
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
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
    accessToken = access;
    refreshToken = isPlausibleToken(refresh) ? refresh : null;
  }

  for (const name of TOKEN_PARAMS) params.delete(name);
  const rest = params.toString();
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, "", `${pathname}${search}${rest ? `#${rest}` : ""}`);
  return accepted;
}
