"use client";
import { useStudentData } from "../student-data";
import { useRouter } from "next/navigation";
import StudentHeader from "./student-header";
import NativeModal from "../native-modal";

import { useState } from "react";
import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { UI_CONTROL_RADIUS } from "@/theme/brand-tokens";
import ProfileCard from "../profile-card";
import "../student-pages.css";
import "../student-pages-overrides.css";
import ActivityLogCard from "./activity-log-card";
import type { TimetableClassSelection } from "../timetable/timetable-class-menu";
import { Link, dashboardPath, PreviewActionContext, all_routes } from "./preview-navigation";
import "./student-dashboard.css";
import "./preview-layout.css";

const sidebar = [
  ["Tổng Quan", "isax isax-note-2", dashboardPath],
  ["Khóa Học của tôi", "isax isax-book", all_routes.studentCourses],
  ["Danh Sách Yêu Thích", "isax isax-heart", all_routes.studentWishlist],
  ["Lịch Sử Ôn Luyện", "isax isax-backward", all_routes.studentQuiz],
  ["Hỗ Trợ", "isax isax-shield-tick", all_routes.studentTickets],
  ["Hồ Sơ Của Tôi", "isax isax-user-edit", all_routes.studentProfile],
];

export default function StudentShell({ children, profileHeader = false, layout = "sidebar", spacing, timetableSelection }: {
  children: ReactNode;
  profileHeader?: boolean;
  layout?: "sidebar" | "wide" | "bleed";
  spacing?: "lesson" | "game";
  timetableSelection?: TimetableClassSelection;
}) {
  const pathname = usePathname();
  const { history } = useStudentData();
  const router = useRouter();
  const [action, setAction] = useState("");
  return (
    <PreviewActionContext.Provider value={setAction}>
      <div className="student-dashboard-wrapper student-preview" data-layout={layout} data-spacing={spacing} style={{ "--student-ui-radius": `${UI_CONTROL_RADIUS}px` } as CSSProperties}>
        <StudentHeader timetableSelection={timetableSelection} />
        <main className="student-page-content">
          <div className="container-fluid student-dashboard-container">
            {profileHeader && <ProfileCard />}
            {layout !== "sidebar" ? children : <div className="row student-preview-row">
              <aside className="col-lg-3 student-sidebar-col">
                <div className="student-sidebar-sticky-wrapper">
                  <nav className="modern-sidebar" aria-label="Bảng điều khiển học sinh">
                    <h6>BẢNG ĐIỀU KHIỂN</h6>
                    <ul className="modern-sidebar-menu">
                      {sidebar.map(([label, icon, to]) => <li key={label}><Link to={to} className={pathname === to ? "active" : ""} aria-current={pathname === to ? "page" : undefined}><i aria-hidden="true" className={icon} />{label}</Link></li>)}
                    </ul>
                  </nav>
                  {pathname === dashboardPath && <>
                   {history.error && <p role="alert" className="text-danger small">{history.error}</p>}
                   {history.data?.warnings.map(warning => <p role="alert" key={warning} className="text-danger small">{warning}</p>)}
                   <ActivityLogCard loading={history.loading} items={(history.data?.items ?? []).slice(0, 8).map(item => ({ id: item.attemptId, title: item.test.title || "Bài tự luyện", icon: "fa-solid fa-book", lastActivityAt: item.updatedAt, onResume: () => router.push(all_routes.studentQuiz) }))} />
                  </>}
                </div>
              </aside>
              <section className="col-lg-9" aria-label="Tổng quan học tập">
                {children}
              </section>
            </div>}
          </div>
        </main>
        <NativeModal show={!!action} title={action} onHide={() => setAction("")} className="student-preview-modal">
          <p>Chức năng này sẽ được kết nối khi triển khai màn hình tương ứng.</p>
          <button autoFocus type="button" className="btn btn-danger rounded-pill px-4" onClick={() => setAction("")}>Đóng</button>
        </NativeModal>
      </div>
    </PreviewActionContext.Provider>
  );
}
