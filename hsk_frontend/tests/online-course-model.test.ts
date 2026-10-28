import { describe, expect, it } from "vitest";
import {
  courseStats,
  courseTypeBadge,
  DEFAULT_COURSE_FILTERS,
  filterCourses,
  formatPrice,
  formFromCourse,
  hasActiveCourseFilters,
  mergeCourseDetail,
  pickSyllabusDescription,
  splitSyllabusDescription,
  stripHtmlText,
  syncJobView,
  toUpsertPayload,
  validateCourseForm,
} from "@/lib/online-course/online-course-model";
import type { OnlineCourseSummary } from "@/types/online-course";

const course = (id: string, over: Partial<OnlineCourseSummary> = {}): OnlineCourseSummary => ({ id, code: `C-${id}`, name: `Khóa ${id}`, courseType: "Group", price: 1_000_000, cmsSynced: true, ...over });
const courses = [course("a", { price: 2_500_000 }), course("b", { title: "Tên qua title", name: undefined, slug: "slug-b", code: undefined, courseType: "1-1", cmsSynced: false, price: 1_800_000 }), course("c", { courseType: "ONE_TO_ONE", price: 3_900_000, cmsSynced: false })];

describe("filterCourses (lọc phía client như bản cũ)", () => {
  it("tìm theo tên hoặc mã (name|title, code|slug), không phân biệt hoa thường", () => {
    expect(filterCourses(courses, { ...DEFAULT_COURSE_FILTERS, search: "khóa a" }).map((c) => c.id)).toEqual(["a"]);
    expect(filterCourses(courses, { ...DEFAULT_COURSE_FILTERS, search: "SLUG-B" }).map((c) => c.id)).toEqual(["b"]);
    expect(filterCourses(courses, { ...DEFAULT_COURSE_FILTERS, search: "qua title" }).map((c) => c.id)).toEqual(["b"]);
  });

  it("loại Nhóm/1-1 (chuỗi chứa 'group' / 'one' / '1-1') và nguồn Đã đồng bộ/Nội bộ", () => {
    expect(filterCourses(courses, { ...DEFAULT_COURSE_FILTERS, type: "group" }).map((c) => c.id)).toEqual(["a"]);
    expect(filterCourses(courses, { ...DEFAULT_COURSE_FILTERS, type: "1-1" }).map((c) => c.id)).toEqual(["b", "c"]);
    expect(filterCourses(courses, { ...DEFAULT_COURSE_FILTERS, sync: "synced" }).map((c) => c.id)).toEqual(["a"]);
    expect(filterCourses(courses, { ...DEFAULT_COURSE_FILTERS, sync: "local" }).map((c) => c.id)).toEqual(["b", "c"]);
  });

  it("sắp theo giá tăng/giảm, không đổi thứ tự khi 'none'; không làm đổi mảng gốc", () => {
    const copy = [...courses];
    expect(filterCourses(courses, { ...DEFAULT_COURSE_FILTERS, priceSort: "asc" }).map((c) => c.id)).toEqual(["b", "a", "c"]);
    expect(filterCourses(courses, { ...DEFAULT_COURSE_FILTERS, priceSort: "desc" }).map((c) => c.id)).toEqual(["c", "a", "b"]);
    expect(filterCourses(courses, DEFAULT_COURSE_FILTERS).map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(courses).toEqual(copy);
  });

  it("hasActiveCourseFilters: chỉ true khi có bộ lọc khác mặc định", () => {
    expect(hasActiveCourseFilters(DEFAULT_COURSE_FILTERS)).toBe(false);
    expect(hasActiveCourseFilters({ ...DEFAULT_COURSE_FILTERS, priceSort: "asc" })).toBe(true);
    expect(hasActiveCourseFilters({ ...DEFAULT_COURSE_FILTERS, search: "x" })).toBe(true);
  });
});

describe("thống kê, nhãn, định dạng", () => {
  it("courseStats đếm tổng / đã đồng bộ / nhóm / 1-1", () => {
    expect(courseStats(courses)).toEqual({ total: 3, synced: 1, group: 1, oneToOne: 2 });
    expect(courseStats([])).toEqual({ total: 0, synced: 0, group: 0, oneToOne: 0 });
  });

  it("courseTypeBadge: không có courseType => null; không chứa 'group' => 'Khóa 1-1' (quy tắc bản cũ)", () => {
    expect(courseTypeBadge(course("x", { courseType: undefined }))).toBeNull();
    expect(courseTypeBadge(course("x", { courseType: "Group" }))).toBe("Khóa Nhóm");
    expect(courseTypeBadge(course("x", { courseType: "1-1" }))).toBe("Khóa 1-1");
    expect(courseTypeBadge(course("x", { courseType: "Khác" }))).toBe("Khóa 1-1");
  });

  it("formatPrice theo vi-VN với hậu tố ' đ'; thiếu giá => 0 đ", () => {
    expect(formatPrice(2_500_000)).toBe("2.500.000 đ");
    expect(formatPrice(undefined)).toBe("0 đ");
  });
});

describe("form sửa khoá học", () => {
  it("formFromCourse đọc bí danh (title/thumbnailUrl), bỏ HTML trong mô tả, số => chuỗi, thiếu => rỗng", () => {
    const form = formFromCourse(course("x", { name: undefined, title: "Tiêu đề", thumbnail: undefined, thumbnailUrl: "https://img/x.png", description: "<p>M&ocirc; tả <b>đậm</b></p>", price: 2_500_000, totalLessons: 10, rating: undefined, level: "HSK3", syllabusId: "syl-1" }));
    expect(form).toEqual({ name: "Tiêu đề", thumbnail: "https://img/x.png", description: "Mô tả đậm", syllabusId: "syl-1", price: "2500000", rating: "", courseType: "Group", level: "HSK3", totalLessons: "10" });
  });

  it("validateCourseForm: tên bắt buộc, giá/số bài phải là số không âm", () => {
    const base = formFromCourse(course("x"));
    expect(validateCourseForm({ ...base, name: "  " })).toBe("Vui lòng nhập tên khóa học");
    expect(validateCourseForm({ ...base, price: "-5" })).toBe("Học phí không hợp lệ");
    expect(validateCourseForm({ ...base, totalLessons: "1.5" })).toBe("Số bài học không hợp lệ");
    expect(validateCourseForm(base)).toBeNull();
  });

  it("toUpsertPayload: chuỗi rỗng => undefined (không ghi đè), số được ép kiểu", () => {
    expect(toUpsertPayload({ name: " HSK3 ", thumbnail: "", description: "", syllabusId: "", price: "2500000", rating: "", courseType: "", level: "", totalLessons: "12" })).toEqual({ name: "HSK3", thumbnail: undefined, description: undefined, syllabusId: undefined, price: 2_500_000, rating: undefined, courseType: undefined, level: undefined, totalLessons: 12 });
  });
});

describe("chi tiết khoá học", () => {
  it("stripHtmlText bỏ thẻ, đổi <br>/</p> thành xuống dòng, giải mã thực thể tiếng Việt", () => {
    expect(stripHtmlText("<p>Kh&oacute;a <b>HSK</b> 3</p><p>d&ograve;ng&nbsp;2<br/>d&ograve;ng 3</p>")).toBe("Khóa HSK 3\ndòng 2\ndòng 3");
    expect(stripHtmlText(undefined)).toBe("");
  });

  it("pickSyllabusDescription ưu tiên syllabus_description > description > content", () => {
    expect(pickSyllabusDescription({ syllabus_description: "A", description: "B", content: "C" })).toBe("A");
    expect(pickSyllabusDescription({ description: "<p>B</p>", content: "C" })).toBe("B");
    expect(pickSyllabusDescription({ content: "C" })).toBe("C");
    expect(pickSyllabusDescription(null)).toBe("");
  });

  it("mergeCourseDetail: full-detail ghi đè, mô tả giáo trình lấy từ nguồn nào có, syllabusId từ bí danh snake_case; cả hai null => null", () => {
    expect(mergeCourseDetail(null, null)).toBeNull();
    const merged = mergeCourseDetail({ id: "x", name: "Cũ", syllabus_id: "syl-9" }, { id: "x", name: "Mới", syllabusInfo: { description: "<p>Mục tiêu: giỏi</p>" } });
    expect(merged?.name).toBe("Mới");
    expect(merged?.syllabus_description).toBe("Mục tiêu: giỏi");
    expect(merged?.syllabusId).toBe("syl-9");
    expect(mergeCourseDetail({ id: "x", syllabusId: "a" }, null)?.syllabus_description).toBeUndefined();
  });

  it("splitSyllabusDescription tách 4 tiêu đề con của bản cũ thành đoạn heading/text", () => {
    expect(splitSyllabusDescription("Đối tượng: HV mới\nMục tiêu: HSK3")).toEqual([
      { kind: "heading", value: "Đối tượng:" },
      { kind: "text", value: " HV mới\n" },
      { kind: "heading", value: "Mục tiêu:" },
      { kind: "text", value: " HSK3" },
    ]);
    expect(splitSyllabusDescription("không có tiêu đề")).toEqual([{ kind: "text", value: "không có tiêu đề" }]);
  });
});

describe("syncJobView (modal đồng bộ)", () => {
  it("chưa có job => đang đồng bộ, thanh tối thiểu 15%, bước 'Đang kết nối...'", () => {
    expect(syncJobView(null)).toMatchObject({ tone: "syncing", progress: 15, step: "Đang kết nối...", finished: false, title: "Đang Đồng Bộ Dữ Liệu" });
  });

  it("SUCCESS/FAILED => kết thúc; FAILED dùng message của job nếu có", () => {
    expect(syncJobView({ jobId: "1", status: "SUCCESS" })).toMatchObject({ tone: "success", progress: 100, finished: true });
    expect(syncJobView({ jobId: "1", status: "failed", message: "CMS lỗi", progressPercent: 40 })).toMatchObject({ tone: "failed", description: "CMS lỗi", progress: 40, finished: true });
    expect(syncJobView({ jobId: "1", status: "RUNNING", progressPercent: 60, currentStep: "Syllabus" })).toMatchObject({ tone: "syncing", progress: 60, step: "Syllabus" });
  });
});
