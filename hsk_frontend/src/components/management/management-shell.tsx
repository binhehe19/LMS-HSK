"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { DemoBanner } from "@/components/demo/demo-banner";
import { ManagementAreaProvider } from "@/components/management/management-area-context";
import { BackToTop } from "@/components/shared/back-to-top";
import type { ManagementArea } from "@/lib/management/area";

/**
 * Khung trang tương đương PublicLayout của LMS_Frontend cho các trang "dashboard" (admin/teacher):
 * .main-wrapper > div > nội dung + BackToTop, kèm .sidebar-overlay. Header công khai KHÔNG hiển thị
 * ở khu vực quản lý (bản cũ ẩn Header khi URL thuộc DASHBOARD_PREFIXES) và bản cũ không có header quản lý riêng.
 * Sidebar nằm trong từng trang (ManagementPageFrame) như bản cũ, không nằm ở đây.
 * `area` quyết định sidebar nào hiện trong ManagementPageFrame.
 */
export function ManagementShell({ area, children }: { area: ManagementArea; children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.classList.remove("menu-opened");
    document.querySelector(".sidebar-overlay")?.classList.remove("opened");
  }, [pathname]);

  return (
    <ManagementAreaProvider value={area}>
      <div className="main-wrapper">
        {/* Chỉ ở bản build demo trên host được phép (null ở bản thật) — xem lib/demo/demo-mode.ts. */}
        <DemoBanner />
        <div className="">
          <div key={pathname}>{children}</div>
          <BackToTop />
        </div>
        <div className="sidebar-overlay"></div>
        {/* HSK cũ: <Toaster richColors position="top-center" /> ở src/index.tsx; toast của màn thông báo (đánh dấu đã đọc / lỗi) dùng nó. */}
        <Toaster richColors position="top-center" />
      </div>
    </ManagementAreaProvider>
  );
}
