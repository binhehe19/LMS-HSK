"use client";

import { useSearchParams } from "next/navigation";
import { AdminClassStudentsView, type ClassStudentsParamNotice } from "@/components/management/admin-class-students/admin-class-students-view";
import { useAdminClassStudents } from "@/components/management/admin-class-students/use-admin-class-students";
import { checkClassId } from "@/lib/lesson-list/lesson-list-params";

// Màn "Học viên của lớp" (Admin, HSK cũ: AdminClassStudentsPage). Hợp đồng URL giữ nguyên: ?classId=. Kiểm tra an toàn classId trước khi gọi API
// (cùng quy tắc với màn Danh sách bài học). Phân trang là state cục bộ của view như bản cũ.
export function AdminClassStudentsPageContent() {
  const params = useSearchParams();
  const classCheck = checkClassId(params.get("classId"));
  const classId = classCheck.kind === "ok" ? classCheck.classId : null;
  const paramNotice: ClassStudentsParamNotice | null = classCheck.kind === "ok" ? null : { kind: classCheck.kind === "missing" ? "missing-class" : "invalid-class" };

  const { info, students, reload } = useAdminClassStudents(classId); // classId không hợp lệ => không gọi API

  return <AdminClassStudentsView paramNotice={paramNotice} info={info} students={students} onRetry={reload} />;
}
