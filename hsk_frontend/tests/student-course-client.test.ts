import { beforeEach, describe, it, expect, vi } from "vitest";
import { buildCourseCatalog, listStudentCourses, getStudentCourse } from "@/lib/api/lms-course-client";
import { studentApi } from "@/lib/api/student-client";
import { lmsClient } from "@/lib/api/lms-client";
vi.mock("@/lib/api/lms-client", () => ({ lmsClient: { get: vi.fn() } }));
vi.mock("@/lib/api/student-client", () => ({ studentApi: { classes: vi.fn(), classDetail: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());
describe("student course identity and access", () => {
    it("does not merge courses sharing a syllabus", () => { const result = buildCourseCatalog([{ id: "a", name: "A", code: "A" }, { id: "b", name: "B", code: "B" }], [{ id: "class1", courseId: "a", syllabusId: "shared" }], "LIVE"); expect(result.items.map(c => [c.id, c.registered])).toEqual([["a", true], ["b", false]]); });
    it("keeps one card per class, including closed courses", async () => { vi.mocked(studentApi.classes).mockResolvedValue([{ id: "one", courseId: "a" }, { id: "two", courseId: "a" }]); vi.mocked(studentApi.classDetail).mockImplementation(async (id) => ({ id, courseName: "Closed course", courseBannerUrl: "https://cms.test/banner", totalSessions: 10, completedSessions: 2 })); const result = await listStudentCourses("mine"); expect(result.items.map(c => c.id)).toEqual(["class:one", "class:two"]); expect(result.items[0].thumbnail).toBe("https://cms.test/banner"); expect(lmsClient.get).not.toHaveBeenCalled(); });
    it("requests a server page and preserves unknown enrollment", async () => { vi.mocked(studentApi.classes).mockRejectedValue(Error("offline")); vi.mocked(lmsClient.get).mockResolvedValue({ items: [{ id: "a", name: "A", code: "A" }], total_pages: 3 }); const result = await listStudentCourses("all", { page: 1, sort: "price-asc", classType: "GROUP" }); expect(lmsClient.get).toHaveBeenCalledWith(expect.stringContaining("page=1")); expect(result.items[0].registered).toBeNull(); expect(result.totalPages).toBe(3); });
    it("uses class learning-plan without reading management syllabus", async () => { vi.mocked(studentApi.classDetail).mockResolvedValue({ id: "one", syllabusId: "s", learningPlan: { courseName: "A", schedule: [{ id: "v1-row", topic: "Old version", content: "Class content", studentMaterials: [{ materialTitle: "Book", materialLink: "https://cms.test/file" }] }] } }); const detail = await getStudentCourse("class:one"); expect(detail.sessions[0].content).toBe("Class content"); expect(detail.materials[0].url).toBe("https://cms.test/file"); expect(lmsClient.get).not.toHaveBeenCalled(); });
    it("preview never fetches a syllabus", async () => { vi.mocked(lmsClient.get).mockResolvedValue({ id: "a", name: "A", code: "A", preview_sessions: [{ sessionNo: 1, topic: "Intro" }] }); const detail = await getStudentCourse("a"); expect(detail.previewTopics).toEqual(["Intro"]); expect(detail.sessions).toEqual([]); expect(lmsClient.get).toHaveBeenCalledWith("/course-catalog/a"); });
});

it("loads every catalog page for the original grouped layout", async () => {
    vi.mocked(studentApi.classes).mockResolvedValue([]);
    vi.mocked(lmsClient.get).mockResolvedValueOnce({items:[{id:"a",code:"A",name:"First page"}],total_pages:2})
        .mockResolvedValueOnce({items:[{id:"b",code:"B",name:"Second page"}]});
    const catalog=await listStudentCourses("all",{allPages:true});
    expect(catalog.items.map(item=>item.id)).toEqual(["a","b"]);
    expect(lmsClient.get).toHaveBeenLastCalledWith(expect.stringContaining("page=1"));
    expect(studentApi.classes).toHaveBeenCalledTimes(1);
});
