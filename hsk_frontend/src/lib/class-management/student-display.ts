// Hàm thuần của bảng học viên ở /admin/class-management/students (Admin). Ngưỡng màu phần trăm NGUYÊN VĂN admin-class-students-page.tsx của HSK cũ
// (≥70 xanh, ≥50 vàng, còn lại đỏ — dùng chung cho "CC BTVN" và "% Chất lượng BT").
import type { AdminClassStudent } from "@/types/admin-class";

export const STUDENTS_PAGE_SIZE = 10;

export type PercentTone = "text-success" | "text-warning" | "text-danger";

export function percentTone(pct: number): PercentTone {
  return pct >= 70 ? "text-success" : pct >= 50 ? "text-warning" : "text-danger";
}

/** `undefined`/`null`/NaN => null (giao diện hiện "—"); có số => "72%". */
export function formatPercent(pct: number | null | undefined): string | null {
  return typeof pct === "number" && Number.isFinite(pct) ? `${pct}%` : null;
}

/**
 * Cột "Số buổi đi học": HSK cũ luôn "—" (không có dữ liệu). Backend chung có attendanceSummary (presentCount/totalCount) => "x/y";
 * thiếu một trong hai, hoặc chưa có buổi nào được điểm danh (y = 0) => "—".
 */
export function attendanceLabel(student: Pick<AdminClassStudent, "attendancePresent" | "attendanceTotal">): string {
  const { attendancePresent: present, attendanceTotal: total } = student;
  if (typeof present !== "number" || typeof total !== "number" || !Number.isFinite(present) || !Number.isFinite(total) || total <= 0) return "—";
  return `${present}/${total}`;
}
