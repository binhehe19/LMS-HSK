// Logic thuần của màn danh sách buổi học (lesson-list-page.tsx của HSK cũ): tìm kiếm, sắp xếp theo thứ tự buổi, tiêu đề hiển thị, liên kết sang các màn kế tiếp.
import type { GradingScheduleResponse } from "@/types/grading";

export const LESSON_LIST_PAGE_SIZE = 10;

/** Tìm theo `title`/`topic` (không phân biệt hoa/thường, cắt khoảng trắng hai đầu); sắp theo `sessionNo` tăng dần (thiếu => cuối), cùng số buổi thì theo tiêu đề tiếng Việt có số. */
export function filterAndSortLessons(lessons: readonly GradingScheduleResponse[], keyword: string): GradingScheduleResponse[] {
  const k = keyword.trim().toLowerCase();
  const source = k ? lessons.filter((l) => (l.title || "").toLowerCase().includes(k) || (l.topic || "").toLowerCase().includes(k)) : lessons;
  const order = (l: GradingScheduleResponse) => (l.sessionNo !== undefined && l.sessionNo !== null ? Number(l.sessionNo) : Number.MAX_SAFE_INTEGER);
  return [...source].sort((a, b) => {
    const diff = order(a) - order(b);
    return diff !== 0 ? diff : (a.title || "").localeCompare(b.title || "", "vi", { numeric: true });
  });
}

/** Tiêu đề hiển thị: "Buổi N: <title>" (không thêm tiền tố nếu title đã bắt đầu bằng "buổi"); không có title => "Buổi N"; thiếu sessionNo => "-". */
export function lessonTitleText(l: Pick<GradingScheduleResponse, "title" | "sessionNo">): string {
  if (!l.title) return `Buổi ${l.sessionNo ?? "-"}`;
  return l.title.toLowerCase().startsWith("buổi") ? l.title : `Buổi ${l.sessionNo ?? "-"}: ${l.title}`;
}

/** Màu tiêu đề: có bài tập => đỏ sẫm, không có => xanh nhạt (như bản cũ). */
export const lessonTitleColor = (l: Pick<GradingScheduleResponse, "hasAssignment">) => (l.hasAssignment ? "#800020" : "#71A6D2");

/** Khoá buổi dùng làm `scheduleId` trong query của màn kế tiếp. */
export const scheduleKey = (l: GradingScheduleResponse): string => l.syllabusScheduleId || l.sessionId;

export type LessonTarget = "lesson-detail" | "submissions" | "learning-analysis";

/** Liên kết sang màn kế tiếp, query đúng contract cũ: ?classId&courseId&scheduleId&title. Các màn đó CHƯA chuyển nên hiện trang "đang chuyển đổi". */
export function lessonTargetHref(target: LessonTarget, classId: string, courseId: string, l: GradingScheduleResponse): string {
  return (
    `/instructor/list-class/${target}?classId=${encodeURIComponent(classId)}&courseId=${encodeURIComponent(courseId)}` +
    `&scheduleId=${encodeURIComponent(scheduleKey(l))}&title=${encodeURIComponent(l.title || "")}`
  );
}
