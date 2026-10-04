"use client";

import { useRouter } from "next/navigation";
import { ClassManagementView } from "@/components/management/class-management/class-management-view";
import { useAdminClasses } from "@/components/management/class-management/use-admin-classes";
import { requestCmsCacheEvict } from "@/lib/api/lms-syllabus-client";
import type { GradingClassResponse } from "@/types/grading";

export function ClassManagementPageContent() {
  const router = useRouter();
  const { state, reload } = useAdminClasses();

  // Cùng URL đích như bản cũ (window.location.assign). Trang học viên của lớp chưa được chuyển nên hiện ra 404 của Next.
  const openClass = (cls: GradingClassResponse) => {
    router.push(`/admin/class-management/students?classId=${encodeURIComponent(cls.classId)}`);
  };

  // "Tải lại" (và "Thử lại" khi lỗi): xoá cache ERP ở backend rồi mới gọi lại danh sách lớp, để thấy ngay thay đổi vừa làm trên ERP.
  const reloadFresh = () => {
    void requestCmsCacheEvict();
    reload();
  };

  return <ClassManagementView state={state} onRetry={reloadFresh} onOpenClass={openClass} />;
}
