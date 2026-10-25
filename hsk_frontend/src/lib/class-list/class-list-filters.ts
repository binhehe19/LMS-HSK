// Hàm thuần của bộ lọc màn "Quản lý lớp học" của Giảng viên — NGUYÊN VĂN từ LMS_Frontend/src/features/instructor/class-management/class-list-filters.ts
// (chỉ đổi kiểu MockClass => GradingClassResponse; cùng dữ liệu).
import type { GradingClassResponse } from "@/types/grading";

export type TimeFilterMode = "" | "EXACT" | "TODAY" | "TOMORROW" | "YESTERDAY" | "PAST_7_DAYS" | "NEXT_7_DAYS";

const DAY_MS = 24 * 60 * 60 * 1000;

export const classCourseKey = (c: GradingClassResponse): string => {
  const name = c.courseName?.trim();
  if (name) return `name:${name.toLocaleLowerCase("vi")}`;
  const id = c.courseId?.trim();
  return id ? `id:${id}` : "";
};

export const classDisplayName = (c: GradingClassResponse): string => c.className?.trim() || c.classCode?.trim() || c.classId;

const dateDay = (year: number, month: number, day: number): number | null => {
  const value = Date.UTC(year, month - 1, day);
  const parsed = new Date(value);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? value : null;
};

export const parseClassDate = (value?: string | null): number | null => {
  if (!value) return null;
  const text = value.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/.exec(text);
  if (iso) return dateDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const local = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  return local ? dateDay(Number(local[3]), Number(local[2]), Number(local[1])) : null;
};

export const matchesClassTime = (c: GradingClassResponse, mode: TimeFilterMode, exactDate = "", now = new Date()): boolean => {
  if (!mode) return true;

  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  let from = today;
  let to = today;
  switch (mode) {
    case "EXACT": {
      const date = parseClassDate(exactDate);
      if (date === null) return false;
      from = to = date;
      break;
    }
    case "TOMORROW":
      from = to = today + DAY_MS;
      break;
    case "YESTERDAY":
      from = to = today - DAY_MS;
      break;
    case "PAST_7_DAYS":
      from = today - 6 * DAY_MS;
      break;
    case "NEXT_7_DAYS":
      to = today + 6 * DAY_MS;
      break;
  }

  const start = parseClassDate(c.startDate);
  const end = parseClassDate(c.actualEndDate) ?? parseClassDate(c.endDate);
  if (start === null && end === null) return false;
  const classStart = start ?? end!;
  const classEnd = Math.max(classStart, end ?? classStart);
  return classStart <= to && classEnd >= from;
};
