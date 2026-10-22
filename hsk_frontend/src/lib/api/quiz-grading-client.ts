// Hàm gọi API chấm bài/lớp học theo HỢP ĐỒNG ĐỀ XUẤT cho backend chung (đường dẫn kế thừa GradingController của repo-lms-quiz HSK cũ, qua base
// NEXT_PUBLIC_QUIZ_API_BASE_PATH). Backend chung LMS_IELTS CHƯA có endpoint tương đương cho giảng viên (B0 OPEN) nên ở production biến này để trống
// => mọi hàm ở đây ném ApiNotConfiguredError => màn hình hiện WAITING FOR BACKEND. Với máy chủ giả lập (xem trước cục bộ, kiểm thử) các endpoint này
// do scripts/mock/handlers/quiz-grading.mjs mô phỏng. Hợp đồng chi tiết: docs/api-requirements/*.md, docs/B0-P0-SECURITY-REVIEW.md mục 9.
//
// Thao tác GHI đi qua công tắc an toàn (lib/api/write-gate.ts): chỉ chạy trong chế độ xem trước cục bộ hoặc khi NEXT_PUBLIC_WRITE_QUIZ_GRADING=enabled.
"use client";

import { quizClient } from "@/lib/api/quiz-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import type {
  FinalizeAttemptRequest,
  GradeAnswerRequest,
  GradingAttemptDetailResponse,
  GradingAttemptSummaryResponse,
  GradingClassResponse,
  GradingScheduleResponse,
  GradingStudentResponse,
  LessonDetailResponse,
} from "@/types/grading";

const enc = encodeURIComponent;

/** Toàn bộ lớp cho Admin (chỉ đọc, ROLE_ADMIN). Bản cũ: quizService.getAdminGradingClasses. Production dùng backend chung (lib/api/admin-class-source.ts). */
export function listAdminGradingClasses() {
  return quizClient.get<GradingClassResponse[]>("/grading/admin/classes");
}

/** Học viên của một lớp cho Admin (hợp đồng HSK cũ GET /grading/admin/classes/{classId}/students). Production dùng /classes/{id}/enrollments của backend chung. */
export function listAdminClassStudentsLegacy(classId: string) {
  return quizClient.get<GradingStudentResponse[]>(`/grading/admin/classes/${enc(classId)}/students`);
}

/**
 * Lớp của CHÍNH giảng viên đang đăng nhập (ROLE_TEACHER/ROLE_MENTOR), dùng cho /instructor/list-class. Backend phải tự xác định giảng viên từ principal
 * đã xác thực (userId), không nhận email từ frontend (docs/api-requirements/instructor-list-class.md).
 */
export function listTeacherGradingClasses() {
  return quizClient.get<GradingClassResponse[]>("/grading/classes");
}

/** Buổi học của MỘT lớp, dùng cho /instructor/list-class/list-lesson (docs/api-requirements/instructor-list-lesson.md). */
export function listClassSchedules(classId: string) {
  return quizClient.get<GradingScheduleResponse[]>(`/grading/classes/${enc(classId)}/schedules`);
}

/**
 * Học viên của buổi học kèm bài tập đã giao/đã nộp, cho /instructor/list-class/submissions và learning-analysis. `classId` BẮT BUỘC theo hợp đồng mới
 * (B0: bài nộp phải gắn với lớp, D7b) — HSK cũ để tuỳ chọn. Backend kiểm tra giảng viên sở hữu lớp và buổi thuộc lớp.
 */
export function listScheduleStudents(scheduleId: string, classId: string) {
  return quizClient.get<GradingStudentResponse[]>(`/grading/schedules/${enc(scheduleId)}/students?classId=${enc(classId)}`);
}

/** Các bài làm của một học viên trong buổi (màn chấm bài). */
export function listStudentAttempts(scheduleId: string, userId: string, classId: string) {
  return quizClient.get<GradingAttemptSummaryResponse[]>(`/grading/schedules/${enc(scheduleId)}/students/${enc(userId)}/attempts?classId=${enc(classId)}`);
}

/** Chi tiết một bài làm (câu hỏi, đáp án, điểm máy/GV). */
export function getGradingAttempt(attemptId: string) {
  return quizClient.get<GradingAttemptDetailResponse>(`/grading/attempts/${enc(attemptId)}`);
}

// ---- thao tác GHI của chấm bài (write gate "quiz-grading") ----

/** Chấm một câu đã có bản ghi trả lời: điểm GV + nhận xét. */
export function gradeAnswer(answerId: string, body: GradeAnswerRequest, demoActive: boolean) {
  assertWriteEnabled("quiz-grading", demoActive);
  return quizClient.put<GradingAttemptDetailResponse>(`/grading/answers/${enc(answerId)}`, body);
}

/** Chấm/nhận xét câu học viên bỏ trống (chưa có answerId): backend tự tạo bản ghi trả lời rỗng rồi chấm. */
export function gradeQuestion(attemptId: string, questionId: string, body: GradeAnswerRequest, demoActive: boolean) {
  assertWriteEnabled("quiz-grading", demoActive);
  return quizClient.put<GradingAttemptDetailResponse>(`/grading/attempts/${enc(attemptId)}/questions/${enc(questionId)}`, body);
}

/** Chốt điểm bài làm (SUBMITTED → GRADED). */
export function finalizeAttempt(attemptId: string, body: FinalizeAttemptRequest, demoActive: boolean) {
  assertWriteEnabled("quiz-grading", demoActive);
  return quizClient.put<GradingAttemptDetailResponse>(`/grading/attempts/${enc(attemptId)}/finalize`, body);
}

/** Gửi kết quả một bài làm cho học viên (→ RETURNED; backend phát thông báo). */
export function sendAttempt(attemptId: string, body: FinalizeAttemptRequest | undefined, demoActive: boolean) {
  assertWriteEnabled("quiz-grading", demoActive);
  return quizClient.post<GradingAttemptDetailResponse>(`/grading/attempts/${enc(attemptId)}/send`, body ?? {});
}

/** Gửi kết quả mọi bài đã chấm của một học viên trong buổi. */
export function sendStudentResults(scheduleId: string, userId: string, classId: string, demoActive: boolean) {
  assertWriteEnabled("quiz-grading", demoActive);
  return quizClient.post<{ sent: number }>(`/grading/schedules/${enc(scheduleId)}/students/${enc(userId)}/send?classId=${enc(classId)}`);
}

// ---- chi tiết bài học (một endpoint gộp thay cho 3 lời gọi onl-learning + quiz của HSK cũ) ----

export function getLessonDetail(scheduleId: string, classId: string, title: string) {
  return quizClient.get<LessonDetailResponse>(`/grading/schedules/${enc(scheduleId)}/lesson-detail?classId=${enc(classId)}&title=${enc(title)}`);
}

/** Lưu chỉnh sửa chi tiết bài học (HSK cũ: no-op "thành công giả" khi không mock; ở đây là thao tác ghi thật sau write gate "lesson-detail"). */
export function saveLessonDetail(scheduleId: string, classId: string, body: LessonDetailResponse, demoActive: boolean) {
  assertWriteEnabled("lesson-detail", demoActive);
  return quizClient.put<LessonDetailResponse>(`/grading/schedules/${enc(scheduleId)}/lesson-detail?classId=${enc(classId)}`, body);
}
