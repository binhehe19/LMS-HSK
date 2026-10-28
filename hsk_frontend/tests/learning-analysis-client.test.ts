import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { approvePersonalizationReport, generatePersonalizationSnapshot, getAttendanceAnalysis, getLatestTeacherNote, getPersonalization, sendTeacherNote } from "@/lib/api/learning-analysis-client";
import { WriteDisabledError } from "@/lib/api/write-gate";
import { attendanceFixture, personalizationDraftFixture } from "./fixtures/learning-analysis";

const respond = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_QUIZ_API_BASE_PATH", "/api/quiz");
  vi.stubEnv("NEXT_PUBLIC_WRITE_TEACHER_NOTE", "");
});
afterEach(() => vi.unstubAllGlobals());

describe("learning-analysis-client — đường dẫn theo hợp đồng đề xuất, định danh học viên bằng userId", () => {
  it("chưa cấu hình base => ApiNotConfiguredError, KHÔNG gọi mạng", async () => {
    vi.stubEnv("NEXT_PUBLIC_QUIZ_API_BASE_PATH", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getAttendanceAnalysis("60", "sch-1", "u-1")).rejects.toBeInstanceOf(ApiNotConfiguredError);
    await expect(getPersonalization("sch-1", "u-1", "60")).rejects.toBeInstanceOf(ApiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("attendance-analysis: GET /grading/classes/{classId}/schedules/{scheduleId}/students/{userId}/attendance-analysis, mọi đoạn được mã hoá", async () => {
    const fetchMock = respond(200, { success: true, data: attendanceFixture });
    vi.stubGlobal("fetch", fetchMock);
    await expect(getAttendanceAnalysis("c 1", "sch/1", "u#1")).resolves.toEqual(attendanceFixture);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/quiz/grading/classes/c%201/schedules/sch%2F1/students/u%231/attendance-analysis");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
  });

  it("notes/latest: `data: null` (chưa có) => null; có content => nhận xét", async () => {
    vi.stubGlobal("fetch", respond(200, { success: true, data: null }));
    await expect(getLatestTeacherNote("60", "sch-1", "u-1")).resolves.toBeNull();
    const fetchMock = respond(200, { success: true, data: { content: "Tốt", sentAt: "2026-10-27T08:00:00Z", author: "GV" } });
    vi.stubGlobal("fetch", fetchMock);
    await expect(getLatestTeacherNote("60", "sch-1", "u-1")).resolves.toEqual({ content: "Tốt", sentAt: "2026-10-27T08:00:00Z", author: "GV" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/quiz/grading/classes/60/schedules/sch-1/students/u-1/notes/latest");
  });

  it("personalization: GET .../schedules/{s}/students/{u}/personalization?classId=; phản hồi được chuẩn hoá (mảng bảo đảm)", async () => {
    const fetchMock = respond(200, { success: true, data: { ...personalizationDraftFixture, tasks: undefined, currentTasks: null } });
    vi.stubGlobal("fetch", fetchMock);
    const view = await getPersonalization("sch-1", "u-1", "60");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/quiz/grading/schedules/sch-1/students/u-1/personalization?classId=60");
    expect(view.tasks).toEqual([]);
    expect(view.currentTasks).toEqual([]);
    expect(view.report?.id).toBe("rep-1");
  });

  it.each([403, 404, 500])("HTTP %i => ApiError mang đúng status", async (status) => {
    vi.stubGlobal("fetch", respond(status, ""));
    await expect(getAttendanceAnalysis("60", "sch-1", "u-1")).rejects.toMatchObject({ name: "ApiError", status });
  });
});

describe("learning-analysis-client — thao tác GHI qua công tắc teacher-note", () => {
  it("công tắc đóng (không demo, không cờ) => WriteDisabledError, KHÔNG có request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(() => sendTeacherNote("60", "sch-1", "u-1", "x", false)).toThrow(WriteDisabledError);
    await expect(generatePersonalizationSnapshot("sch-1", "u-1", "60", false, false)).rejects.toBeInstanceOf(WriteDisabledError);
    expect(() => approvePersonalizationReport("sch-1", "u-1", "60", "rep-1", false)).toThrow(WriteDisabledError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gửi nhận xét (demo): POST .../notes với body CHỈ có content (không studentEmail)", async () => {
    const fetchMock = respond(200, { success: true, data: { content: "Em làm tốt", sentAt: "2026-10-27T08:00:00Z" } });
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendTeacherNote("60", "sch-1", "u-1", "Em làm tốt", true)).resolves.toEqual({ content: "Em làm tốt", sentAt: "2026-10-27T08:00:00Z" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/quiz/grading/classes/60/schedules/sch-1/students/u-1/notes");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ content: "Em làm tốt" });
  });

  it("cờ NEXT_PUBLIC_WRITE_TEACHER_NOTE=enabled mở công tắc khi không demo", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_TEACHER_NOTE", "enabled");
    const fetchMock = respond(200, { success: true, data: { reportId: "rep-1", state: "APPROVED" } });
    vi.stubGlobal("fetch", fetchMock);
    await expect(approvePersonalizationReport("sch-1", "u-1", "60", "rep 1", false)).resolves.toEqual({ reportId: "rep-1", state: "APPROVED" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/quiz/grading/schedules/sch-1/students/u-1/personalization/reports/rep%201/approve?classId=60");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });

  it("tạo snapshot: POST .../snapshot?classId=&forceNewVersion=; chỉ nhận CREATED|EXISTING kèm snapshot.id, kết quả in hoa", async () => {
    const fetchMock = respond(200, { success: true, data: { result: "existing", snapshot: { id: "snap-1", version: 2 } } });
    vi.stubGlobal("fetch", fetchMock);
    await expect(generatePersonalizationSnapshot("sch-1", "u-1", "60", true, true)).resolves.toEqual({ result: "EXISTING", snapshot: { id: "snap-1", version: 2 } });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/quiz/grading/schedules/sch-1/students/u-1/personalization/snapshot?classId=60&forceNewVersion=true");
  });

  it.each([[{ result: "OK", snapshot: { id: "s" } }], [{ result: "CREATED" }], [{ result: "CREATED", snapshot: { id: "  " } }], [{}]])("phản hồi snapshot không xác nhận %j => ApiError UNCONFIRMED_SNAPSHOT_MUTATION", async (data) => {
    vi.stubGlobal("fetch", respond(200, { success: true, data }));
    const error = await generatePersonalizationSnapshot("sch-1", "u-1", "60", false, true).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).errorCode).toBe("UNCONFIRMED_SNAPSHOT_MUTATION");
  });
});
