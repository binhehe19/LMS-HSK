import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifySessionExpired, refreshSessionOnce, subscribeSessionExpired } from "@/lib/api/auth-session";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/lib/auth/token-store";

const jwt = (tag: string) => `eyJhbGciOiJub25lIn0.${tag}payload.mocksig`;
const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  clearTokens();
  vi.stubEnv("NEXT_PUBLIC_AUTH_API_BASE_URL", "http://auth.test.invalid/api/auth/");
});
afterEach(() => vi.unstubAllGlobals());

describe("refreshSessionOnce (POST /refresh)", () => {
  it("cookie-only: không có refresh token trong bộ nhớ => POST không body, dùng cookie (credentials include)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { success: true, data: { expiresInSeconds: 900 } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(refreshSessionOnce()).resolves.toBe("refreshed");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://auth.test.invalid/api/auth/refresh");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.body).toBeUndefined();
  });

  it("chế độ token: gửi {refreshToken} và nhận token mới vào bộ nhớ", async () => {
    setTokens({ accessToken: jwt("old"), refreshToken: jwt("r1") });
    const fetchMock = vi.fn().mockResolvedValue(json(200, { success: true, data: { accessToken: jwt("new"), refreshToken: jwt("r2") } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(refreshSessionOnce()).resolves.toBe("refreshed");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refreshToken: jwt("r1") });
    expect(getAccessToken()).toBe(jwt("new"));
    expect(getRefreshToken()).toBe(jwt("r2"));
  });

  it("thành công nhưng body không có token (cookie rotate) => bỏ Bearer cũ để dùng cookie mới", async () => {
    setTokens({ accessToken: jwt("stale"), refreshToken: jwt("r1") });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(200, { success: true, data: { expiresInSeconds: 900 } })));
    await refreshSessionOnce();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it.each([400, 401, 403])("HTTP %i => expired và xóa token", async (status) => {
    setTokens({ accessToken: jwt("a"), refreshToken: jwt("r") });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(status, { success: false })));
    await expect(refreshSessionOnce()).resolves.toBe("expired");
    expect(getAccessToken()).toBeNull();
  });

  it.each([500, 502, 503, 429])("HTTP %i => unavailable, KHÔNG xóa token", async (status) => {
    setTokens({ accessToken: jwt("a"), refreshToken: jwt("r") });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(status)));
    await expect(refreshSessionOnce()).resolves.toBe("unavailable");
    expect(getAccessToken()).toBe(jwt("a"));
  });

  it("mất mạng => unavailable (không phải hết phiên), KHÔNG xóa token", async () => {
    setTokens({ accessToken: jwt("a"), refreshToken: jwt("r") });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(refreshSessionOnce()).resolves.toBe("unavailable");
    expect(getRefreshToken()).toBe(jwt("r"));
  });

  it("chưa cấu hình Auth API => unavailable và không gọi mạng", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_API_BASE_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(refreshSessionOnce()).resolves.toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("nhiều lời gọi đồng thời chỉ gây MỘT request refresh (single-flight), rồi lần sau gọi lại được", async () => {
    let resolveFetch!: (r: Response) => void;
    const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>((r) => (resolveFetch = r)));
    vi.stubGlobal("fetch", fetchMock);
    const all = Promise.all([refreshSessionOnce(), refreshSessionOnce(), refreshSessionOnce()]);
    resolveFetch(json(200, { success: true, data: {} }));
    await expect(all).resolves.toEqual(["refreshed", "refreshed", "refreshed"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValue(json(200, { success: true, data: {} }));
    await refreshSessionOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("thông báo phiên hết hạn", () => {
  it("gọi mọi listener đang đăng ký và hủy đăng ký hoạt động", () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeSessionExpired(a);
    subscribeSessionExpired(b)();
    notifySessionExpired();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    offA();
  });
});
