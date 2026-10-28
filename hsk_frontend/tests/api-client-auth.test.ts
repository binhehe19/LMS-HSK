import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "@/lib/api/api-client";
import { subscribeSessionExpired } from "@/lib/api/auth-session";
import { clearTokens, getAccessToken, setTokens } from "@/lib/auth/token-store";

const jwt = (tag: string) => `eyJhbGciOiJub25lIn0.${tag}payload.mocksig`;
const reply = (status: number, body: unknown = { success: true, data: { ok: true } }) => new Response(JSON.stringify(body), { status });
const BASE = "http://svc.test.invalid/api";
const isRefresh = (url: string) => url.endsWith("/refresh");

beforeEach(() => {
  clearTokens();
  vi.stubEnv("NEXT_PUBLIC_AUTH_API_BASE_URL", "http://auth.test.invalid/api/auth");
});
afterEach(() => vi.unstubAllGlobals());

describe("apiFetch: ghép URL", () => {
  it.each([
    [BASE, "/x", `${BASE}/x`],
    [`${BASE}/`, "/x", `${BASE}/x`],
    [BASE, "x", `${BASE}/x`],
    [BASE, "?page=0&size=10", `${BASE}?page=0&size=10`], // không được thành ".../api/?page=0"
    [BASE, "/", `${BASE}/`],
  ])("%s + %s => %s", async (base, path, expected) => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200));
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch(base, path);
    expect(fetchMock.mock.calls[0][0]).toBe(expected);
  });
});

describe("apiFetch + xác thực (Bearer, refresh một lần)", () => {
  it("không có token trong bộ nhớ => chỉ cookie, KHÔNG gắn Authorization", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200));
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch(BASE, "/x");
    const init = fetchMock.mock.calls[0][1];
    expect(init.credentials).toBe("include");
    expect(JSON.stringify(init.headers)).not.toMatch(/authorization/i);
  });

  it("có access token trong bộ nhớ => gắn Authorization: Bearer", async () => {
    setTokens({ accessToken: jwt("a") });
    const fetchMock = vi.fn().mockResolvedValue(reply(200));
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch(BASE, "/x");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${jwt("a")}`);
  });

  it("401 => refresh một lần rồi thử lại đúng một lần với token mới, trả kết quả", async () => {
    setTokens({ accessToken: jwt("old"), refreshToken: jwt("r") });
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        calls.push(`${init.method ?? "GET"} ${url}`);
        if (isRefresh(url)) return reply(200, { success: true, data: { accessToken: jwt("new"), refreshToken: jwt("r2") } });
        const auth = (init.headers as Record<string, string>).Authorization;
        return auth === `Bearer ${jwt("new")}` ? reply(200, { success: true, data: { v: 1 } }) : reply(401, { success: false });
      }),
    );
    await expect(apiFetch(BASE, "/x")).resolves.toEqual({ v: 1 });
    expect(calls).toEqual([`GET ${BASE}/x`, "POST http://auth.test.invalid/api/auth/refresh", `GET ${BASE}/x`]);
    expect(getAccessToken()).toBe(jwt("new"));
  });

  it("401 lần hai sau khi refresh thành công => dừng, KHÔNG refresh/thử lại thêm (không vòng lặp)", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => (isRefresh(url) ? reply(200, { success: true, data: {} }) : reply(401, { success: false })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiFetch(BASE, "/x")).rejects.toMatchObject({ name: "ApiError", status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(3); // gốc, refresh, thử lại
  });

  it("refresh bị từ chối (401) => thông báo hết phiên MỘT lần, trả lỗi 401 gốc, không thử lại", async () => {
    const expired = vi.fn();
    const off = subscribeSessionExpired(expired);
    const fetchMock = vi.fn().mockImplementation(async (url: string) => (isRefresh(url) ? reply(401, { success: false }) : reply(401, { success: false })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiFetch(BASE, "/x")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(expired).toHaveBeenCalledTimes(1);
    off();
  });

  it("Auth lỗi/mất mạng khi refresh => ApiError 503, KHÔNG báo hết phiên", async () => {
    const expired = vi.fn();
    const off = subscribeSessionExpired(expired);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => (isRefresh(url) ? reply(500) : reply(401, { success: false }))));
    const error = await apiFetch(BASE, "/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(503);
    expect(expired).not.toHaveBeenCalled();
    off();
  });

  it("nhiều request cùng gặp 401 chỉ gây MỘT refresh, rồi cả ba được thử lại", async () => {
    let refreshed = false;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (isRefresh(url)) {
        await new Promise((r) => setTimeout(r, 20));
        refreshed = true;
        return reply(200, { success: true, data: {} });
      }
      return refreshed ? reply(200) : reply(401, { success: false });
    });
    vi.stubGlobal("fetch", fetchMock);
    await Promise.all([apiFetch(BASE, "/a"), apiFetch(BASE, "/b"), apiFetch(BASE, "/c")]);
    expect(fetchMock.mock.calls.filter(([u]) => isRefresh(u as string))).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(7); // 3 gốc + 1 refresh + 3 thử lại
  });

  it("skipRefresh => 401 trả thẳng, không refresh", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(401, { success: false }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiFetch(BASE, "/logout", { method: "POST", skipRefresh: true })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lỗi khác 401 (403/500) không kích hoạt refresh", async () => {
    for (const status of [403, 404, 500]) {
      const fetchMock = vi.fn().mockResolvedValue(reply(status, { success: false }));
      vi.stubGlobal("fetch", fetchMock);
      await expect(apiFetch(BASE, "/x")).rejects.toMatchObject({ status });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });
});
