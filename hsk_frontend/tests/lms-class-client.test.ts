import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { adminClassSource, getAdminClass, listAdminClassStudents, listAdminClasses } from "@/lib/api/admin-class-source";
import { listAllClasses, listClasses } from "@/lib/api/lms-class-client";

const page = (items: unknown[], page: number, totalPages: number) => ({ success: true, data: { items, total_elements: items.length * totalPages, total_pages: totalPages, page, size: 100 } });
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("lms-class-client (backend chung, PageResponse snake_case)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_LMS_API_BASE_PATH", "/api/lms");
  });

  it("listClasses: gọi GET /classes với tham số (bỏ tham số rỗng), gửi kèm cookie, trả PageResponse", async () => {
    fetchMock.mockResolvedValue(jsonResponse(page([{ id: "a" }], 0, 1)));
    const res = await listClasses({ keyword: "H40", lifecycleStatus: "", page: 0, size: 20 });
    expect(res.items).toEqual([{ id: "a" }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/lms/classes?keyword=H40&page=0&size=20");
    expect(init.credentials).toBe("include");
  });

  it("phản hồi không có items (vd mảng trần) => ApiError hợp đồng, không im lặng coi là rỗng", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: [{ id: "a" }] }));
    await expect(listClasses()).rejects.toBeInstanceOf(ApiError);
  });

  it("listAllClasses duyệt hết các trang (size 100) và gộp; dừng khi hết trang", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(page([{ id: "a" }], 0, 3))).mockResolvedValueOnce(jsonResponse(page([{ id: "b" }], 1, 3))).mockResolvedValueOnce(jsonResponse(page([{ id: "c" }], 2, 3)));
    const res = await listAllClasses();
    expect(res.items.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(res.truncated).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe("/api/lms/classes?page=1&size=100");
  });

  it("listAllClasses quá maxPages => truncated=true (giao diện phải nói rõ)", async () => {
    // Mỗi lời gọi một Response mới (thân Response chỉ đọc được một lần).
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(page([{ id: "x" }], 0, 50))));
    const res = await listAllClasses(2);
    expect(res.items).toHaveLength(2);
    expect(res.truncated).toBe(true);
  });

  it("chưa cấu hình base => ApiNotConfiguredError (WAITING FOR BACKEND), không gọi mạng", async () => {
    vi.stubEnv("NEXT_PUBLIC_LMS_API_BASE_PATH", "");
    await expect(listClasses()).rejects.toBeInstanceOf(ApiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("admin-class-source: chọn nguồn theo cấu hình, không trộn", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("có LMS => nguồn lms: danh sách lớp lấy từ /api/lms/classes và ánh xạ sang giao diện cũ", async () => {
    vi.stubEnv("NEXT_PUBLIC_LMS_API_BASE_PATH", "/api/lms");
    vi.stubEnv("NEXT_PUBLIC_QUIZ_API_BASE_PATH", "/api/quiz");
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(page([{ id: "01", code: "H4006", teacher: { id: "t", fullName: "GV" } }], 0, 1))));
    expect(adminClassSource()).toBe("lms");
    const classes = await listAdminClasses();
    expect(classes).toEqual([expect.objectContaining({ classId: "01", classCode: "H4006", teacherName: "GV" })]);
    expect((fetchMock.mock.calls[0] as [string])[0]).toMatch(/^\/api\/lms\/classes/);
  });

  it("không có LMS, có quiz => nguồn quiz (hợp đồng đề xuất HSK cũ)", async () => {
    vi.stubEnv("NEXT_PUBLIC_LMS_API_BASE_PATH", "");
    vi.stubEnv("NEXT_PUBLIC_QUIZ_API_BASE_PATH", "/api/quiz");
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: [{ classId: "mock-001" }] }));
    expect(adminClassSource()).toBe("quiz");
    expect(await listAdminClasses()).toEqual([{ classId: "mock-001" }]);
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("/api/quiz/grading/admin/classes");
  });

  it("nguồn lms: getAdminClass ghép chi tiết + buổi + ghi danh; listAdminClassStudents từ /enrollments", async () => {
    vi.stubEnv("NEXT_PUBLIC_LMS_API_BASE_PATH", "/api/lms");
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/sessions")) return Promise.resolve(jsonResponse({ success: true, data: [{ id: "s1" }, { id: "s2" }] }));
      if (url.includes("/enrollments")) return Promise.resolve(jsonResponse(page([{ id: "e1", studentId: "u1", studentFullName: "A", scoreSummary: { percentage: 70, gradedItemCount: 7, totalItemCount: 10 } }], 0, 1)));
      return Promise.resolve(jsonResponse({ success: true, data: { id: "01", code: "H4006", syllabusName: "GT", mentor: { id: "m", fullName: "TG" } } }));
    });
    const info = await getAdminClass("01");
    expect(info).toMatchObject({ source: "lms", classCode: "H4006", syllabusName: "GT", assistantName: "TG", totalSessions: 2, studentCount: 1 });
    const students = await listAdminClassStudents("01");
    expect(students).toEqual([expect.objectContaining({ userId: "u1", name: "A", qualityPercent: 70, homeworkCompletionPercent: 70 })]);
  });

  it("không nguồn nào => ApiNotConfiguredError", async () => {
    vi.stubEnv("NEXT_PUBLIC_LMS_API_BASE_PATH", "");
    vi.stubEnv("NEXT_PUBLIC_QUIZ_API_BASE_PATH", "");
    await expect(listAdminClasses()).rejects.toBeInstanceOf(ApiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
