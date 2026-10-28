// Hàm thuần cho bảng/thẻ thống kê của màn Quản lý giảng viên. Không import React, không gọi API.
import type { TeacherUser } from "@/types/teacher-management";

export const isBlocked = (teacher: Pick<TeacherUser, "status">): boolean => teacher.status === "BLOCKED";

/** Ba con số của thẻ thống kê (Tổng / Đang hoạt động / Đã khóa) như activeCount/blockedCount cũ. */
export function countTeachersByStatus(teachers: readonly TeacherUser[]): { total: number; active: number; blocked: number } {
  let active = 0;
  let blocked = 0;
  for (const teacher of teachers) {
    if (teacher.status === "ACTIVE") active += 1;
    else if (teacher.status === "BLOCKED") blocked += 1;
  }
  return { total: teachers.length, active, blocked };
}

/** Lọc theo tên/email không phân biệt hoa thường (filteredTeachers cũ; ô tìm kiếm bị comment ở bản cũ nhưng hàm vẫn giữ để bảng dùng). */
export function filterTeachers(teachers: readonly TeacherUser[], keyword: string): TeacherUser[] {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return [...teachers];
  return teachers.filter((teacher) => [teacher.fullName, teacher.email].some((value) => (value ?? "").toLowerCase().includes(needle)));
}

/** Chữ cái đầu cho ô avatar: lấy từ họ tên, thiếu thì từ email (như bản cũ). */
export function teacherInitial(teacher: Pick<TeacherUser, "fullName" | "email">): string {
  const source = teacher.fullName?.trim() || teacher.email;
  return source.charAt(0).toUpperCase();
}

/** Trang hợp lệ khi tổng số dòng đổi (bản cũ dùng effect ép tablePage về maxPage; ở đây suy ra lúc render). */
export function clampTablePage(page: number, total: number, pageSize: number): number {
  const maxPage = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  return Math.min(Math.max(1, page), maxPage);
}
