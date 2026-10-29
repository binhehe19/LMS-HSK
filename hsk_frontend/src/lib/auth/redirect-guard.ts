// Chống vòng lặp HSK → Authentication → HSK. Authentication_Frontend không tự đưa người dùng đang có phiên quay về,
// nên vòng lặp chỉ xảy ra khi đăng nhập xong mà HSK vẫn không thiết lập được phiên (cookie không đi kèm vì khác ROOT_DOMAIN,
// token ở hash bị từ chối...). Mỗi tab (sessionStorage) chỉ được tự động chuyển sang Auth một lần trong cửa sổ thời gian;
// lần sau hiện hướng dẫn và để NGƯỜI DÙNG chủ động bấm. Marker bị xóa khi phiên được thiết lập thành công.
const KEY = "hsk.auth.redirected-at";
const WINDOW_MS = 2 * 60 * 1000;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function markAuthRedirect(): void {
  try {
    storage()?.setItem(KEY, String(Date.now()));
  } catch {
    // Không có sessionStorage: không có marker; vẫn chuyển một lần (không thể phát hiện lặp).
  }
}

export function hasRecentAuthRedirect(): boolean {
  try {
    const raw = storage()?.getItem(KEY);
    const at = raw ? Number(raw) : NaN;
    return Number.isFinite(at) && Date.now() - at >= 0 && Date.now() - at < WINDOW_MS;
  } catch {
    return false;
  }
}

export function clearAuthRedirectMark(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // bỏ qua
  }
}
