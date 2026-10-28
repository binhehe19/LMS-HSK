import { describe, expect, it } from "vitest";
import { buildCourseTypeDictionary, buildLeadsCsv, filterLeadsByStatus, formatLeadDate, leadsCsvFilename, leadStatusBadgeClass, leadStatusLabel, normalizeLookupKey, resolveLeadCourseType } from "@/lib/online-course/lead-model";
import type { OnlineCourseLead } from "@/types/online-course";

const lead = (id: string, over: Partial<OnlineCourseLead> = {}): OnlineCourseLead => ({ id, courseCode: "H40", courseName: "HSK 4", fullName: `Học viên ${id}`, email: `${id}@example.test`, phone: "0900", registeredAt: "2026-10-20T08:00:00.000Z", status: "PENDING", ...over });

describe("nhãn/màu trạng thái đăng ký", () => {
  it.each([
    ["PENDING", "Chờ tư vấn", "bg-info"],
    ["in_progress", "Đang học", "bg-warning"],
    ["COMPLETED", "Hoàn thành", "bg-success"],
    ["CANCELED", "Đã hủy", "bg-secondary"],
    [undefined, "Chờ tư vấn", "bg-info"],
    ["LẠ", "Chờ tư vấn", "bg-info"],
  ])("%s => %s / %s", (status, label, cls) => {
    expect(leadStatusLabel(status)).toBe(label);
    expect(leadStatusBadgeClass(status)).toBe(cls);
  });
});

describe("từ điển loại khoá học theo mã/id/tên (như bản cũ)", () => {
  const dictionary = buildCourseTypeDictionary([
    { id: "oc-1", code: "H40", name: "HSK 4 — H40", courseType: "Group" },
    { id: "oc-2", slug: "gt-1", title: "Giao tiếp 1", courseType: "1-1" },
    { id: "oc-3", code: "NO-TYPE" },
  ]);

  it("normalizeLookupKey bỏ ký tự không phải chữ/số và viết hoa", () => {
    expect(normalizeLookupKey(" hsk 4 — h40 ")).toBe("HSK4H40");
    expect(normalizeLookupKey(undefined)).toBe("");
  });

  it("khoá không có courseType không vào từ điển; tra được theo code, slug, id, name, title", () => {
    expect(dictionary.NOTYPE).toBeUndefined();
    expect(dictionary.H40).toBe("Group");
    expect(dictionary.GT1).toBe("1-1");
    expect(dictionary.OC1).toBe("Group");
    expect(dictionary.GIAOTIP1).toBe("1-1");
  });

  it("resolveLeadCourseType: từ điển thắng courseType của lead; không khớp => courseType của lead; không có gì => '-'", () => {
    expect(resolveLeadCourseType(lead("a", { courseType: "Khác" }), dictionary)).toBe("Group");
    expect(resolveLeadCourseType(lead("b", { courseCode: "ZZZ", courseName: "Không có", courseType: "Riêng" }), dictionary)).toBe("Riêng");
    expect(resolveLeadCourseType(lead("c", { courseCode: "ZZZ", courseName: undefined }), dictionary)).toBe("-");
  });
});

describe("lọc trạng thái phía client và định dạng ngày", () => {
  it("ALL giữ nguyên (bản sao), khác thì so khớp không phân biệt hoa thường", () => {
    const leads = [lead("1"), lead("2", { status: "completed" }), lead("3", { status: undefined })];
    expect(filterLeadsByStatus(leads, "ALL")).toEqual(leads);
    expect(filterLeadsByStatus(leads, "ALL")).not.toBe(leads);
    expect(filterLeadsByStatus(leads, "COMPLETED").map((l) => l.id)).toEqual(["2"]);
    expect(filterLeadsByStatus(leads, "PENDING").map((l) => l.id)).toEqual(["1"]);
  });

  it("formatLeadDate: thiếu => '-', chuỗi không phải ngày trả nguyên văn, ngày hợp lệ => có năm", () => {
    expect(formatLeadDate(undefined)).toBe("-");
    expect(formatLeadDate("không phải ngày")).toBe("không phải ngày");
    expect(formatLeadDate("2026-10-20T08:00:00.000Z")).toContain("2026");
  });
});

describe("xuất CSV phía trình duyệt (thay Excel của bản cũ)", () => {
  it("có BOM, dòng tiêu đề, một dòng mỗi đăng ký, escape dấu phẩy/nháy kép/xuống dòng", () => {
    const csv = buildLeadsCsv([lead("1", { fullName: 'Nguyễn "Bé" An', note: "gọi lại, tối\nmai", courseType: "Group" })], {});
    const lines = csv.split("\r\n");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe("﻿Học viên,Email,Liên hệ,Nội dung đăng ký,Mã khóa học,Loại khóa học,Ngày đăng ký,Trạng thái,Ghi chú");
    expect(lines[1].startsWith('"Nguyễn ""Bé"" An",1@example.test,0900,HSK 4,H40,Group,')).toBe(true);
    expect(lines[1].endsWith(',Chờ tư vấn,"gọi lại, tối\nmai"')).toBe(true);
  });

  it("tên file theo ngày ISO", () => {
    expect(leadsCsvFilename(new Date("2026-10-27T10:00:00Z"))).toBe("online-course-leads-2026-10-27.csv");
  });
});
