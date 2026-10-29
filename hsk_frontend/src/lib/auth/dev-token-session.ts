// Dev: app chạy ở máy developer nhận token từ trang tài khoản (dev-accounts) qua URL hash vì local không có
// oauth2-proxy. Chỉ chạy khi `next dev` (NODE_ENV=development); build prod biên dịch isDevIdpLogin() thành
// hằng false nên mọi đường ở đây vô hiệu (vài hàm phụ không được gọi vẫn nằm trong bundle).
// Token nằm ở localStorage để mọi tab dùng chung một phiên như cookie của oauth2-proxy trên server: đăng xuất ở một
// tab thì tab khác mất token ở request kế tiếp.

const STORAGE_KEY = "dev_idp_session";
const REFRESH_URL = "/api/auth/refresh";
const LOGOUT_URL = "/api/auth/logout";

export type DevSession = { accessToken: string; refreshToken: string };

export function isDevIdpLogin(): boolean {
  return process.env.NODE_ENV === "development";
}

/** `#access_token=…&refresh_token=…` → phiên; thiếu một trong hai thì null. */
export function parseTokenHash(hash: string): DevSession | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

/** Chỉ nhận đường dẫn tương đối cùng origin; mọi thứ khác về trang chủ (chống chuyển hướng ra ngoài). */
export function safeReturnTo(rd: string | null): string {
  return rd && rd.startsWith("/") && !rd.startsWith("//") && !rd.startsWith("/\\") ? rd : "/";
}

/** Trang đăng nhập của IdP; sau khi xong, trang tài khoản đưa người dùng về `/dev-auth/callback` của app này kèm token. */
export function buildLoginUrl(authFrontendBase: string, origin: string, returnTo: string): string {
  const callback = `${origin}/dev-auth/callback?rd=${encodeURIComponent(returnTo)}`;
  return `${authFrontendBase}/login?continue=${encodeURIComponent(callback)}`;
}

export function loadSession(): DevSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DevSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: DevSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // localStorage bị chặn: coi như chưa đăng nhập.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // không có gì để xóa
  }
}

/** Header gắn vào mọi request API; rỗng khi không ở chế độ dev hoặc chưa có token. */
export function bearerHeaders(): Record<string, string> {
  const session = isDevIdpLogin() ? loadSession() : null;
  return session ? { Authorization: `Bearer ${session.accessToken}` } : {};
}

/**
 * Đăng xuất app local: xóa token rồi báo IdP thu hồi refresh token (header `X-Refresh-Token`) và xóa cookie còn sót ở
 * localhost do các bản trước của IdP. Lỗi mạng không chặn đăng xuất: token ở app đã xóa.
 */
export async function signOutDevSession(fetchImpl: typeof fetch = fetch): Promise<void> {
  const session = loadSession();
  clearSession();
  try {
    await fetchImpl(LOGOUT_URL, {
      method: "POST",
      credentials: "include",
      headers: session ? { "X-Refresh-Token": session.refreshToken } : {},
    });
  } catch {
    // IdP không với tới được: bỏ qua.
  }
}

let inFlight: Promise<boolean> | null = null;

/**
 * Làm mới bằng refresh token (header `X-Refresh-Token`, vì app local không có cookie của IdP). Các request đồng thời
 * dùng chung một lần gọi. IdP từ chối (đổi mật khẩu, hết hạn) thì xóa phiên; lỗi mạng hay lỗi máy chủ thì giữ phiên.
 */
export function refreshDevSession(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const session = isDevIdpLogin() ? loadSession() : null;
  if (!session) return Promise.resolve(false);
  // Khóa giữa các tab: refresh token xoay vòng, hai tab gửi cùng token thì tab sau bị IdP từ chối.
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  const run = () => requestRefresh(session.refreshToken, fetchImpl);
  const locked = async () => (locks ? await locks.request("dev_idp_refresh", run) : run());
  inFlight ??= locked().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function requestRefresh(staleRefreshToken: string, fetchImpl: typeof fetch): Promise<boolean> {
  const session = loadSession();
  if (!session) return false;
  // Tab khác đã làm mới trong lúc chờ khóa: dùng luôn token mới.
  if (session.refreshToken !== staleRefreshToken) return true;
  let res: Response;
  try {
    res = await fetchImpl(REFRESH_URL, { method: "POST", headers: { "X-Refresh-Token": session.refreshToken } });
  } catch {
    return false;
  }
  const data = (await res.json().catch(() => null))?.data;
  if (res.ok && data?.accessToken && data?.refreshToken) {
    saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return true;
  }
  // Chỉ xóa khi IdP từ chối refresh token; 5xx/502 khi AUTH khởi động lại thì giữ để lần sau thử lại.
  if (res.status === 400 || res.status === 401 || res.status === 403) clearSession();
  return false;
}

/** Gửi request; 401 thì làm mới token rồi gửi lại đúng một lần (no-op ngoài chế độ dev). */
export async function fetchWithDevRefresh(send: () => Promise<Response>, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const res = await send();
  return res.status === 401 && (await refreshDevSession(fetchImpl)) ? send() : res;
}
