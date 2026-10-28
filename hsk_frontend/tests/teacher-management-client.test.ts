import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import {
  activateTeacher,
  blockTeacher,
  createTeacher,
  fetchRecentlyCreatedTeachers,
  fetchTeacherJobStatus,
  fetchTeachers,
  importTeachers,
  resendTeacherAccountEmail,
  syncTeachersFromCms,
  updateTeacher,
} from "@/lib/api/teacher-management-client";
import { WriteDisabledError } from "@/lib/api/write-gate";
import { teacher, teachersFixture } from "./fixtures/teachers";

const respond = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "/api/hsk");
  vi.stubEnv("NEXT_PUBLIC_WRITE_TEACHER_MANAGEMENT", "");
});
afterEach(() => vi.unstubAllGlobals());

describe("teacher-management-client — đọc (hợp đồng /id/teachers của dịch vụ HSK)", () => {
  it("chưa cấu hình NEXT_PUBLIC_HSK_API_BASE_PATH => ApiNotConfiguredError, KHÔNG gọi mạng (cả ba hàm đọc)", async () => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchTeachers()).rejects.toBeInstanceOf(ApiNotConfiguredError);
    await expect(fetchTeacherJobStatus()).rejects.toBeInstanceOf(ApiNotConfiguredError);
    await expect(fetchRecentlyCreatedTeachers()).rejects.toBeInstanceOf(ApiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GET /id/teachers: đúng URL, GET, cookie, bóc envelope {success,data}", async () => {
    const fetchMock = respond(200, { success: true, data: teachersFixture });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchTeachers()).resolves.toEqual(teachersFixture);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/hsk/id/teachers");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
  });

  it("GET /import/status và /recently-created đúng đường dẫn kế thừa", async () => {
    const fetchMock = respond(200, { success: true, data: {} });
    vi.stubGlobal("fetch", fetchMock);
    await fetchTeacherJobStatus();
    await fetchRecentlyCreatedTeachers();
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(["/api/hsk/id/teachers/import/status", "/api/hsk/id/teachers/recently-created"]);
  });

  it.each([401, 403, 404, 500])("HTTP %i => ApiError mang đúng status", async (status) => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_API_BASE_URL", "http://auth.test.invalid/api/auth");
    vi.stubGlobal("fetch", respond(status, ""));
    await expect(fetchTeachers()).rejects.toMatchObject({ name: "ApiError", status });
  });
});

describe("teacher-management-client — GHI qua write gate 'teacher-management'", () => {
  it("công tắc đóng (không demo, không cờ) => WriteDisabledError cho MỌI hàm ghi, không có request nào", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(syncTeachersFromCms(false)).rejects.toBeInstanceOf(WriteDisabledError);
    await expect(createTeacher({ email: "a@b.vn", fullName: "A" }, false)).rejects.toBeInstanceOf(WriteDisabledError);
    await expect(updateTeacher("gv-1", { fullName: "B" }, false)).rejects.toBeInstanceOf(WriteDisabledError);
    await expect(resendTeacherAccountEmail("gv-1", false)).rejects.toBeInstanceOf(WriteDisabledError);
    await expect(blockTeacher("gv-1", false)).rejects.toBeInstanceOf(WriteDisabledError);
    await expect(activateTeacher("gv-1", false)).rejects.toBeInstanceOf(WriteDisabledError);
    await expect(importTeachers(new File(["a"], "a.csv"), false)).rejects.toBeInstanceOf(WriteDisabledError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cờ NEXT_PUBLIC_WRITE_TEACHER_MANAGEMENT=enabled mở công tắc khi không demo", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_TEACHER_MANAGEMENT", "enabled");
    const fetchMock = respond(200, { success: true, data: teacher(1, { status: "BLOCKED" }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(blockTeacher("gv-1", false)).resolves.toMatchObject({ status: "BLOCKED" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/hsk/id/teachers/gv-1/block");
  });

  it("demo: POST /id/teachers gửi JSON body; PUT /{id}; POST /{id}/resend-account-email; /block; /activate; /sync — mỗi thao tác một endpoint", async () => {
    const fetchMock = respond(200, { success: true, data: { ok: true } });
    vi.stubGlobal("fetch", fetchMock);
    await createTeacher({ email: "a@b.vn", fullName: "A", qualification: "HSK 6" }, true);
    await updateTeacher("gv 1", { fullName: "B" }, true);
    await resendTeacherAccountEmail("gv-1", true);
    await blockTeacher("gv-1", true);
    await activateTeacher("gv-1", true);
    await syncTeachersFromCms(true);
    const calls = fetchMock.mock.calls.map(([url, init]) => [url, init.method, init.body]);
    expect(calls).toEqual([
      ["/api/hsk/id/teachers", "POST", JSON.stringify({ email: "a@b.vn", fullName: "A", qualification: "HSK 6" })],
      ["/api/hsk/id/teachers/gv%201", "PUT", JSON.stringify({ fullName: "B" })],
      ["/api/hsk/id/teachers/gv-1/resend-account-email", "POST", undefined],
      ["/api/hsk/id/teachers/gv-1/block", "POST", undefined],
      ["/api/hsk/id/teachers/gv-1/activate", "POST", undefined],
      ["/api/hsk/id/teachers/sync", "POST", undefined],
    ]);
    // không có DELETE / PUT {status} dự phòng như service cũ
    expect(fetchMock.mock.calls.some(([, init]) => init.method === "DELETE" || String(init.body ?? "").includes("status"))).toBe(false);
  });

  it("import: POST multipart với trường `file`, KHÔNG đặt Content-Type JSON (trình duyệt tự đặt boundary), dùng cookie", async () => {
    const fetchMock = respond(200, { success: true, data: { createdCount: 1, items: [] } });
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["Email (*),Họ và tên (*)\r\na@b.vn,A\r\n"], "mau.csv", { type: "text/csv" });
    await expect(importTeachers(file, true)).resolves.toEqual({ createdCount: 1, items: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/hsk/id/teachers/import");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBe(file);
    expect(JSON.stringify(init.headers)).not.toMatch(/content-type/i);
  });

  it("import khi chưa cấu hình base => ApiNotConfiguredError (không gọi mạng); lỗi máy chủ => ApiError có thông điệp", async () => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(importTeachers(new File(["x"], "x.csv"), true)).rejects.toBeInstanceOf(ApiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "/api/hsk");
    vi.stubGlobal("fetch", respond(409, { success: false, errorCode: "EMAIL_EXISTS", errorMessage: "Email đã được dùng" }));
    const error = await createTeacher({ email: "a@b.vn", fullName: "A" }, true).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).message).toBe("Email đã được dùng");
  });
});
