import { describe, expect, it } from "vitest";
import { LESSON_LIST_PAGE_SIZE, filterAndSortLessons, lessonTargetHref, lessonTitleColor, lessonTitleText, scheduleKey } from "@/lib/lesson-list/lesson-list-model";
import { checkClassId, clampPage, parsePage, readCourseId } from "@/lib/lesson-list/lesson-list-params";
import type { GradingScheduleResponse } from "@/types/grading";

describe("checkClassId — chỉ classId an toàn mới được dùng để gọi API", () => {
  it.each([[null], [undefined], [""], ["   "]])("%j => missing", (raw) => {
    expect(checkClassId(raw)).toEqual({ kind: "missing" });
  });

  it.each([["60"], ["mock-tc-4"], ["6f1c2b9e-0b1a-4c43-9a7e-1f2d3c4b5a69"], ["CLASS_01.a:b"]])("%j => ok", (raw) => {
    expect(checkClassId(raw)).toEqual({ kind: "ok", classId: raw });
  });

  it("cắt khoảng trắng hai đầu", () => {
    expect(checkClassId("  60 ")).toEqual({ kind: "ok", classId: "60" });
  });

  it.each([["../admin"], ["a/b"], ["a\\b"], ["a?b=1"], ["a#b"], ["a%2Fb"], ["a\nb"], ["a\u0000b"], ["."], [".."], ["x".repeat(129)]])("%j => invalid (không gọi API)", (raw) => {
    expect(checkClassId(raw)).toEqual({ kind: "invalid" });
  });

  it("đúng 128 ký tự vẫn hợp lệ", () => {
    expect(checkClassId("x".repeat(128)).kind).toBe("ok");
  });
});

describe("parsePage / clampPage / readCourseId", () => {
  it.each([
    [null, 1],
    ["", 1],
    ["abc", 1],
    ["0", 1],
    ["-3", 1], // bản cũ: Number("-3") || 1 = -3
    ["1.5", 1],
    ["2", 2],
    ["07", 7],
  ])("parsePage(%j) = %i", (raw, expected) => {
    expect(parsePage(raw)).toBe(expected);
  });

  it("clampPage kẹp trong [1, tổng số trang]; 0 bản ghi => 1", () => {
    expect(clampPage(3, 25, 10)).toBe(3);
    expect(clampPage(4, 25, 10)).toBe(3);
    expect(clampPage(99, 0, 10)).toBe(1);
    expect(clampPage(0, 25, 10)).toBe(1);
  });

  it("readCourseId: thiếu => rỗng; cắt khoảng trắng; không tự suy ra", () => {
    expect(readCourseId(null)).toBe("");
    expect(readCourseId(" c1 ")).toBe("c1");
  });
});

const lesson = (over: Partial<GradingScheduleResponse>): GradingScheduleResponse => ({ sessionId: "s", ...over });

describe("filterAndSortLessons", () => {
  const list = [
    lesson({ sessionId: "a", sessionNo: 3, title: "Bài 10" }),
    lesson({ sessionId: "b", sessionNo: 1, title: "Buổi 1", topic: "Chào hỏi" }),
    lesson({ sessionId: "c", title: "Không số buổi" }),
    lesson({ sessionId: "d", sessionNo: 2, title: "Bài 2", topic: "Số đếm" }),
    lesson({ sessionId: "e", sessionNo: 3, title: "Bài 9" }),
  ];

  it("sắp theo sessionNo tăng dần; thiếu sessionNo xuống cuối; cùng số buổi sắp theo tiêu đề có số (9 < 10)", () => {
    expect(filterAndSortLessons(list, "").map((l) => l.sessionId)).toEqual(["b", "d", "e", "a", "c"]);
  });

  it("không đổi mảng gốc", () => {
    const copy = [...list];
    filterAndSortLessons(list, "");
    expect(list).toEqual(copy);
  });

  it("tìm theo title hoặc topic, không phân biệt hoa/thường, bỏ khoảng trắng hai đầu", () => {
    expect(filterAndSortLessons(list, "  CHÀO ").map((l) => l.sessionId)).toEqual(["b"]);
    expect(filterAndSortLessons(list, "bài").map((l) => l.sessionId)).toEqual(["d", "e", "a"]);
    expect(filterAndSortLessons(list, "số").map((l) => l.sessionId)).toEqual(["d", "c"]); // topic "Số đếm" + title "Không số buổi"
    expect(filterAndSortLessons(list, "không có")).toEqual([]);
  });
});

describe("lessonTitleText / lessonTitleColor", () => {
  it.each([
    [{ title: "Buổi 1", sessionNo: 1 }, "Buổi 1"], // đã có tiền tố
    [{ title: "buổi học thử", sessionNo: 9 }, "buổi học thử"], // so sánh không phân biệt hoa/thường
    [{ title: "Xin chào", sessionNo: 2 }, "Buổi 2: Xin chào"],
    [{ title: "Xin chào" }, "Buổi -: Xin chào"],
    [{ sessionNo: 3 }, "Buổi 3"],
    [{}, "Buổi -"],
    [{ title: "", sessionNo: 0 }, "Buổi 0"],
  ])("%j => %s", (input, expected) => {
    expect(lessonTitleText(input)).toBe(expected);
  });

  it("màu: có bài tập đỏ sẫm, còn lại xanh nhạt", () => {
    expect(lessonTitleColor({ hasAssignment: true })).toBe("#800020");
    expect(lessonTitleColor({ hasAssignment: false })).toBe("#71A6D2");
    expect(lessonTitleColor({})).toBe("#71A6D2");
  });
});

describe("liên kết sang màn kế tiếp (contract query cũ: classId, courseId, scheduleId, title)", () => {
  it("scheduleKey ưu tiên syllabusScheduleId, rơi về sessionId", () => {
    expect(scheduleKey(lesson({ sessionId: "s1", syllabusScheduleId: "syl1" }))).toBe("syl1");
    expect(scheduleKey(lesson({ sessionId: "s1" }))).toBe("s1");
    expect(scheduleKey(lesson({ sessionId: "s1", syllabusScheduleId: "" }))).toBe("s1");
  });

  it("mã hoá tham số và đặt đúng thứ tự; title thiếu => rỗng; courseId thiếu => rỗng", () => {
    const l = lesson({ sessionId: "s 1", syllabusScheduleId: "a&b", title: "Bài 1: A/B?" });
    expect(lessonTargetHref("submissions", "c 1", "k&1", l)).toBe("/instructor/list-class/submissions?classId=c%201&courseId=k%261&scheduleId=a%26b&title=B%C3%A0i%201%3A%20A%2FB%3F");
    expect(lessonTargetHref("lesson-detail", "60", "", lesson({ sessionId: "s2" }))).toBe("/instructor/list-class/lesson-detail?classId=60&courseId=&scheduleId=s2&title=");
    expect(lessonTargetHref("learning-analysis", "60", "7", lesson({ sessionId: "s2", title: "X" }))).toBe("/instructor/list-class/learning-analysis?classId=60&courseId=7&scheduleId=s2&title=X");
  });

  it("kích thước trang 10", () => {
    expect(LESSON_LIST_PAGE_SIZE).toBe(10);
  });
});
