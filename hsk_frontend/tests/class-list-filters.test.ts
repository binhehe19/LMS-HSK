// Port của class-list-filters.test.ts (HSK cũ) + bộ kiểm tra logic thuần của màn Quản lý lớp học của Giảng viên.
import { describe, expect, it } from "vitest";
import { classCourseKey, classDisplayName, matchesClassTime, parseClassDate } from "@/lib/class-list/class-list-filters";
import {
  EMPTY_FILTERS,
  classOptions,
  courseOptions,
  display,
  filterClasses,
  initials,
  lessonHref,
  todayInputValue,
} from "@/lib/class-list/class-list-model";
import type { GradingClassResponse } from "@/types/grading";

const now = new Date(2026, 8, 28, 12);
const clazz = (startDate: string, endDate?: string, actualEndDate?: string): GradingClassResponse => ({ classId: "class-1", startDate, endDate, actualEndDate });

describe("class list filters (khớp bản cũ)", () => {
  it("uses the course name and class name shown to the mentor", () => {
    const item = { classId: "1", classCode: "H20190", className: "Lớp H20 A", courseId: "course-1", courseName: " H20 " };
    expect(classCourseKey(item)).toBe("name:h20");
    expect(classDisplayName(item)).toBe("Lớp H20 A");
    expect(classDisplayName({ classId: "2", classCode: "GT101" })).toBe("GT101");
  });

  it("parses ISO and Vietnamese dates without accepting invalid dates", () => {
    expect(parseClassDate("2026-09-28")).toBe(parseClassDate("28/09/2026"));
    expect(parseClassDate("2026-09-28T10:30:00Z")).toBe(parseClassDate("28-09-2026"));
    expect(parseClassDate("31/02/2026")).toBeNull();
  });

  it("matches exact, relative and seven-day windows against the active class period", () => {
    const active = clazz("26/09/2026", "01/10/2026");
    expect(matchesClassTime(active, "YESTERDAY", "", now)).toBe(true);
    expect(matchesClassTime(active, "TODAY", "", now)).toBe(true);
    expect(matchesClassTime(active, "TOMORROW", "", now)).toBe(true);
    expect(matchesClassTime(active, "EXACT", "2026-10-01", now)).toBe(true);
    expect(matchesClassTime(active, "EXACT", "2026-10-02", now)).toBe(false);
    expect(matchesClassTime(active, "PAST_7_DAYS", "", now)).toBe(true);
    expect(matchesClassTime(active, "NEXT_7_DAYS", "", now)).toBe(true);

    expect(matchesClassTime(clazz("22/09/2026", "22/09/2026"), "PAST_7_DAYS", "", now)).toBe(true);
    expect(matchesClassTime(clazz("21/09/2026", "21/09/2026"), "PAST_7_DAYS", "", now)).toBe(false);
    expect(matchesClassTime(clazz("04/10/2026", "04/10/2026"), "NEXT_7_DAYS", "", now)).toBe(true);
    expect(matchesClassTime(clazz("05/10/2026", "05/10/2026"), "NEXT_7_DAYS", "", now)).toBe(false);
  });

  it("uses actual end date when present and excludes classes without a usable date", () => {
    expect(matchesClassTime(clazz("20/09/2026", "30/09/2026", "25/09/2026"), "TODAY", "", now)).toBe(false);
    expect(matchesClassTime(clazz("", ""), "TODAY", "", now)).toBe(false);
    expect(matchesClassTime(clazz("", ""), "", "", now)).toBe(true);
  });

  it("ngày chính xác không hợp lệ => không lớp nào khớp", () => {
    expect(matchesClassTime(clazz("26/09/2026", "01/10/2026"), "EXACT", "", now)).toBe(false);
    expect(matchesClassTime(clazz("26/09/2026", "01/10/2026"), "EXACT", "abc", now)).toBe(false);
  });
});

describe("class-list-model", () => {
  it("display: rỗng/null/undefined => '-' (ASCII, khác màn Admin); số 0 vẫn hiện", () => {
    expect(display(undefined)).toBe("-");
    expect(display(null)).toBe("-");
    expect(display("")).toBe("-");
    expect(display(0)).toBe("0");
    expect(display("H20")).toBe("H20");
  });

  it.each([
    [undefined, "?"],
    ["", "?"],
    ["Nguyễn Văn An", "NA"],
    ["Lan", "L"],
    ["  trần  thị  bình ", "TB"],
  ])("initials(%j) => %s", (name, expected) => {
    expect(initials(name as string | undefined)).toBe(expected);
  });

  const classes: GradingClassResponse[] = [
    { classId: "a", classCode: "H2001", className: "Lớp A", courseName: "H20", startDate: "2026-09-25", endDate: "2026-09-30" },
    { classId: "b", classCode: "H2002", className: "Lớp B", courseName: "H20", hasPendingGrading: true },
    { classId: "c", classCode: "GT101", className: "Lớp C", courseName: "Giao tiếp" },
    { classId: "d", classCode: "X1", courseId: "course-9" },
    { classId: "e", classCode: "X2" },
  ];

  it("courseOptions: gộp theo tên khoá (không phân biệt hoa/thường), rơi về courseId, bỏ lớp không có khoá; sắp theo tiếng Việt", () => {
    expect(courseOptions(classes)).toEqual([
      ["id:course-9", "course-9"],
      ["name:giao tiếp", "Giao tiếp"],
      ["name:h20", "H20"],
    ]);
  });

  it("classOptions: lọc theo khoá đã chọn, sắp theo tên hiển thị, kèm mã lớp", () => {
    expect(classOptions(classes, "name:h20")).toEqual([
      { id: "a", label: "Lớp A", code: "H2001" },
      { id: "b", label: "Lớp B", code: "H2002" },
    ]);
    expect(classOptions(classes, "").map((c) => c.id)).toEqual(["a", "b", "c", "d", "e"]); // Lớp A, Lớp B, Lớp C, X1, X2
  });

  it("filterClasses: lọc khoá + lớp + thời gian; lớp còn bài chờ chấm lên đầu, giữ nguyên thứ tự gốc trong mỗi nhóm (sắp xếp ổn định)", () => {
    const list: GradingClassResponse[] = Array.from({ length: 6 }, (_, i) => ({ classId: `k${i}`, hasPendingGrading: i === 2 || i === 4 }));
    expect(filterClasses(list, EMPTY_FILTERS).map((c) => c.classId)).toEqual(["k2", "k4", "k0", "k1", "k3", "k5"]);
    expect(filterClasses(classes, { ...EMPTY_FILTERS, course: "name:h20" }).map((c) => c.classId)).toEqual(["b", "a"]);
    expect(filterClasses(classes, { ...EMPTY_FILTERS, course: "name:h20", classId: "a" }).map((c) => c.classId)).toEqual(["a"]);
    expect(filterClasses(classes, { ...EMPTY_FILTERS, timeMode: "EXACT", exactDate: "2026-09-28" }, now).map((c) => c.classId)).toEqual(["a"]);
  });

  it("todayInputValue yyyy-mm-dd theo giờ địa phương; lessonHref mã hoá tham số", () => {
    expect(todayInputValue(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(lessonHref({ classId: "a b/1", courseId: "c&1" })).toBe("/instructor/list-class/list-lesson?classId=a%20b%2F1&courseId=c%261");
    expect(lessonHref({ classId: "x" })).toBe("/instructor/list-class/list-lesson?classId=x&courseId=");
  });
});
