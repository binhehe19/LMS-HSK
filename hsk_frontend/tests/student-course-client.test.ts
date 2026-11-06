import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCourseCatalog, buildCourseDetail, getStudentCourse, listStudentCourses } from "@/lib/api/lms-course-client";
import { getSyllabus, listSyllabuses } from "@/lib/api/lms-syllabus-client";
import { studentApi, type StudentClass } from "@/lib/api/student-client";
import { ApiError } from "@/lib/api/api-client";

vi.mock("@/lib/api/lms-syllabus-client", () => ({ listSyllabuses: vi.fn(), getSyllabus: vi.fn() }));
vi.mock("@/lib/api/student-client", () => ({ studentApi: { classes: vi.fn(), classDetail: vi.fn() } }));

const syllabi = [
  { id: "S40", code: "H40", name: "HSK4", educationLevelCode: "HSK4", createdAt: "2026-03-01" },
  { id: "S20", code: "H20", name: "0 - HSK2", educationLevelCode: "HSK2", createdAt: "2026-01-01" },
];
const cls = (over: Partial<StudentClass>): StudentClass => ({ id: "c", ...over });

describe("ghép danh mục khoá học từ /syllabuses + /me/classes", () => {
  it("khoá = giáo trình; sở hữu khi có lớp cùng giáo trình; tiến độ = buổi đã học / tổng buổi", () => {
    const res = buildCourseCatalog(syllabi, [
      cls({ id: "a", syllabusId: "S40", totalSessions: 48, completedSessions: 5 }),
      cls({ id: "b", syllabusId: "S40", totalSessions: 48, completedSessions: 24 }),
    ], "LIVE");
    expect(res.enrollmentSource).toBe("LIVE");
    expect(res.items.map((c) => [c.code, c.owned, c.progress, c.doneSessions, c.totalSessions])).toEqual([
      ["H40", true, 50, 24, 48],
      ["H20", false, 0, 0, null],
    ]);
    expect(res.items[0]).toMatchObject({ id: "S40", levelOut: "HSK4", releasedAt: "2026-03-01" });
  });

  it("lớp có giáo trình ngoài danh mục (hoặc không có giáo trình) vẫn hiện; lớp đã xong không có số buổi tính 100%", () => {
    const res = buildCourseCatalog(syllabi, [
      cls({ id: "x", code: "YCT1-K01", syllabusId: "S99", syllabusName: "YCT 1", educationLevelCode: "YCT1", totalSessions: 30, completedSessions: 40 }),
      cls({ id: "y", code: "GT-K02", lifecycleStatus: "COMPLETED" }),
    ], "LIVE");
    expect(res.items.slice(2).map((c) => [c.id, c.code, c.name, c.owned, c.progress, c.doneSessions])).toEqual([
      ["S99", "YCT1-K01", "YCT 1", true, 100, 30],
      ["class:y", "GT-K02", "GT-K02", true, 100, 0],
    ]);
  });

  it("/me/classes lỗi => vẫn có danh mục, báo UNAVAILABLE; chi tiết một lớp lỗi thì dùng thông tin tóm tắt", async () => {
    vi.mocked(listSyllabuses).mockResolvedValue(syllabi);
    vi.mocked(studentApi.classes).mockRejectedValueOnce(new ApiError("CMS lỗi", 503));
    const down = await listStudentCourses();
    expect(down.enrollmentSource).toBe("UNAVAILABLE");
    expect(down.items.every((c) => !c.owned)).toBe(true);

    vi.mocked(studentApi.classes).mockResolvedValueOnce([cls({ id: "a", syllabusId: "S20" })]);
    vi.mocked(studentApi.classDetail).mockRejectedValueOnce(new ApiError("timeout", 504));
    const partial = await listStudentCourses();
    expect(partial.items.find((c) => c.id === "S20")).toMatchObject({ owned: true, progress: 0 });
  });
});

describe("chi tiết khoá từ /syllabuses/{id}", () => {
  beforeEach(() => vi.mocked(getSyllabus).mockReset());

  it("lộ trình đánh số theo thứ tự, 5 tên buổi đầu để xem trước, tài liệu bỏ dòng trống", () => {
    const d = buildCourseDetail("S40", {
      id: "S40", code: "H40", name: "HSK4", description: "<p>Mô tả</p>",
      schedule: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, topic: `Bài ${i + 1}`, content: "x" })),
      materials: [{ id: "m1", title: "Giáo trình" }, { id: "m2", title: " " }],
    } as never);
    expect(d.sessions.map((s) => s.sessionNo)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(d.previewTopics).toEqual(["Bài 1", "Bài 2", "Bài 3", "Bài 4", "Bài 5"]);
    expect(d.materials).toEqual([{ id: "m1", title: "Giáo trình", type: null }]);
    expect(d.course).toMatchObject({ name: "HSK4", totalSessions: 6, description: "<p>Mô tả</p>" });
    expect(d.syllabusStatus).toBe("OK");
  });

  it("khoá dựng từ lớp không có giáo trình thì không gọi API", async () => {
    const d = await getStudentCourse("class:y");
    expect(d.syllabusStatus).toBe("NONE");
    expect(getSyllabus).not.toHaveBeenCalled();
  });
});
