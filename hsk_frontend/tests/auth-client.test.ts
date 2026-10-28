import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiNotConfiguredError } from "@/lib/api/api-client";
import { getCurrentUser, logoutRemote } from "@/lib/api/auth-client";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/lib/auth/token-store";
import { adminUser } from "./fixtures/classes";

const jwt = (tag: string) => `eyJhbGciOiJub25lIn0.${tag}payload.mocksig`;
const reply = (status: number, body: unknown = { success: true, data: null }) => new Response(JSON.stringify(body), { status });

beforeEach(() => clearTokens());
afterEach(() => vi.unstubAllGlobals());

describe("auth-client (GET /users/me, POST /logout)", () => {
  it("chưa cấu hình NEXT_PUBLIC_AUTH_API_BASE_URL => getCurrentUser là promise bị reject, KHÔNG ném đồng bộ", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_API_BASE_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getCurrentUser()).rejects.toBeInstanceOf(ApiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("getCurrentUser: GET {base}/users/me, credentials include, bóc envelope", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_API_BASE_URL", "http://auth.test.invalid/api/auth/");
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { success: true, data: adminUser }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getCurrentUser()).resolves.toEqual(adminUser);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://auth.test.invalid/api/auth/users/me");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
  });

  it("getCurrentUser gắn Bearer khi tab đang giữ token (chế độ hash)", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_API_BASE_URL", "http://auth.test.invalid/api/auth");
    setTokens({ accessToken: jwt("a") });
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { success: true, data: adminUser }));
    vi.stubGlobal("fetch", fetchMock);
    await getCurrentUser();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${jwt("a")}`);
  });

  it("logoutRemote: POST {base}/logout kèm refreshToken nếu có, quên token, KHÔNG refresh khi 401", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_API_BASE_URL", "http://auth.test.invalid/api/auth");
    setTokens({ accessToken: jwt("a"), refreshToken: jwt("r") });
    const fetchMock = vi.fn().mockResolvedValue(reply(401, { success: false }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(logoutRemote()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://auth.test.invalid/api/auth/logout");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ refreshToken: jwt("r") });
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("logoutRemote không bao giờ ném lỗi (mạng/chưa cấu hình đều bị nuốt) và luôn quên token", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_API_BASE_URL", "http://auth.test.invalid/api/auth");
    setTokens({ accessToken: jwt("a") });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(logoutRemote()).resolves.toBeUndefined();
    expect(getAccessToken()).toBeNull();

    setTokens({ accessToken: jwt("b") });
    vi.stubEnv("NEXT_PUBLIC_AUTH_API_BASE_URL", "");
    await expect(logoutRemote()).resolves.toBeUndefined();
    expect(getAccessToken()).toBeNull();
  });

  it("logoutRemote không có refresh token => POST không body (Auth dùng cookie)", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_API_BASE_URL", "http://auth.test.invalid/api/auth");
    const fetchMock = vi.fn().mockResolvedValue(reply(200));
    vi.stubGlobal("fetch", fetchMock);
    await logoutRemote();
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });
});
