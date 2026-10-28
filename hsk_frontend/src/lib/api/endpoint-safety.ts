// Phát hiện cấu hình trỏ tới môi trường MOCK/local (localhost, loopback, host .invalid/.test/.localhost). Dùng ở hai nơi
// độc lập nhau để mock không thể lọt vào production: (1) next.config.ts khi build/start production, (2) AuthInitializer lúc chạy:
// nếu trang đang được phục vụ từ host KHÔNG phải loopback mà cấu hình vẫn trỏ mock thì từ chối chạy (không gọi mạng).
// Cố ý không import gì (next.config.ts nạp file này trực tiếp).
const MOCK_LIKE = /(^|\/\/)(localhost|127\.\d+\.\d+\.\d+|\[::1\]|[^/:]+\.(invalid|test|localhost))(:|\/|$)/i;

export function isMockLikeUrl(value: string | undefined | null): boolean {
  return !!value && MOCK_LIKE.test(value.trim());
}

export function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "[::1]" || hostname === "::1" || /^127\.\d+\.\d+\.\d+$/.test(hostname);
}

/** Tên các biến cấu hình (đã nhúng lúc build) đang trỏ mock. Mỗi biến NEXT_PUBLIC phải được tham chiếu TĨNH. */
export function mockLikeConfigNames(): string[] {
  const entries: [string, string | undefined][] = [
    ["NEXT_PUBLIC_AUTH_FRONTEND_URL", process.env.NEXT_PUBLIC_AUTH_FRONTEND_URL],
    ["NEXT_PUBLIC_AUTH_API_BASE_URL", process.env.NEXT_PUBLIC_AUTH_API_BASE_URL],
    ["NEXT_PUBLIC_QUIZ_API_BASE_PATH", process.env.NEXT_PUBLIC_QUIZ_API_BASE_PATH],
    ["NEXT_PUBLIC_LMS_API_BASE_PATH", process.env.NEXT_PUBLIC_LMS_API_BASE_PATH],
    ["NEXT_PUBLIC_STORAGE_API_BASE_PATH", process.env.NEXT_PUBLIC_STORAGE_API_BASE_PATH],
    ["NEXT_PUBLIC_HSK_API_BASE_PATH", process.env.NEXT_PUBLIC_HSK_API_BASE_PATH],
    ["NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH", process.env.NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH],
    ["NEXT_PUBLIC_TICKET_API_BASE_PATH", process.env.NEXT_PUBLIC_TICKET_API_BASE_PATH],
    ["NEXT_PUBLIC_ADMIN_USER_API_BASE_PATH", process.env.NEXT_PUBLIC_ADMIN_USER_API_BASE_PATH],
  ];
  return entries.filter(([, value]) => isMockLikeUrl(value)).map(([name]) => name);
}

/** true nếu đang chạy trên trình duyệt ở host không phải loopback mà cấu hình vẫn trỏ mock. */
export function isMockConfigOnRealHost(hostname: string): boolean {
  return !isLoopbackHostname(hostname) && mockLikeConfigNames().length > 0;
}
