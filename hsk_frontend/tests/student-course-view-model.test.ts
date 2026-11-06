import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  currentCourse,
  DEFAULT_FILTERS,
  filterAndSort,
  heroLevels,
  priceCeiling,
  safeUrl,
  studyFormCounts,
  toCourseVM,
  toDetailData,
  type CourseVM,
} from "@/lib/student-course/course-view-model";
import type { StudentCourseApi } from "@/types/student-course";

const api = (over: Partial<StudentCourseApi> = {}): StudentCourseApi => ({ id: "c1", code: "X1", name: "Khoá X", owned: false, progress: 0, doneSessions: 0, ...over });
const vm = (over: Partial<StudentCourseApi> = {}) => toCourseVM(api(over));

describe("ghép dữ liệu API với dữ liệu biên tập (quy tắc HSK cũ)", () => {
  it("ưu tiên dữ liệu API, thiếu thì lấy dữ liệu biên tập theo mã, rồi mới suy ra", () => {
    const h20 = vm({ code: "H20", name: "KHOÁ 0 - HSK2", totalSessions: null, thumbnail: null });
    expect(h20).toMatchObject({ category: "hsk", image: "/assets/hocba/courses/hsk-h20.jpg", totalSessions: 48, levelIn: "0", levelOut: "HSK2", months: 3, hoursPerSession: 2 });
    expect(h20.audiences).toEqual(["hoc-sinh", "tu-do"]);

    const real = vm({ code: "H20", thumbnail: "https://cdn.example/a.jpg", totalSessions: 30, category: "di-lam", audiences: ["tre-em", "lạ"], studyForm: "offline", levelOut: "HSK3" });
    expect(real).toMatchObject({ image: "https://cdn.example/a.jpg", totalSessions: 30, category: "di-lam", audiences: ["tre-em"], studyForm: "offline", levelOut: "HSK3" });
  });

  it("suy danh mục từ mã/tên, khoá 1-1 là Online kết hợp, ảnh lạ bị bỏ", () => {
    expect(vm({ code: "GS-01", name: "Gia sư giao tiếp" }).category).toBe("gia-su");
    expect(vm({ code: "CX9", name: "Công xưởng" }).category).toBe("cong-xuong");
    expect(vm({ code: "YCT1", name: "YCT 1" }).category).toBe("hsk");
    expect(vm({ courseType: "1-1" }).studyForm).toBe("online-ket-hop");
    expect(vm({ courseType: "GROUP" }).studyForm).toBe("online-tu-hoc");
    expect(vm({ thumbnail: "javascript:alert(1)", category: "b2b" }).image).toBe("/assets/hocba/courses/gt-gt1.jpg");
    expect(vm({ progress: 140, doneSessions: -3 })).toMatchObject({ progress: 100, doneSessions: 0 });
    expect(vm({ description: "<p>Mô&nbsp;tả</p>" }).description).toBe("Mô tả");
  });

  it("safeUrl chỉ nhận http(s) hoặc đường dẫn nội bộ", () => {
    expect(safeUrl("//evil.example")).toBeUndefined();
    expect(safeUrl("data:text/html,x")).toBeUndefined();
    expect(safeUrl(" /x.png ")).toBe("/x.png");
    expect(safeUrl("HTTPS://a.example/b")).toBe("HTTPS://a.example/b");
  });
});

describe("lọc, sắp xếp, số liệu", () => {
  const list: CourseVM[] = [
    vm({ id: "a", code: "H20", owned: true, progress: 100, price: 1_200_000, releasedAt: "2026-01-01T00:00:00Z", levelIn: "0", levelOut: "HSK2" }),
    vm({ id: "b", code: "H30", owned: true, progress: 40, price: 1_400_000, releasedAt: "2026-02-01T00:00:00Z", levelIn: "HSK2", levelOut: "HSK3" }),
    vm({ id: "c", code: "GT1", category: "di-lam", courseType: "1-1", price: 3_250_000, releasedAt: "2026-03-01T00:00:00Z" }),
  ];

  it("chế độ, bộ lọc và sắp xếp", () => {
    expect(filterAndSort(list, "all", DEFAULT_FILTERS, "newest").map((c) => c.id)).toEqual(["c", "b", "a"]);
    expect(filterAndSort(list, "all", DEFAULT_FILTERS, "oldest").map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(filterAndSort(list, "all", DEFAULT_FILTERS, "price-desc").map((c) => c.id)).toEqual(["c", "b", "a"]);
    expect(filterAndSort(list, "mine", DEFAULT_FILTERS, "newest").map((c) => c.id)).toEqual(["b", "a"]);
    expect(filterAndSort(list, "all", { ...DEFAULT_FILTERS, categories: ["di-lam"] }, "newest").map((c) => c.id)).toEqual(["c"]);
    expect(filterAndSort(list, "all", { ...DEFAULT_FILTERS, studyForms: ["online-ket-hop"] }, "newest").map((c) => c.id)).toEqual(["c", "b", "a"]);
    expect(filterAndSort(list, "all", { ...DEFAULT_FILTERS, studyForms: ["offline"] }, "newest")).toEqual([]);
    expect(filterAndSort(list, "all", { ...DEFAULT_FILTERS, audience: "hoc-sinh" }, "newest").map((c) => c.id)).toEqual(["b", "a"]);
    expect(filterAndSort(list, "all", { ...DEFAULT_FILTERS, maxPrice: 1_300_000 }, "newest").map((c) => c.id)).toEqual(["a"]);
  });

  it("đếm hình thức học, số bộ lọc, trần giá không ẩn khoá đắt", () => {
    expect(studyFormCounts(list, "all")).toEqual({ "online-tu-hoc": 0, "online-ket-hop": 3, offline: 0 });
    expect(studyFormCounts(list, "mine")["online-ket-hop"]).toBe(2);
    expect(activeFilterCount({ categories: ["hsk"], audience: "tre-em", studyForms: [], maxPrice: 500_000 })).toBe(3);
    expect(priceCeiling(list)).toBe(3_300_000);
    expect(priceCeiling([])).toBe(2_000_000);
  });

  it("hero: khoá đang học và trình độ suy từ khoá sở hữu", () => {
    expect(currentCourse(list)?.id).toBe("b");
    expect(heroLevels(list)).toEqual({ levelIn: "0", levelCurrent: "HSK2", levelGoal: "HSK3" });
    expect(heroLevels([list[2]])).toEqual({ levelIn: "0", levelCurrent: "0", levelGoal: "—" });
  });
});

describe("dữ liệu modal chi tiết", () => {
  it("nhãn buổi, bỏ HTML, chặn link tài liệu không an toàn", () => {
    const d = toDetailData({
      course: api({ name: " KHOÁ H20 ", description: "<b>Hay</b>", totalSessions: 12 }),
      syllabusStatus: "OK",
      sessions: [{ id: "s1", sessionNo: 3, topic: "<i>Bài 3</i>", content: "Nội dung" }, { topic: "Không số" }],
      materials: [{ id: "m1", title: "Giáo trình", url: "https://drive.example/a" }, { title: "Lạ", url: "javascript:x" }, { title: "  " }],
      previewTopics: [],
      enrollmentSource: "LIVE",
    });
    expect(d.sessions.map((s) => [s.label, s.topic])).toEqual([["Buổi 3", "Bài 3"], ["Buổi 2", "Không số"]]);
    expect(d.materials).toEqual([{ id: "m1", title: "Giáo trình", url: "https://drive.example/a" }, { id: "m-1", title: "Lạ", url: undefined }]);
    expect(d).toMatchObject({ title: "KHOÁ H20", description: "Hay", totalSessions: 12, syllabusStatus: "OK" });
  });
});

describe("ảnh bìa lỗi", () => {
  it("đổi sang ảnh mặc định của danh mục đúng một lần", async () => {
    const { fallbackCourseImage } = await import("@/lib/student-course/course-view-model");
    const img = document.createElement("img");
    img.setAttribute("src", "https://old-storage.example/x.jpg");
    fallbackCourseImage({ currentTarget: img }, "di-lam");
    expect(img.getAttribute("src")).toBe("/assets/hocba/courses/gt-gt1.jpg");
    img.setAttribute("src", "/broken-again.jpg");
    fallbackCourseImage({ currentTarget: img }, "di-lam");
    expect(img.getAttribute("src")).toBe("/broken-again.jpg");
  });
});
