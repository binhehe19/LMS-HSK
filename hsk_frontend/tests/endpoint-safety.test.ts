import { describe, expect, it, vi } from "vitest";
import { isLoopbackHostname, isMockConfigOnRealHost, isMockLikeUrl, mockLikeConfigNames } from "@/lib/api/endpoint-safety";

describe("phát hiện cấu hình MOCK/local", () => {
  it.each([
    "http://localhost:3190/api/auth",
    "http://127.0.0.1:3190",
    "http://127.5.5.5/x",
    "http://[::1]:3000",
    "http://auth.hsk-test.invalid/api/auth",
    "https://lms.stub.test/api",
    "http://app.localhost:3000",
  ])("%s là mock-like", (url) => expect(isMockLikeUrl(url)).toBe(true));

  it.each([
    "https://accounts.example.edu.vn/api/auth",
    "https://lms.hoc-ba.edu.vn",
    "/api/quiz",
    "",
    undefined,
    "https://notlocalhost.example.com",
    "https://invalid.example.com/path",
  ])("%s KHÔNG là mock-like", (url) => expect(isMockLikeUrl(url)).toBe(false));

  it("nhận loopback host", () => {
    expect(["localhost", "127.0.0.1", "[::1]"].every(isLoopbackHostname)).toBe(true);
    expect(isLoopbackHostname("lms.hoc-ba.edu.vn")).toBe(false);
  });

  it("liệt kê đúng biến cấu hình đang trỏ mock", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "https://accounts.example.edu.vn");
    vi.stubEnv("NEXT_PUBLIC_AUTH_API_BASE_URL", "http://localhost:3190/api/auth");
    vi.stubEnv("NEXT_PUBLIC_QUIZ_API_BASE_PATH", "/api/quiz");
    expect(mockLikeConfigNames()).toEqual(["NEXT_PUBLIC_AUTH_API_BASE_URL"]);
  });

  it("biến base path của dịch vụ thông báo và ticket cũng được kiểm tra", () => {
    vi.stubEnv("NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH", "http://localhost:3190/api/notification");
    vi.stubEnv("NEXT_PUBLIC_TICKET_API_BASE_PATH", "http://127.0.0.1:3190/api/tickets");
    vi.stubEnv("NEXT_PUBLIC_ADMIN_USER_API_BASE_PATH", "http://localhost:3190/api/admin/users");
    expect(mockLikeConfigNames()).toEqual(["NEXT_PUBLIC_NOTIFICATION_API_BASE_PATH", "NEXT_PUBLIC_TICKET_API_BASE_PATH", "NEXT_PUBLIC_ADMIN_USER_API_BASE_PATH"]);
    expect(isMockConfigOnRealHost("lms.hoc-ba.edu.vn")).toBe(true);
  });

  it("chặn cấu hình mock khi trang chạy trên host thật, cho phép trên loopback", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_API_BASE_URL", "http://localhost:3190/api/auth");
    expect(isMockConfigOnRealHost("lms.hoc-ba.edu.vn")).toBe(true);
    expect(isMockConfigOnRealHost("localhost")).toBe(false);
  });

  it("cấu hình thật trên host thật không bị chặn", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "https://accounts.example.edu.vn");
    vi.stubEnv("NEXT_PUBLIC_AUTH_API_BASE_URL", "https://accounts.example.edu.vn/api/auth");
    vi.stubEnv("NEXT_PUBLIC_QUIZ_API_BASE_PATH", "/api/quiz");
    expect(isMockConfigOnRealHost("lms.hoc-ba.edu.vn")).toBe(false);
  });
});
