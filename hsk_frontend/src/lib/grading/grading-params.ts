// Tham số URL của ba màn chấm bài (hợp đồng query giữ NGUYÊN như HSK cũ):
//   /instructor/list-class/submissions   ?classId&courseId&scheduleId&title
//   /instructor/list-class/grading       ?scheduleId&userId&classId&courseId&title&view=detail&studentName
//   /instructor/list-class/lesson-detail ?classId&courseId&scheduleId&title
// Khác bản cũ có chủ đích: mọi khoá dùng để gọi API (classId, scheduleId, userId) được kiểm tra an toàn trước (cùng quy tắc với checkClassId của
// màn danh sách bài học); thiếu/không hợp lệ => KHÔNG gọi API, hiện thông báo. Bản cũ chỉ bỏ qua khi rỗng và nối thẳng vào đường dẫn.
import { checkClassId } from "@/lib/lesson-list/lesson-list-params";

export type RequiredIdCheck = { kind: "ok"; id: string } | { kind: "missing" } | { kind: "invalid" };

/** Kiểm tra một khoá bắt buộc lấy từ URL (classId/scheduleId/userId): cùng quy tắc với `checkClassId`. */
export function checkRequiredId(raw: string | null | undefined): RequiredIdCheck {
  const check = checkClassId(raw);
  return check.kind === "ok" ? { kind: "ok", id: check.classId } : check;
}

/** Chuỗi hiển thị/chuyển tiếp (title, studentName, courseId): chỉ cắt khoảng trắng, thiếu => rỗng. Không dùng để gọi API. */
export function readText(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

export type GradingParamNotice = "missing-class" | "invalid-class" | "missing-schedule" | "invalid-schedule" | "missing-user" | "invalid-user";

export const GRADING_PARAM_NOTICE_TEXT: Record<GradingParamNotice, string> = {
  "missing-class": 'Thiếu mã lớp (classId) trong đường dẫn. Hãy quay lại "Danh sách lớp học" và chọn một lớp.',
  "invalid-class": 'Mã lớp (classId) trong đường dẫn không hợp lệ. Hãy quay lại "Danh sách lớp học" và chọn một lớp.',
  "missing-schedule": 'Thiếu mã buổi học (scheduleId) trong đường dẫn. Hãy quay lại "Danh sách bài học" và chọn một buổi.',
  "invalid-schedule": 'Mã buổi học (scheduleId) trong đường dẫn không hợp lệ. Hãy quay lại "Danh sách bài học" và chọn một buổi.',
  "missing-user": 'Thiếu mã học viên (userId) trong đường dẫn. Hãy quay lại "Danh sách nộp bài" và chọn một học viên.',
  "invalid-user": 'Mã học viên (userId) trong đường dẫn không hợp lệ. Hãy quay lại "Danh sách nộp bài" và chọn một học viên.',
};

/**
 * Kiểm tra các khoá bắt buộc theo thứ tự ưu tiên (lớp → buổi → học viên); trả thông báo của khoá hỏng đầu tiên, hoặc các khoá đã kiểm tra.
 * `userId` chỉ bắt buộc ở màn chấm bài (truyền `undefined` ở hai màn kia).
 */
export function checkGradingParams(raw: { classId: string | null; scheduleId: string | null; userId?: string | null }):
  | { kind: "ok"; classId: string; scheduleId: string; userId: string }
  | { kind: "notice"; notice: GradingParamNotice } {
  const cls = checkRequiredId(raw.classId);
  if (cls.kind !== "ok") return { kind: "notice", notice: cls.kind === "missing" ? "missing-class" : "invalid-class" };
  const schedule = checkRequiredId(raw.scheduleId);
  if (schedule.kind !== "ok") return { kind: "notice", notice: schedule.kind === "missing" ? "missing-schedule" : "invalid-schedule" };
  if (raw.userId === undefined) return { kind: "ok", classId: cls.id, scheduleId: schedule.id, userId: "" };
  const user = checkRequiredId(raw.userId);
  if (user.kind !== "ok") return { kind: "notice", notice: user.kind === "missing" ? "missing-user" : "invalid-user" };
  return { kind: "ok", classId: cls.id, scheduleId: schedule.id, userId: user.id };
}

const q = encodeURIComponent;

/** Liên kết quay lại "Danh sách bài học" của lớp (breadcrumb của submissions/lesson-detail; nút quay lại của grading đi qua submissions). */
export const lessonListHref = (classId: string, courseId: string): string => `/instructor/list-class/list-lesson?classId=${q(classId)}&courseId=${q(courseId)}`;

/** Liên kết "Danh sách nộp bài" của một buổi (contract cũ: classId, courseId, scheduleId, title). */
export const submissionsHref = (p: { classId: string; courseId: string; scheduleId: string; title: string }): string =>
  `/instructor/list-class/submissions?classId=${q(p.classId)}&courseId=${q(p.courseId)}&scheduleId=${q(p.scheduleId)}&title=${q(p.title)}`;

/** Liên kết màn chấm bài của một học viên (SubmissionListPage.workspaceUrl + openDetail của HSK cũ: thứ tự tham số giữ nguyên). */
export const gradingWorkspaceHref = (p: { scheduleId: string; userId: string; classId: string; courseId: string; title: string; studentName: string }): string =>
  `/instructor/list-class/grading?scheduleId=${q(p.scheduleId)}&userId=${q(p.userId)}&classId=${q(p.classId)}&courseId=${q(p.courseId)}&title=${q(p.title)}` +
  `&view=detail&studentName=${q(p.studentName)}`;
