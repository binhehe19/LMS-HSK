// Ánh xạ DTO của backend chung (types/lms.ts) sang view model các màn Quản lý lớp học của Admin (giữ nguyên giao diện HSK cũ, vốn đọc GradingClassResponse).
// Hàm thuần, không gọi API. Trường backend chung KHÔNG có (endDate/actualEndDate/duration/studentCount thực...) để undefined => giao diện hiện "—"
// thay vì bịa; `expectedSize` là sĩ số dự kiến nên KHÔNG đổ vào studentCount.
import type { AdminClassInfo, AdminClassStudent } from "@/types/admin-class";
import type { GradingClassResponse, GradingStudentResponse } from "@/types/grading";
import type { ClassDetailResponse, ClassSummaryResponse, EnrollmentResponse, SchedulePattern } from "@/types/lms";

const DAY_LABEL: Record<string, string> = {
  MONDAY: "2", TUESDAY: "3", WEDNESDAY: "4", THURSDAY: "5", FRIDAY: "6", SATURDAY: "7", SUNDAY: "CN",
  MON: "2", TUE: "3", WED: "4", THU: "5", FRI: "6", SAT: "7", SUN: "CN",
  // ISO: 1 = Thứ Hai … 7 = Chủ Nhật
  "1": "2", "2": "3", "3": "4", "4": "5", "5": "6", "6": "7", "7": "CN",
};

/** "2, 4, 6" như cột Lịch học của HSK cũ; giữ nguyên giá trị lạ để không mất thông tin. */
export function scheduleDaysLabel(patterns: SchedulePattern[] | undefined): string | undefined {
  if (!patterns?.length) return undefined;
  const labels = patterns.map((p) => (p.dayOfWeek === undefined || p.dayOfWeek === null ? null : (DAY_LABEL[String(p.dayOfWeek).toUpperCase()] ?? String(p.dayOfWeek)))).filter((x): x is string => x !== null);
  return labels.length ? [...new Set(labels)].join(", ") : undefined;
}

export function durationMinutes(startTime?: string, endTime?: string): number | undefined {
  const toMin = (t?: string) => {
    const m = t?.match(/^(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const a = toMin(startTime);
  const b = toMin(endTime);
  if (a === null || b === null) return undefined;
  const d = b - a;
  return d > 0 ? d : undefined;
}

export function classSummaryToGradingClass(c: ClassSummaryResponse): GradingClassResponse {
  const first = c.schedulePatterns?.[0];
  return {
    classId: c.id,
    classCode: c.code,
    className: c.name,
    courseId: c.courseId,
    courseName: c.courseName,
    teacherName: c.teacher?.fullName,
    teacherEmail: c.teacher?.email,
    scheduleDays: scheduleDaysLabel(c.schedulePatterns),
    startTime: first?.startTime,
    duration: durationMinutes(first?.startTime, first?.endTime),
    startDate: c.startDate,
    classStatus: c.lifecycleStatus,
  };
}

export function classDetailToAdminClassInfo(c: ClassDetailResponse, sessionCount?: number, studentCount?: number): AdminClassInfo {
  return {
    ...classSummaryToGradingClass(c),
    source: "lms",
    totalSessions: sessionCount,
    studentCount,
    syllabusName: c.syllabusName,
    assistantName: c.mentor?.fullName,
    mentorName: c.mentor?.fullName,
    studentManagerName: c.studentManager?.fullName,
    meetingLink: c.meetingLink,
    note: c.note,
  };
}

export function enrollmentToAdminStudent(e: EnrollmentResponse): AdminClassStudent {
  return {
    userId: e.studentId,
    name: e.studentFullName,
    email: e.studentEmail,
    phone: e.studentPhone,
    studentCode: e.studentUserCode,
    status: e.status,
    attendancePresent: e.attendanceSummary?.presentCount,
    attendanceTotal: e.attendanceSummary?.totalCount,
    attendancePercent: e.attendanceSummary?.percentage,
    homeworkCompletionPercent:
      e.scoreSummary?.totalItemCount && e.scoreSummary.totalItemCount > 0 && e.scoreSummary.gradedItemCount !== undefined
        ? Math.round((e.scoreSummary.gradedItemCount / e.scoreSummary.totalItemCount) * 100)
        : undefined,
    qualityPercent: e.scoreSummary?.percentage,
    scoreOnTen: e.scoreSummary?.scoreOnTen,
  };
}

/** Nguồn HSK cũ (hợp đồng đề xuất GET /grading/admin/classes/{id}/students): CC BTVN = completionRate, chất lượng = điểm/điểm tối đa của module đã nộp. */
export function gradingStudentToAdminStudent(s: GradingStudentResponse): AdminClassStudent {
  const submitted = (s.modules ?? []).filter((m) => m.submitted);
  const max = submitted.reduce((sum, m) => sum + (Number(m.maxScore) || 0), 0);
  const score = submitted.reduce((sum, m) => sum + (Number(m.score) || 0), 0);
  return {
    userId: s.userId,
    name: s.name ?? s.fullName,
    email: s.email,
    phone: s.phone,
    studentCode: s.studentCode,
    homeworkCompletionPercent: s.completionRate,
    qualityPercent: max > 0 ? Math.round((score / max) * 100) : undefined,
  };
}
