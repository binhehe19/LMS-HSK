// View model của các màn Quản lý lớp học (Admin), độc lập với nguồn dữ liệu: backend chung (types/lms.ts) hoặc hợp đồng đề xuất của HSK cũ
// (types/grading.ts). Ánh xạ ở lib/class-management/lms-class-adapter.ts; chọn nguồn ở lib/api/admin-class-source.ts.
import type { GradingClassResponse } from "@/types/grading";

/** Thông tin một lớp ở dải đầu trang /admin/class-management/students. */
export interface AdminClassInfo extends GradingClassResponse {
  source: "lms" | "quiz";
  syllabusName?: string;
  mentorName?: string;
  studentManagerName?: string;
  meetingLink?: string;
  note?: string;
}

/** Một học viên trong bảng của /admin/class-management/students (cột như HSK cũ: Email, Tên, SĐT, Số buổi đi học, CC BTVN, % Chất lượng BT). */
export interface AdminClassStudent {
  userId: string;
  name?: string;
  email?: string;
  phone?: string;
  studentCode?: string;
  status?: string;
  /** Số buổi có mặt / tổng số buổi đã điểm danh (backend chung: attendanceSummary). HSK cũ luôn "—". */
  attendancePresent?: number;
  attendanceTotal?: number;
  attendancePercent?: number;
  /** "CC BTVN": % bài tập đã nộp. */
  homeworkCompletionPercent?: number;
  /** "% Chất lượng BT": điểm trung bình theo % (backend chung: scoreSummary.percentage). */
  qualityPercent?: number;
  scoreOnTen?: number;
}
