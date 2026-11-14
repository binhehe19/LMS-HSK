import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api/api-client";
import { subscribeSessionExpired } from "@/lib/api/auth-session";

const reply = (status: number, body: unknown = { success: true, data: { ok: true } }) => new Response(JSON.stringify(body), { status });
const BASE = "http://svc.test.invalid/api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

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

describe("apiFetch + xác thực (phiên là cookie của oauth2-proxy)", () => {
  it("luôn gửi cookie và KHÔNG tự gắn Authorization (proxy gắn cho service phía sau)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200));
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch(BASE, "/x");
    const init = fetchMock.mock.calls[0][1];
    expect(init.credentials).toBe("include");
    expect(JSON.stringify(init.headers)).not.toMatch(/authorization/i);
  });

  it("401 => thông báo hết phiên MỘT lần, trả ApiError 401, KHÔNG tự thử lại", async () => {
    const expired = vi.fn();
    const off = subscribeSessionExpired(expired);
    const fetchMock = vi.fn().mockResolvedValue(reply(401, { success: false }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiFetch(BASE, "/x")).rejects.toMatchObject({ name: "ApiError", status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(expired).toHaveBeenCalledTimes(1);
    off();
  });

  it("lỗi khác 401 (403/404/500) không báo hết phiên", async () => {
    const expired = vi.fn();
    const off = subscribeSessionExpired(expired);
    for (const status of [403, 404, 500]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(status, { success: false })));
      await expect(apiFetch(BASE, "/x")).rejects.toMatchObject({ status });
    }
    expect(expired).not.toHaveBeenCalled();
    off();
  });

  it("mất mạng => ApiError status 0, không báo hết phiên", async () => {
    const expired = vi.fn();
    const off = subscribeSessionExpired(expired);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(apiFetch(BASE, "/x")).rejects.toMatchObject({ status: 0 });
    expect(expired).not.toHaveBeenCalled();
    off();
  });
});
