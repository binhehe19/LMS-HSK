import { describe, expect, it } from "vitest";
import { classDetailToAdminClassInfo, classSummaryToGradingClass, durationMinutes, enrollmentToAdminStudent, gradingStudentToAdminStudent, scheduleDaysLabel } from "@/lib/class-management/lms-class-adapter";
import type { ClassDetailResponse, ClassSummaryResponse, EnrollmentResponse } from "@/types/lms";

const summary: ClassSummaryResponse = {
  id: "01HX",
  code: "H4006",
  name: "Lớp H4006",
  courseId: "c1",
  courseName: "HSK 4 — H40",
  startDate: "2026-09-17",
  lifecycleStatus: "ONGOING",
  expectedSize: 14,
  teacherId: "t1",
  teacher: { id: "t1", fullName: "Nguyễn Minh Anh", email: "gv@example.invalid" },
  schedulePatterns: [
    { dayOfWeek: "MONDAY", startTime: "19:00", endTime: "20:30" },
    { dayOfWeek: "WEDNESDAY", startTime: "19:00", endTime: "20:30" },
    { dayOfWeek: "FRIDAY", startTime: "19:00", endTime: "20:30" },
  ],
};

describe("ánh xạ ClassSummaryResponse (backend chung) → GradingClassResponse (giao diện HSK cũ)", () => {
  it("giữ mã/tên/khoá/giáo viên; lịch 'MONDAY, WEDNESDAY, FRIDAY' => '2, 4, 6'; ca học 19:00 + 90 phút", () => {
    const c = classSummaryToGradingClass(summary);
    expect(c).toMatchObject({ classId: "01HX", classCode: "H4006", className: "Lớp H4006", courseName: "HSK 4 — H40", teacherName: "Nguyễn Minh Anh", teacherEmail: "gv@example.invalid", scheduleDays: "2, 4, 6", startTime: "19:00", duration: 90, startDate: "2026-09-17", classStatus: "ONGOING" });
  });

  it("KHÔNG đổ expectedSize (sĩ số dự kiến) vào studentCount; endDate/actualEndDate không có => undefined (giao diện hiện —)", () => {
    const c = classSummaryToGradingClass(summary);
    expect(c.studentCount).toBeUndefined();
    expect(c.endDate).toBeUndefined();
    expect(c.actualEndDate).toBeUndefined();
  });

  it.each([
    [[{ dayOfWeek: 1 }, { dayOfWeek: 3 }, { dayOfWeek: 7 }], "2, 4, CN"],
    [[{ dayOfWeek: "Sat" }, { dayOfWeek: "SUNDAY" }], "7, CN"],
    [[{ dayOfWeek: "weird" }], "weird"],
    [[{ dayOfWeek: "MONDAY" }, { dayOfWeek: "MONDAY" }], "2"],
    [[], undefined],
    [undefined, undefined],
  ])("scheduleDaysLabel(%j) => %j", (patterns, expected) => {
    expect(scheduleDaysLabel(patterns)).toBe(expected);
  });

  it.each([
    ["19:00", "20:30", 90],
    ["08:30", "10:30", 120],
    ["19:00", "19:00", undefined],
    ["19:00", undefined, undefined],
    ["abc", "20:00", undefined],
  ])("durationMinutes(%j, %j) => %j", (a, b, expected) => {
    expect(durationMinutes(a, b)).toBe(expected);
  });

  it("chi tiết lớp: thêm giáo trình, trợ giảng (mentor), quản lý học viên, số buổi/số học viên truyền vào", () => {
    const detail: ClassDetailResponse = { ...summary, syllabusName: "Giáo trình HSK 4", mentor: { id: "m1", fullName: "Lê Thu Hà" }, studentManager: { id: "s1", fullName: "Phạm Thu Trang" }, meetingLink: "https://meet.example.invalid/x" };
    const info = classDetailToAdminClassInfo(detail, 10, 8);
    expect(info).toMatchObject({ source: "lms", syllabusName: "Giáo trình HSK 4", assistantName: "Lê Thu Hà", mentorName: "Lê Thu Hà", studentManagerName: "Phạm Thu Trang", totalSessions: 10, studentCount: 8, meetingLink: "https://meet.example.invalid/x" });
  });
});

describe("ánh xạ học viên", () => {
  it("EnrollmentResponse: điểm danh, % chất lượng, CC BTVN = gradedItemCount/totalItemCount", () => {
    const e: EnrollmentResponse = { id: "e1", studentId: "u1", studentFullName: "Trần Văn A", studentEmail: "a@example.invalid", studentUserCode: "HV0001", studentPhone: "0900", status: "ENROLLED", scoreSummary: { scoreOnTen: 7.5, percentage: 75, gradedItemCount: 3, totalItemCount: 4 }, attendanceSummary: { presentCount: 4, totalCount: 5, percentage: 80 } };
    expect(enrollmentToAdminStudent(e)).toEqual({ userId: "u1", name: "Trần Văn A", email: "a@example.invalid", phone: "0900", studentCode: "HV0001", status: "ENROLLED", attendancePresent: 4, attendanceTotal: 5, attendancePercent: 80, homeworkCompletionPercent: 75, qualityPercent: 75, scoreOnTen: 7.5 });
  });

  it("EnrollmentResponse thiếu tổng hợp => các trường thống kê undefined (hiện —), không chia cho 0", () => {
    const s = enrollmentToAdminStudent({ id: "e2", studentId: "u2", scoreSummary: { totalItemCount: 0 } });
    expect(s.homeworkCompletionPercent).toBeUndefined();
    expect(s.qualityPercent).toBeUndefined();
    expect(s.attendancePercent).toBeUndefined();
  });

  it("GradingStudentResponse (hợp đồng HSK cũ): chất lượng = điểm/điểm tối đa của module đã nộp", () => {
    const s = gradingStudentToAdminStudent({ userId: "u3", name: "B", email: "b@x", completionRate: 50, modules: [{ moduleId: "m1", label: "L", submitted: true, score: 8, maxScore: 10 }, { moduleId: "m2", label: "R", submitted: false, maxScore: 10 }] });
    expect(s).toMatchObject({ userId: "u3", name: "B", homeworkCompletionPercent: 50, qualityPercent: 80 });
  });
});
