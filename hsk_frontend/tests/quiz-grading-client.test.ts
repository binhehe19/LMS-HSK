import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { listAdminGradingClasses } from "@/lib/api/quiz-grading-client";
import { classesFixture } from "./fixtures/classes";

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

describe("listAdminGradingClasses (hợp đồng GET /grading/admin/classes của quiz service)", () => {
  it("chưa cấu hình NEXT_PUBLIC_QUIZ_API_BASE_PATH => ApiNotConfiguredError và KHÔNG gọi mạng", async () => {
    vi.stubEnv("NEXT_PUBLIC_QUIZ_API_BASE_PATH", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(listAdminGradingClasses()).rejects.toBeInstanceOf(ApiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("base tuyệt đối: URL = base + /grading/admin/classes, GET, dùng cookie, không gắn Authorization", async () => {
    vi.stubEnv("NEXT_PUBLIC_QUIZ_API_BASE_PATH", "http://lms.test.invalid/api/quiz/");
    const fetchMock = respond(200, { success: true, data: classesFixture });
    vi.stubGlobal("fetch", fetchMock);
    await expect(listAdminGradingClasses()).resolves.toEqual(classesFixture);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://lms.test.invalid/api/quiz/grading/admin/classes");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
    expect(JSON.stringify(init.headers)).not.toMatch(/authorization/i);
  });

  it("base cùng origin (đường dẫn tương đối, dùng được với proxy/rewrites)", async () => {
    vi.stubEnv("NEXT_PUBLIC_QUIZ_API_BASE_PATH", "/api/quiz");
    const fetchMock = respond(200, classesFixture);
    vi.stubGlobal("fetch", fetchMock);
    await expect(listAdminGradingClasses()).resolves.toEqual(classesFixture);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/quiz/grading/admin/classes");
  });

  it("HTTP 401 => ApiError 401, không tự thử lại (phiên do oauth2-proxy giữ)", async () => {
    vi.stubEnv("NEXT_PUBLIC_QUIZ_API_BASE_PATH", "/api/quiz");
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(listAdminGradingClasses()).rejects.toMatchObject({ name: "ApiError", status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([403, 404, 500])("HTTP %i => ApiError mang đúng status", async (status) => {
    vi.stubEnv("NEXT_PUBLIC_QUIZ_API_BASE_PATH", "/api/quiz");
    vi.stubGlobal("fetch", respond(status, ""));
    await expect(listAdminGradingClasses()).rejects.toMatchObject({ name: "ApiError", status });
  });

  it("không dùng trang HTML lỗi của proxy làm thông báo", async () => {
    vi.stubEnv("NEXT_PUBLIC_QUIZ_API_BASE_PATH", "/api/quiz");
    vi.stubGlobal("fetch", respond(502, "<html><body>Bad gateway cloudflare</body></html>"));
    const error = await listAdminGradingClasses().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).not.toMatch(/<html/i);
  });

  it("mất kết nối => ApiError status 0", async () => {
    vi.stubEnv("NEXT_PUBLIC_QUIZ_API_BASE_PATH", "/api/quiz");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(listAdminGradingClasses()).rejects.toMatchObject({ name: "ApiError", status: 0 });
  });
});
