// Điều khiển máy chủ giả lập (scripts/mock-server.mjs). MOCK / NOT INTEGRATED: không phải Authentication hay backend thật.
export const MOCK_ORIGIN = "http://127.0.0.1:3190"; // gọi từ test (Node)
export const MOCK_PUBLIC = "http://localhost:3190"; // địa chỉ trình duyệt dùng (cùng host "localhost" với app để cookie dùng chung)

export const ROLES = ["admin", "teacher", "mentor", "teacher-manager", "manager", "collaborator", "user", "none"] as const;
export type MockRole = (typeof ROLES)[number];

export interface MockState {
  counters: Record<string, number>;
  sessions: number;
  controls: Record<string, unknown>;
  /** classId của lời gọi API buổi học gần nhất (null nếu chưa có) — kiểm tra contract tham số. */
  lastLessonsClassId?: string | null;
  campaignsSent?: unknown[];
}

async function call<T = unknown>(path: string): Promise<T> {
  // Mock không phản hồi => lỗi rõ ràng sau 10 giây (không treo tới hết timeout của test).
  const res = await fetch(`${MOCK_ORIGIN}${path}`, { signal: AbortSignal.timeout(10_000) });
  const body = (await res.json()) as { data: T };
  return body.data;
}

export const resetMock = () => call("/mock-reset");
export const mockState = () => call<MockState>("/mock-state");
export const expireAccessTokens = () => call("/mock-expire");

/** Đặt điều khiển: meDown=1, classes401=once|always, notif=ok|empty|error|slow, unread=<số>, tickets=none|some|error. */
export function control(params: Record<string, string | number>) {
  return call(`/mock-control?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`);
}

export interface LoginOptions {
  role?: MockRole;
  transport?: "cookie" | "hash";
  access?: "valid" | "expired";
  refresh?: "ok" | "fail" | "down";
  state?: "ok" | "empty" | "error" | "slow" | "invalid";
  /** Đặt "1" để mock phát token giả dạng JWT nhưng server từ chối (kiểm tra chống vòng lặp). */
  bad?: "1";
}

/** URL trang đăng nhập GIẢ LẬP kèm thông số; sau khi chọn xong mock chuyển về `redirect` kèm phiên. */
export function mockLoginUrl(redirect: string, options: LoginOptions = {}): string {
  const q = new URLSearchParams({ role: "admin", transport: "cookie", access: "valid", refresh: "ok", state: "ok" });
  for (const [k, v] of Object.entries(options)) if (v !== undefined) q.set(k, String(v));
  q.set("redirect", redirect);
  return `${MOCK_PUBLIC}/mock-login?${q}`;
}

/** Trang đăng nhập GIẢ LẬP: qua gateway cách ly (/__auth/login, bản build production) hoặc trực tiếp mock (localhost:3190/login, chế độ `next dev`). */
export const AUTH_LOGIN_URL = /(\/__auth|localhost:3190)\/login(\?|$)/;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const FONT_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]); // app tải Inter/Nunito như HSK cũ; chỉ GET tài nguyên chữ

/** true nếu trình duyệt được phép gọi URL này trong e2e: loopback, hoặc Google Fonts. Mọi thứ khác bị chặn và làm test thất bại (không gọi Auth/backend thật). */
export function isAllowedE2eUrl(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return true; // data:, blob:, about:
  return LOCAL_HOSTS.has(url.hostname) || FONT_HOSTS.has(url.hostname);
}
