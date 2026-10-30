// Logic thuần của màn "Quản lý lớp học" của Giảng viên (class-list-page.tsx của HSK cũ): chuẩn bị tuỳ chọn lọc, lọc, sắp xếp, cắt trang.
// Mọi thao tác phía client trên toàn bộ danh sách lớp (API không phân trang), đúng như bản cũ.
import { classCourseKey, classDisplayName, matchesClassTime, type TimeFilterMode } from "@/lib/class-list/class-list-filters";
import type { GradingClassResponse } from "@/types/grading";

const vietnameseCollator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });

/** Ô trống hiện "-" (gạch ngang ASCII như bản cũ; màn Admin dùng "—"). */
export const display = (v?: string | number | null) => (v === null || v === undefined || v === "" ? "-" : String(v));

/** Chữ cái đầu của họ và tên cuối (huy hiệu tròn cạnh tên giáo viên). */
export const initials = (name?: string) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
};

export interface ClassListFilters {
  course: string;
  classId: string;
  timeMode: TimeFilterMode;
  exactDate: string;
}

export const EMPTY_FILTERS: ClassListFilters = { course: "", classId: "", timeMode: "", exactDate: "" };

/** Khoá khoá học -> tên hiển thị, sắp xếp theo tiếng Việt. */
export function courseOptions(classes: readonly GradingClassResponse[]): [string, string][] {
  const courses = new Map<string, string>();
  classes.forEach((c) => {
    const key = classCourseKey(c);
    if (key && !courses.has(key)) courses.set(key, c.courseName?.trim() || c.courseId?.trim() || key);
  });
  return [...courses].sort((a, b) => vietnameseCollator.compare(a[1], b[1]));
}

/** Lớp thuộc khoá đang chọn (hoặc tất cả), sắp xếp theo tên hiển thị. */
export function classOptions(classes: readonly GradingClassResponse[], course: string) {
  return classes
    .filter((c) => !course || classCourseKey(c) === course)
    .map((c) => ({ id: c.classId, label: classDisplayName(c), code: c.classCode?.trim() || "" }))
    .sort((a, b) => vietnameseCollator.compare(a.label, b.label));
}

/** Lọc theo khoá/lớp/thời gian rồi đưa lớp còn bài chờ chấm lên trước (sắp xếp ổn định). */
export function filterClasses(classes: readonly GradingClassResponse[], f: ClassListFilters, now = new Date()): GradingClassResponse[] {
  return classes
    .filter((c) => (!f.course || classCourseKey(c) === f.course) && (!f.classId || c.classId === f.classId) && matchesClassTime(c, f.timeMode, f.exactDate, now))
    .sort((a, b) => (b.hasPendingGrading ? 1 : 0) - (a.hasPendingGrading ? 1 : 0));
}

/** Ngày hôm nay dạng yyyy-mm-dd theo giờ địa phương (giá trị ban đầu của ô "Ngày chính xác"). */
export function todayInputValue(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Đích khi bấm mã lớp (all_routes.listLesson cũ + query). Màn đó chưa chuyển nên hiện trang "đang chuyển đổi". */
export function lessonHref(c: GradingClassResponse): string {
  return `/instructor/list-class/list-lesson?classId=${encodeURIComponent(c.classId)}&courseId=${encodeURIComponent(c.courseId || "")}`;
}
