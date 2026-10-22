// Nguồn dữ liệu "backend chung" cho các màn chấm bài của HSK (lớp → buổi học → học viên → bài làm), dùng khi `NEXT_PUBLIC_LMS_API_BASE_PATH`
// có cấu hình. Cùng khuôn với admin-class-source.ts. Chấm bài ở backend chung chỉ cho ROLE_ADMIN (AssessmentGradingManagementController);
// vai trò khác sẽ nhận 403 và màn hình báo lỗi quyền như mọi API quản lý khác.
"use client";

import { listGradingAttempts, type GradingListItem } from "@/lib/api/assessment-grading-client";
import { listClassSessions } from "@/lib/api/lms-class-client";
import { attemptsToStudents, sessionToSchedule } from "@/lib/grading/lms-grading-adapter";
import type { GradingScheduleResponse, GradingStudentResponse } from "@/types/grading";

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

/** Mọi bài làm trong buổi học của một lớp (mọi trạng thái chấm). Duyệt tối đa MAX_PAGES trang; hơn thế thì báo lỗi thay vì im lặng cắt bớt. */
export async function listClassAttempts(classId: string): Promise<GradingListItem[]> {
  const items: GradingListItem[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const res = await listGradingAttempts({ classId, allStatuses: true, contextType: "CLASS_SESSION", page, size: PAGE_SIZE });
    items.push(...res.items);
    if (page + 1 >= res.totalPages || res.items.length === 0) return items;
  }
  throw new Error(`Lớp có quá nhiều bài làm (hơn ${MAX_PAGES * PAGE_SIZE}); hãy lọc theo buổi hoặc học viên.`);
}

const isPending = (item: GradingListItem) => item.status === "SUBMITTED" && item.gradingStatus !== "GRADED";

/** Buổi học của lớp kèm số bài chờ chấm. Không tải được bài làm thì vẫn trả danh sách buổi (chỉ thiếu số chờ chấm). */
export async function listLmsClassSchedules(classId: string): Promise<GradingScheduleResponse[]> {
  const [sessions, attempts] = await Promise.all([listClassSessions(classId), listClassAttempts(classId).catch(() => null)]);
  return sessions.map((session) => {
    const schedule = sessionToSchedule(session);
    if (!attempts) return schedule;
    const mine = attempts.filter((a) => a.sessionId === session.id);
    const pending = mine.filter(isPending).length;
    return { ...schedule, hasAssignment: mine.length > 0, ungradedCount: pending, hasPendingGrading: pending > 0 };
  });
}

/** Học viên đã làm bài của một buổi, mỗi người kèm các bài làm của mình. */
export async function listLmsScheduleStudents(classId: string, scheduleId: string): Promise<GradingStudentResponse[]> {
  const attempts = await listClassAttempts(classId);
  return attemptsToStudents(attempts.filter((a) => a.sessionId === scheduleId));
}

/** Các bài làm của một học viên trong một buổi (mới nhất trước theo thứ tự backend trả về). */
export async function listLmsStudentAttempts(classId: string, scheduleId: string, userId: string): Promise<GradingListItem[]> {
  const attempts = await listClassAttempts(classId);
  return attempts.filter((a) => a.sessionId === scheduleId && a.studentId === userId);
}
