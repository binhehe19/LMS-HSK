// Chọn NGUỒN dữ liệu cho các màn Quản lý lớp học của Admin:
//   1. Backend chung LMS_IELTS (`NEXT_PUBLIC_LMS_API_BASE_PATH` có cấu hình): GET /classes, /classes/{id}, /sessions, /enrollments — endpoint THẬT đang tồn tại
//      (ROLE_ADMIN), là đích triển khai production. Trường HSK cũ mà backend chung không có hiện "—" (PARTIAL, xem docs/FEATURE-STATUS.md).
//   2. Hợp đồng đề xuất của HSK cũ qua quiz-grading-client (`NEXT_PUBLIC_QUIZ_API_BASE_PATH`): chỉ còn để xem trước với máy chủ giả lập và cho bộ kiểm thử
//      trình duyệt hiện có; production KHÔNG đặt biến này cho tới khi backend chung có endpoint tương ứng.
// Không có nguồn nào cấu hình => ApiNotConfiguredError => màn hình hiện WAITING FOR BACKEND. Không trộn hai nguồn trong một lần tải.
"use client";

import { isLmsApiConfigured } from "@/lib/api/lms-client";
import { getClass, listAllClassEnrollments, listAllClasses, listClassSessions } from "@/lib/api/lms-class-client";
import { listAdminClassStudentsLegacy, listAdminGradingClasses } from "@/lib/api/quiz-grading-client";
import { classDetailToAdminClassInfo, classSummaryToGradingClass, enrollmentToAdminStudent, gradingStudentToAdminStudent } from "@/lib/class-management/lms-class-adapter";
import type { AdminClassInfo, AdminClassStudent } from "@/types/admin-class";
import type { GradingClassResponse } from "@/types/grading";

export type AdminClassSource = "lms" | "quiz";

export function adminClassSource(): AdminClassSource {
  return isLmsApiConfigured() ? "lms" : "quiz";
}

/** Toàn bộ lớp cho /admin/class-management (lọc/thống kê ở client như HSK cũ). */
export async function listAdminClasses(): Promise<GradingClassResponse[]> {
  if (adminClassSource() === "lms") {
    const { items } = await listAllClasses();
    return items.map(classSummaryToGradingClass);
  }
  return listAdminGradingClasses();
}

/** Thông tin lớp cho dải đầu trang /admin/class-management/students; null nếu không tìm thấy (nguồn quiz: tìm trong danh sách). */
export async function getAdminClass(classId: string): Promise<AdminClassInfo | null> {
  if (adminClassSource() === "lms") {
    const [detail, sessions, enrollments] = await Promise.all([getClass(classId), listClassSessions(classId).catch(() => null), listAllClassEnrollments(classId).catch(() => null)]);
    return classDetailToAdminClassInfo(detail, sessions?.length, enrollments?.items.length);
  }
  const classes = await listAdminGradingClasses();
  const found = Array.isArray(classes) ? classes.find((c) => c.classId === classId) : undefined;
  return found ? { ...found, source: "quiz" } : null;
}

export async function listAdminClassStudents(classId: string): Promise<AdminClassStudent[]> {
  if (adminClassSource() === "lms") {
    const { items } = await listAllClassEnrollments(classId);
    return items.map(enrollmentToAdminStudent);
  }
  const students = await listAdminClassStudentsLegacy(classId);
  if (!Array.isArray(students)) return [];
  return students.map(gradingStudentToAdminStudent);
}
