// Chuyển dữ liệu của backend chung (buổi học, bài làm cần chấm) sang hình dạng mà các màn danh sách chấm bài của HSK đã dùng
// (GradingScheduleResponse / GradingStudentResponse). Chỉ cho màn DANH SÁCH; màn chấm chi tiết đọc thẳng dữ liệu backend.
import type { GradingListItem } from "@/lib/api/assessment-grading-client";
import type { GradingScheduleResponse, GradingStudentModuleResponse, GradingStudentResponse } from "@/types/grading";
import type { ClassSessionResponse } from "@/types/lms";

const pad = (n: number) => String(n).padStart(2, "0");
const dateOf = (iso?: string) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : undefined;
};
const timeOf = (iso?: string) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : undefined;
};

/** Buổi học của lớp -> dòng của danh sách bài học. `sessionId` cũng là khoá buổi (`scheduleId`) ở các màn kế tiếp, khớp `sessionId` của bài làm. */
export function sessionToSchedule(session: ClassSessionResponse): GradingScheduleResponse {
  return {
    sessionId: session.id,
    sessionNo: session.sessionNo,
    topic: session.note,
    date: dateOf(session.startAt),
    sessionDate: dateOf(session.startAt),
    startTime: timeOf(session.startAt),
    endTime: timeOf(session.endAt),
  };
}

/** Bài đã chấm xong thì học viên đã thấy điểm (backend không có bước "gửi kết quả"): coi là đã trả; còn lại là đã nộp, chờ chấm. */
const moduleStatus = (item: GradingListItem) => (item.gradingStatus === "GRADED" ? "RETURNED" : "SUBMITTED");

export function attemptToModule(item: GradingListItem): GradingStudentModuleResponse {
  return {
    moduleId: item.attemptId,
    attemptId: item.attemptId,
    label: item.title || "Bài tập",
    skillType: item.assessmentType,
    submitted: item.status === "SUBMITTED",
    status: moduleStatus(item),
    score: item.earnedPoints ?? undefined,
    maxScore: item.totalPoints ?? undefined,
  };
}

/** Bài làm của một buổi -> học viên kèm các bài đã nộp (một dòng một học viên, các bài làm của họ là `modules`). */
export function attemptsToStudents(items: readonly GradingListItem[]): GradingStudentResponse[] {
  const byStudent = new Map<string, GradingListItem[]>();
  for (const item of items) byStudent.set(item.studentId, [...(byStudent.get(item.studentId) ?? []), item]);
  return [...byStudent.entries()].map(([userId, attempts]) => {
    const first = attempts[0];
    const submitted = attempts.filter((a) => a.status === "SUBMITTED");
    const earned = submitted.reduce((sum, a) => sum + (a.earnedPoints ?? 0), 0);
    const total = submitted.reduce((sum, a) => sum + (a.totalPoints ?? 0), 0);
    return {
      userId,
      name: first.studentName ?? undefined,
      email: first.studentEmail ?? undefined,
      studentCode: first.studentCode ?? undefined,
      submittedAny: submitted.length > 0,
      totalScore: earned,
      completionRate: total > 0 ? Math.round((earned / total) * 100) : 0,
      ungradedCount: submitted.filter((a) => a.gradingStatus !== "GRADED").length,
      modules: attempts.map(attemptToModule),
    };
  });
}
