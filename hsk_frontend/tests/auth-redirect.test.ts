import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAuthFrontendUrl, isAuthFrontendConfigured, redirectToAuthFrontend, redirectToSignOut } from "@/lib/auth/auth-redirect";

const assign = vi.fn();
const realLocation = Object.getOwnPropertyDescriptor(window, "location")!;
function stubLocation(pathname = "/admin/classes", search = "?page=2") {
  assign.mockClear();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { origin: "https://hsk.example.edu.vn", pathname, search, assign },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "location", realLocation);
});

describe("redirectToAuthFrontend (đăng nhập qua oauth2-proxy)", () => {
  it("mặc định: /oauth2/start?rd=<trang hiện tại gồm query>, không cần cấu hình Auth", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "");
    stubLocation();
    expect(redirectToAuthFrontend()).toBe(true);
    expect(assign).toHaveBeenCalledWith("/oauth2/start?rd=%2Fadmin%2Fclasses%3Fpage%3D2");
  });

  it("truyền returnTo thì quay về đó", () => {
    stubLocation();
    redirectToAuthFrontend("/login", "/student/home");
    expect(assign).toHaveBeenCalledWith("/oauth2/start?rd=%2Fstudent%2Fhome");
  });

  it("`next dev`: sang trang đăng nhập của tài khoản, quay về /dev-auth/callback của app", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "https://accounts.example.edu.vn/");
    stubLocation();
    expect(redirectToAuthFrontend()).toBe(true);
    const target = new URL(assign.mock.calls[0][0] as string);
    expect(target.origin + target.pathname).toBe("https://accounts.example.edu.vn/login");
    expect(target.searchParams.get("continue")).toBe("https://hsk.example.edu.vn/dev-auth/callback?rd=%2Fadmin%2Fclasses%3Fpage%3D2");
  });

  it("`next dev` thiếu NEXT_PUBLIC_AUTH_FRONTEND_URL => không chuyển trang (fail-closed)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "");
    stubLocation();
    expect(redirectToAuthFrontend()).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });

  it("trang khác của Auth (hồ sơ) mở thẳng ở host của IdP", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "https://accounts.example.edu.vn");
    stubLocation();
    redirectToAuthFrontend("/account/profile", "");
    expect(assign).toHaveBeenCalledWith("https://accounts.example.edu.vn/account/profile");
  });
});

describe("redirectToSignOut", () => {
  it("xóa phiên proxy rồi sang IdP kết thúc phiên chung (client lms), quay về trang gốc của app", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "https://accounts.example.edu.vn");
    stubLocation();
    redirectToSignOut();
    const idpLogout = "https://accounts.example.edu.vn/api/auth/logout/idp?client_id=lms&post_logout_redirect_uri=https%3A%2F%2Fhsk.example.edu.vn%2F";
    expect(assign).toHaveBeenCalledWith(`/oauth2/sign_out?rd=${encodeURIComponent(idpLogout)}`);
  });

  it("thiếu cấu hình Auth => vẫn xóa phiên proxy và về trang gốc", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "");
    stubLocation();
    redirectToSignOut();
    expect(assign).toHaveBeenCalledWith("/oauth2/sign_out?rd=%2F");
  });
});

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
