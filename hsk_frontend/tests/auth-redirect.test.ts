import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAuthFrontendUrl, isAuthFrontendConfigured } from "@/lib/auth/auth-redirect";

afterEach(() => vi.unstubAllEnvs());

describe("buildAuthFrontendUrl", () => {
  it("chưa cấu hình => null (fail-closed)", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "");
    expect(isAuthFrontendConfigured()).toBe(false);
    expect(buildAuthFrontendUrl("/login", "http://app/x")).toBeNull();
  });

  it("cấu hình tuyệt đối: /login?redirect=<url> như trước, bỏ dấu / cuối", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "https://accounts.example.edu.vn/");
    expect(buildAuthFrontendUrl("/login", "https://app.example/a?b=1")).toBe("https://accounts.example.edu.vn/login?redirect=https%3A%2F%2Fapp.example%2Fa%3Fb%3D1");
  });

  it("không có redirect (chuỗi rỗng) => không gắn tham số redirect", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "https://accounts.example.edu.vn");
    expect(buildAuthFrontendUrl("/account/profile", "")).toBe("https://accounts.example.edu.vn/account/profile");
  });

  it("cấu hình đường dẫn cùng origin (Auth qua gateway chung origin): ghép với origin của trang", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "/__auth");
    expect(buildAuthFrontendUrl("/login", "")).toBe(`${window.location.origin}/__auth/login`);
    expect(buildAuthFrontendUrl("/login", "http://x.test/p")).toBe(`${window.location.origin}/__auth/login?redirect=http%3A%2F%2Fx.test%2Fp`);
  });

  it("đường dẫn cùng origin mà chưa có window (render phía server) => null thay vì ném lỗi", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "/__auth");
    vi.stubGlobal("window", undefined);
    try {
      expect(buildAuthFrontendUrl("/login", "")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
