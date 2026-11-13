import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser } from "@/lib/api/auth-client";
import { adminUser } from "./fixtures/classes";

const reply = (status: number, body: unknown = { success: true, data: null }) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe("auth-client (GET /api/auth/users/me qua gateway cùng origin)", () => {
  it("getCurrentUser: GET /api/auth/users/me, kèm cookie phiên của proxy, bóc envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { success: true, data: adminUser }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getCurrentUser()).resolves.toEqual(adminUser);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/users/me");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
    expect(JSON.stringify(init.headers)).not.toMatch(/authorization/i);
  });

  it("401 => ApiError 401 (AuthInitializer coi là chưa đăng nhập)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(401, { success: false })));
    await expect(getCurrentUser()).rejects.toMatchObject({ name: "ApiError", status: 401 });
  });
});
