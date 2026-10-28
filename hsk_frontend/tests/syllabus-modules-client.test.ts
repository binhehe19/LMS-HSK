import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { createScheduleModule, deleteScheduleModule, listAvailableScheduleModules, listScheduleModules, reorderScheduleModules } from "@/lib/api/syllabus-modules-client";
import { WriteDisabledError } from "@/lib/api/write-gate";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const call = (fetchMock: ReturnType<typeof vi.fn>, i = 0) => fetchMock.mock.calls[i] as [string, RequestInit];

describe("syllabus-modules-client (hợp đồng đề xuất qua hskClient)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "/api/hsk");
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "");
  });

  it("listScheduleModules: GET by-schedule/{id} (id được mã hoá), gửi cookie, bóc envelope {success,data}", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [{ id: "m1", scheduleId: "a b", moduleType: "QUIZ", order: 1 }] }));
    const res = await listScheduleModules("a b");
    expect(res).toEqual([{ id: "m1", scheduleId: "a b", moduleType: "QUIZ", order: 1 }]);
    const [url, init] = call(fetchMock);
    expect(url).toBe("/api/hsk/online-learning/schedule-modules/by-schedule/a%20b");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
  });

  it("listAvailableScheduleModules: TYPE viết hoa trong đường dẫn; q cắt khoảng trắng + mã hoá; q rỗng thì không gửi tham số", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [] }));
    await listAvailableScheduleModules("flashcard", "  bài 1 ");
    expect(call(fetchMock, 0)[0]).toBe("/api/hsk/online-learning/schedule-available-modules/FLASHCARD?q=b%C3%A0i%201");
    await listAvailableScheduleModules("QUIZ", "   ");
    expect(call(fetchMock, 1)[0]).toBe("/api/hsk/online-learning/schedule-available-modules/QUIZ");
    await listAvailableScheduleModules("QUIZ");
    expect(call(fetchMock, 2)[0]).toBe("/api/hsk/online-learning/schedule-available-modules/QUIZ");
  });

  it("thao tác ghi khi công tắc đóng (không demo, không cờ) => WriteDisabledError là promise bị reject, KHÔNG có request", async () => {
    await expect(createScheduleModule({ scheduleId: "s", moduleType: "QUIZ", contentSetId: "c", title: "t" }, false)).rejects.toBeInstanceOf(WriteDisabledError);
    await expect(reorderScheduleModules("s", ["a"], false)).rejects.toBeInstanceOf(WriteDisabledError);
    await expect(deleteScheduleModule("m", false)).rejects.toBeInstanceOf(WriteDisabledError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("createScheduleModule (demo mở công tắc): POST /schedule-modules với body JSON đúng hợp đồng", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: { id: "sm-new-1", scheduleId: "s1", moduleType: "QUIZ", contentSetId: "set-quiz-1", title: "Bài tập", order: 3, skillType: "LISTENING" } }, 201));
    const created = await createScheduleModule({ scheduleId: "s1", moduleType: "QUIZ", contentSetId: "set-quiz-1", title: "Bài tập", skillType: "LISTENING" }, true);
    expect(created.id).toBe("sm-new-1");
    const [url, init] = call(fetchMock);
    expect(url).toBe("/api/hsk/online-learning/schedule-modules");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ scheduleId: "s1", moduleType: "QUIZ", contentSetId: "set-quiz-1", title: "Bài tập", skillType: "LISTENING" });
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("reorderScheduleModules (cờ NEXT_PUBLIC_WRITE_CONTENT=enabled): PUT .../by-schedule/{id}/reorder body {ids}", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
    fetchMock.mockResolvedValue(json({ success: true, data: [{ id: "b", scheduleId: "s1", moduleType: "QUIZ", order: 1 }, { id: "a", scheduleId: "s1", moduleType: "QUIZ", order: 2 }] }));
    const res = await reorderScheduleModules("s1", ["b", "a"], false);
    expect(res.map((m) => m.id)).toEqual(["b", "a"]);
    const [url, init] = call(fetchMock);
    expect(url).toBe("/api/hsk/online-learning/schedule-modules/by-schedule/s1/reorder");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ ids: ["b", "a"] });
  });

  it("deleteScheduleModule: DELETE /schedule-modules/{id}; 204 không thân => resolve", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(deleteScheduleModule("sm-1", true)).resolves.toBeUndefined();
    const [url, init] = call(fetchMock);
    expect(url).toBe("/api/hsk/online-learning/schedule-modules/sm-1");
    expect(init.method).toBe("DELETE");
  });

  it("chưa cấu hình NEXT_PUBLIC_HSK_API_BASE_PATH => ApiNotConfiguredError (WAITING FOR BACKEND), không gọi mạng", async () => {
    vi.stubEnv("NEXT_PUBLIC_HSK_API_BASE_PATH", "");
    await expect(listScheduleModules("s1")).rejects.toBeInstanceOf(ApiNotConfiguredError);
    await expect(listAvailableScheduleModules("QUIZ")).rejects.toBeInstanceOf(ApiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("403 (giảng viên không có quyền ghi) => ApiError với thông điệp quyền; 404 => thông điệp của mock/backend", async () => {
    fetchMock.mockResolvedValueOnce(json({ success: false, errorCode: "FORBIDDEN", errorMessage: "Không có quyền (MOCK)" }, 403));
    await expect(deleteScheduleModule("sm-1", true)).rejects.toMatchObject({ status: 403, message: "Bạn không có quyền thực hiện thao tác này." });
    fetchMock.mockResolvedValueOnce(json({ success: false, errorCode: "404", errorMessage: "Không tìm thấy buổi học (MOCK)" }, 404));
    const error = await listScheduleModules("zzz").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe("Không tìm thấy buổi học (MOCK)");
  });
});
