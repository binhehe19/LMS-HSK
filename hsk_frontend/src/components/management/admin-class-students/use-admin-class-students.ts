"use client";

import { useCallback } from "react";
import { useKeyedFetch, type FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { getAdminClass, listAdminClassStudents } from "@/lib/api/admin-class-source";
import { ApiError } from "@/lib/api/api-client";
import type { AdminClassInfo, AdminClassStudent } from "@/types/admin-class";

/**
 * Hai lần tải độc lập như HSK cũ (thông tin lớp và danh sách học viên có spinner riêng); khoá = classId nên đổi lớp bỏ phản hồi của lớp cũ.
 * `classId = null` (thiếu/không hợp lệ) => KHÔNG gọi API. Nguồn dữ liệu (backend chung /api/lms hay hợp đồng HSK cũ /api/quiz) do
 * lib/api/admin-class-source.ts chọn; `waiting` = không nguồn nào được cấu hình (WAITING FOR BACKEND).
 */
export function useAdminClassStudents(classId: string | null): { info: FetchState<AdminClassInfo | null>; students: FetchState<AdminClassStudent[]>; reload: () => void } {
  const info = useKeyedFetch<AdminClassInfo | null>(classId === null ? null : `admin-class-info:${classId}`, async () => {
    try {
      return await getAdminClass(classId as string);
    } catch (error) {
      // Backend chung trả 404 khi lớp không tồn tại, nguồn HSK cũ trả null: gộp về null để màn hiện "Không tìm thấy thông tin lớp học." như bản cũ.
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  });
  const students = useKeyedFetch<AdminClassStudent[]>(classId === null ? null : `admin-class-students:${classId}`, async () => {
    const data = await listAdminClassStudents(classId as string);
    // Bản cũ biến phản hồi không phải mảng thành bảng rỗng (che lỗi hợp đồng); ở đây coi là lỗi.
    if (!Array.isArray(data)) throw new ApiError("Dữ liệu trả về không đúng định dạng danh sách học viên.", 200);
    return data;
  });

  const reloadInfo = info.reload;
  const reloadStudents = students.reload;
  const reload = useCallback(() => {
    reloadInfo();
    reloadStudents();
  }, [reloadInfo, reloadStudents]);

  return { info: info.state, students: students.state, reload };
}
