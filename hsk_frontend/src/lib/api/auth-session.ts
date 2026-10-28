// Làm mới phiên (POST /refresh của Authentication_Backend) dùng chung cho mọi API. Tách khỏi api-client/auth-client để
// không có vòng import. Hợp đồng (đọc từ Authentication_Backend, AuthController/AuthCookieService):
//  - Body {refreshToken} là tùy chọn; nếu không có Auth dùng cookie HttpOnly `refresh_token`. Thiếu cả hai => 400.
//  - Refresh token sai/hết hạn => 401. Thành công luôn rotate cookie; token chỉ nằm trong body ở profile không phải prod.
// Quy tắc: 400/401/403 = phiên đã hết; mất mạng/5xx/429 = KHÔNG rõ (không coi là hết phiên, không xóa token).
import { clearTokens, getRefreshToken, setTokens } from "@/lib/auth/token-store";

export type RefreshOutcome = "refreshed" | "expired" | "unavailable";

export function getAuthApiBase(): string | null {
  const url = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL?.trim().replace(/\/+$/, "");
  return url || null;
}

interface RefreshBody {
  data?: { accessToken?: string; refreshToken?: string };
}

async function refreshSession(): Promise<RefreshOutcome> {
  const base = getAuthApiBase();
  if (!base) return "unavailable";

  const refreshToken = getRefreshToken();
  let res: Response;
  try {
    res = await fetch(`${base}/refresh`, {
      method: "POST",
      credentials: "include",
      headers: refreshToken ? { "Content-Type": "application/json" } : undefined,
      body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
    });
  } catch {
    return "unavailable";
  }

  if (res.ok) {
    const body = (await res.json().catch(() => null)) as RefreshBody | null;
    const tokens = body?.data;
    if (tokens?.accessToken) {
      setTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    } else {
      // Chế độ cookie-only: bỏ Bearer cũ (nếu còn) để server dùng cookie vừa được rotate, tránh gửi token đã cũ.
      clearTokens();
    }
    return "refreshed";
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    clearTokens();
    return "expired";
  }
  return "unavailable";
}

// Nhiều request cùng gặp 401 chỉ gây MỘT lần refresh; refresh token có thể bị rotate nên gọi song song sẽ làm hỏng phiên.
let inFlight: Promise<RefreshOutcome> | null = null;

export function refreshSessionOnce(): Promise<RefreshOutcome> {
  if (!inFlight) {
    inFlight = refreshSession().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

const expiredListeners = new Set<() => void>();

/** Đăng ký nhận thông báo "phiên đã hết" (refresh bị từ chối). Trả hàm hủy đăng ký. */
export function subscribeSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
}

export function notifySessionExpired(): void {
  expiredListeners.forEach((listener) => listener());
}
