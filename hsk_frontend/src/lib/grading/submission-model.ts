// Logic thuần của màn "Danh sách nộp bài" (HSK cũ: submission-list-page.tsx): chữ cái đầu, tông màu nút chi tiết, điểm tối đa của các bài đã nộp,
// tìm kiếm + sắp xếp học viên.
import type { GradingStudentModuleResponse, GradingStudentResponse } from "@/types/grading";

export const initials = (name?: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
};

const statusKey = (status?: string) => String(status || "").toUpperCase();

/** Màu biểu tượng sách: chưa nộp/toàn bộ chờ chấm => xám; mọi bài đã trả => xanh; còn lại (đã chấm, chưa trả hết) => vàng. */
export const studentBookTone = (modules: readonly GradingStudentModuleResponse[] = []): string => {
  const submitted = modules.filter((m) => m.submitted);
  if (!submitted.length || submitted.every((m) => statusKey(m.status) === "SUBMITTED")) return "text-muted";
  if (submitted.every((m) => statusKey(m.status) === "RETURNED")) return "text-success";
  return "text-warning";
};

/** Tổng điểm tối đa của các bài học viên ĐÃ nộp (mẫu số cho tông màu điểm). */
export const submittedMaxScore = (modules: readonly GradingStudentModuleResponse[] = []): number =>
  modules.reduce((sum, module) => sum + (module.submitted ? Number(module.maxScore) || 0 : 0), 0);

export const studentDisplayName = (s: Pick<GradingStudentResponse, "name" | "fullName" | "email">): string => s.name || s.fullName || s.email || "";

/** Tìm theo tên/mã học viên/email (không phân biệt hoa/thường); sắp theo tên tiếng Việt. Không đổi mảng gốc. */
export function filterAndSortStudents(students: readonly GradingStudentResponse[], keyword: string): GradingStudentResponse[] {
  const k = keyword.trim().toLowerCase();
  const source = k ? students.filter((s) => [s.name, s.fullName, s.studentCode, s.email].some((v) => (v || "").toLowerCase().includes(k))) : students;
  return [...source].sort((a, b) => (a.name || a.fullName || "").localeCompare(b.name || b.fullName || "", "vi"));
}
