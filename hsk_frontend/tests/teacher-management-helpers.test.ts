import { describe, expect, it } from "vitest";
import { EMPTY_TEACHER_FORM, buildCreatePayload, buildUpdatePayload, emailFailureMessage, formFromTeacher, isValidEmail, validateTeacherForm, type TeacherFormValues } from "@/lib/teacher-management/teacher-form";
import { clampTablePage, countTeachersByStatus, filterTeachers, isBlocked, teacherInitial } from "@/lib/teacher-management/teacher-list";
import { TEACHER_TEMPLATE_HEADERS, TEACHER_TEMPLATE_SAMPLE_ROW, buildTeacherTemplateCsv, csvCell, csvLine } from "@/lib/teacher-management/teacher-template";
import { nextSyncProgress } from "@/components/management/teacher-management/use-cms-sync";
import { teacher, teachersFixture } from "./fixtures/teachers";

const filled = (over: Partial<TeacherFormValues> = {}): TeacherFormValues => ({ ...EMPTY_TEACHER_FORM, email: "a@b.vn", fullName: "Nguyễn Văn A", ...over });

describe("teacher-form: kiểm tra dữ liệu như bản cũ", () => {
  it.each(["a@b.vn", "ten.ho+tag@sub.domain.com"])("email hợp lệ: %s", (email) => expect(isValidEmail(email)).toBe(true));
  it.each(["", "a@b", "a b@c.vn", "@c.vn", "a@c.v"])("email không hợp lệ: %j", (email) => expect(isValidEmail(email)).toBe(false));

  it("thiếu họ tên => lỗi họ tên trước; email sai => lỗi email; đủ => null (cả hai chế độ)", () => {
    expect(validateTeacherForm(filled({ fullName: "   " }), "create")).toBe("Họ và tên là bắt buộc");
    expect(validateTeacherForm(filled({ email: "sai" }), "create")).toBe("Email chưa đúng định dạng");
    expect(validateTeacherForm(filled({ email: "sai" }), "edit")).toBe("Email của giảng viên không hợp lệ");
    expect(validateTeacherForm(filled(), "create")).toBeNull();
    expect(validateTeacherForm(filled(), "edit")).toBeNull();
  });

  it("vượt giới hạn ký tự của trường tuỳ chọn => lỗi (bản cũ chỉ dựa vào maxLength của ô nhập)", () => {
    expect(validateTeacherForm(filled({ shortDescription: "x".repeat(501) }), "create")).toBe("Mô tả ngắn tối đa 500 ký tự");
    expect(validateTeacherForm(filled({ teachingStyle: "x".repeat(301) }), "edit")).toBe("Phong cách giảng dạy tối đa 300 ký tự");
    expect(validateTeacherForm(filled({ shortDescription: "x".repeat(500) }), "create")).toBeNull();
  });

  it("payload tạo mới: cắt khoảng trắng, trường tuỳ chọn rỗng => undefined (bị bỏ khi JSON hoá)", () => {
    const payload = buildCreatePayload(filled({ email: "  a@b.vn ", fullName: " Nguyễn Văn A ", shortDescription: "  ", qualification: " HSK 6 " }));
    expect(payload).toEqual({ email: "a@b.vn", fullName: "Nguyễn Văn A", qualification: "HSK 6", avatarUrl: undefined, shortDescription: undefined, fullDescription: undefined, teachingStyle: undefined, videoIntroLink: undefined });
    expect(JSON.parse(JSON.stringify(payload))).toEqual({ email: "a@b.vn", fullName: "Nguyễn Văn A", qualification: "HSK 6" });
  });

  it("payload cập nhật: KHÔNG có email (ô khoá) và KHÔNG có status", () => {
    const payload = buildUpdatePayload(filled({ fullName: " Tên mới ", videoIntroLink: "https://v.test/1" }));
    expect(payload).toEqual({ fullName: "Tên mới", videoIntroLink: "https://v.test/1", avatarUrl: undefined, shortDescription: undefined, fullDescription: undefined, teachingStyle: undefined, qualification: undefined });
    expect("email" in payload).toBe(false);
    expect("status" in payload).toBe(false);
  });

  it("formFromTeacher: null => chuỗi rỗng, giữ email", () => {
    expect(formFromTeacher(teacher(1, { qualification: "HSK 6", fullName: undefined }))).toEqual({ ...EMPTY_TEACHER_FORM, email: "giangvien1@example.test", qualification: "HSK 6" });
  });

  it("emailFailureMessage có/không lý do", () => {
    expect(emailFailureMessage("Hộp thư đầy")).toBe("Gửi email thất bại: Hộp thư đầy");
    expect(emailFailureMessage(null)).toBe("Gửi email thất bại");
  });
});

describe("teacher-list: thống kê, lọc, chữ cái đầu, trang", () => {
  it("đếm tổng/hoạt động/đã khoá", () => {
    expect(countTeachersByStatus(teachersFixture)).toEqual({ total: 12, active: 8, blocked: 4 });
    expect(countTeachersByStatus([])).toEqual({ total: 0, active: 0, blocked: 0 });
  });

  it("lọc theo tên hoặc email, không phân biệt hoa thường; từ khoá trống => tất cả", () => {
    expect(filterTeachers(teachersFixture, "GIẢNG VIÊN 1").map((t) => t.id)).toEqual(["gv-1", "gv-10", "gv-11"]);
    expect(filterTeachers(teachersFixture, "giangvien12@").map((t) => t.id)).toEqual(["gv-12"]); // thiếu tên vẫn khớp email
    expect(filterTeachers(teachersFixture, "  ")).toHaveLength(12);
  });

  it("chữ cái đầu: từ họ tên, thiếu thì từ email; isBlocked", () => {
    expect(teacherInitial(teacher(1, { fullName: "nguyễn A" }))).toBe("N");
    expect(teacherInitial(teacher(1, { fullName: undefined, email: "zed@x.vn" }))).toBe("Z");
    expect(isBlocked(teacher(1, { status: "BLOCKED" }))).toBe(true);
    expect(isBlocked(teacher(1))).toBe(false);
  });

  it("clampTablePage: trang vượt số trang => trang cuối; rỗng => 1", () => {
    expect(clampTablePage(3, 12, 10)).toBe(2);
    expect(clampTablePage(2, 12, 10)).toBe(2);
    expect(clampTablePage(5, 0, 10)).toBe(1);
    expect(clampTablePage(0, 12, 10)).toBe(1);
  });
});

describe("teacher-template: CSV mẫu thay cho xlsx của bản cũ", () => {
  it("ô có dấu phẩy/nháy/xuống dòng được bọc và escape theo RFC 4180", () => {
    expect(csvCell("Bằng cấp / Chứng chỉ")).toBe("Bằng cấp / Chứng chỉ");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvLine(["a", "b,c"])).toBe('a,"b,c"');
  });

  it("file mẫu: BOM, đúng 8 tiêu đề của template cũ, một dòng ví dụ, CRLF", () => {
    const csv = buildTeacherTemplateCsv();
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines).toEqual([csvLine(TEACHER_TEMPLATE_HEADERS), csvLine(TEACHER_TEMPLATE_SAMPLE_ROW), ""]);
    expect(TEACHER_TEMPLATE_HEADERS).toEqual(["Email (*)", "Họ và tên (*)", "Mô tả ngắn", "Mô tả chi tiết", "Phong cách giảng dạy", "Bằng cấp / Chứng chỉ", "URL Video giới thiệu", "URL Ảnh đại diện"]);
    expect(lines[1]).toContain("giangvien1@example.com");
  });
});

describe("nextSyncProgress: nhịp thanh tiến trình như bản cũ (8 → 5 → 2, dừng ở 90)", () => {
  it.each([
    [8, 16],
    [36, 44],
    [44, 49],
    [69, 74],
    [70, 72],
    [89, 90],
    [90, 90],
  ])("%i => %i", (from, to) => expect(nextSyncProgress(from)).toBe(to));
});
