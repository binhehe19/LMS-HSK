"use client";

import type { ReactNode } from "react";
import { useManagementArea } from "@/components/management/management-area-context";
import { ManagementSidebar } from "@/components/management/management-sidebar";

/**
 * Khung nội dung của trang quản lý (Admin hoặc Giảng viên), giữ ĐÚNG DOM của trang cũ:
 *   .content[.pageClass] > .container > .row[.rowClass] > (ManagementSidebar = .col-lg-3) + .col-lg-9 > nội dung
 * Bản cũ nhúng sidebar thẳng vào từng trang (và InstructorSidebar tự chọn AdminSidebar/TeacherManagerSidebar theo role); ở đây
 * gom vào MỘT component, sidebar theo khu vực của layout (ManagementShell). <ProfileCard/> của bản cũ là `() => null`
 * nên không có DOM và không cần port. Một số trang cũ dùng `.row g-4` (khoảng cách cột) thay vì `.row` trơn: truyền qua `rowClassName`.
 */
export function ManagementPageFrame({
  contentClassName,
  rowClassName,
  children,
}: {
  contentClassName?: string;
  rowClassName?: string;
  children: ReactNode;
}) {
  const area = useManagementArea();
  return (
    <div className={`content${contentClassName ? ` ${contentClassName}` : ""}`}>
      <div className="container">
        <div className={`row${rowClassName ? ` ${rowClassName}` : ""}`}>
          <ManagementSidebar area={area} />
          <div className="col-lg-9">{children}</div>
        </div>
      </div>
    </div>
  );
}
