/**
 * Đích khi bấm vào thông báo: payload.targetUrl, rồi payload.deepLink, rồi trang danh sách (đúng thứ tự bản cũ).
 * Khác bản cũ có chủ đích: chỉ nhận đường dẫn nội bộ ("/..."), không nhận URL tuyệt đối hoặc "//host" — dữ liệu thông báo
 * do server/người gửi chiến dịch quyết định, không nên cho phép đưa người dùng ra ngoài ứng dụng bằng một cú bấm.
 */
type TargetPayload = { targetUrl?: unknown; deepLink?: unknown } | null | undefined;

/** Đích nội bộ hợp lệ của thông báo, hoặc null nếu không có (bản cũ: "#" => không điều hướng, chỉ tải lại danh sách). */
export function pickNotificationTarget(payload: TargetPayload): string | null {
  for (const candidate of [payload?.targetUrl, payload?.deepLink]) {
    if (typeof candidate === "string" && candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  }
  return null;
}

export function resolveNotificationTarget(payload: TargetPayload, listHref: string): string {
  return pickNotificationTarget(payload) ?? listHref;
}
