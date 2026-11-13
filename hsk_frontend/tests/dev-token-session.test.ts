import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bearerHeaders,
  buildLoginUrl,
  clearSession,
  fetchWithDevRefresh,
  loadSession,
  parseTokenHash,
  safeReturnTo,
  saveSession,
} from "@/lib/auth/dev-token-session";

const reply = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

beforeEach(() => clearSession());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("parseTokenHash / safeReturnTo / buildLoginUrl", () => {
  it("hash thiếu một trong hai token => null", () => {
    expect(parseTokenHash("#access_token=a&refresh_token=r")).toEqual({ accessToken: "a", refreshToken: "r" });
    expect(parseTokenHash("#access_token=a")).toBeNull();
    expect(parseTokenHash("")).toBeNull();
  });

  it("returnTo chỉ nhận đường dẫn tương đối cùng origin", () => {
    expect(safeReturnTo("/admin/x?y=1")).toBe("/admin/x?y=1");
    for (const bad of [null, "", "https://evil.test", "//evil.test", "/\\evil.test"]) expect(safeReturnTo(bad)).toBe("/");
  });

  it("buildLoginUrl: /login?continue=<callback của app kèm rd>", () => {
    expect(buildLoginUrl("https://accounts.x", "http://localhost:3000", "/a?b=1")).toBe(
      `https://accounts.x/login?continue=${encodeURIComponent("http://localhost:3000/dev-auth/callback?rd=%2Fa%3Fb%3D1")}`,
    );
  });
});

describe("chỉ hoạt động ở `next dev`", () => {
  it("ngoài dev: không gắn Bearer dù localStorage có token, và 401 không refresh", async () => {
    saveSession({ accessToken: "a", refreshToken: "r" });
    expect(bearerHeaders()).toEqual({});
    const fetchMock = vi.fn();
    const send = vi.fn().mockResolvedValue(reply(401));
    const res = await fetchWithDevRefresh(send, fetchMock);
    expect(res.status).toBe(401);
    expect(send).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dev: gắn Bearer từ phiên đã lưu", () => {
    vi.stubEnv("NODE_ENV", "development");
    saveSession({ accessToken: "a", refreshToken: "r" });
    expect(bearerHeaders()).toEqual({ Authorization: "Bearer a" });
    expect(loadSession()).toEqual({ accessToken: "a", refreshToken: "r" });
  });

  it("dev: 401 => refresh bằng X-Refresh-Token, lưu token mới rồi gửi lại đúng một lần", async () => {
    vi.stubEnv("NODE_ENV", "development");
    saveSession({ accessToken: "old", refreshToken: "r1" });
    const refresh = vi.fn().mockResolvedValue(reply(200, { data: { accessToken: "new", refreshToken: "r2" } }));
    const send = vi.fn().mockResolvedValueOnce(reply(401)).mockResolvedValueOnce(reply(200));
    const res = await fetchWithDevRefresh(send, refresh);
    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledWith("/api/auth/refresh", { method: "POST", headers: { "X-Refresh-Token": "r1" } });
    expect(loadSession()).toEqual({ accessToken: "new", refreshToken: "r2" });
  });

  it("dev: IdP từ chối refresh (401) => xóa phiên, trả 401 gốc, không gửi lại", async () => {
    vi.stubEnv("NODE_ENV", "development");
    saveSession({ accessToken: "old", refreshToken: "r1" });
    const refresh = vi.fn().mockResolvedValue(reply(401));
    const send = vi.fn().mockResolvedValue(reply(401));
    const res = await fetchWithDevRefresh(send, refresh);
    expect(res.status).toBe(401);
    expect(send).toHaveBeenCalledTimes(1);
    expect(loadSession()).toBeNull();
  });

  it("dev: lỗi máy chủ khi refresh (5xx) => giữ phiên để lần sau thử lại", async () => {
    vi.stubEnv("NODE_ENV", "development");
    saveSession({ accessToken: "old", refreshToken: "r1" });
    const refresh = vi.fn().mockResolvedValue(reply(502));
    await fetchWithDevRefresh(vi.fn().mockResolvedValue(reply(401)), refresh);
    expect(loadSession()).toEqual({ accessToken: "old", refreshToken: "r1" });
  });
});
