"use client";
import { useStudentIdentity, useStudentData } from "../student-data";
import { useRouter } from "next/navigation";
import StudentNotifications from "../student-notifications";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import ProfileCard from "../profile-card";
import "../student-pages.css";
import "../student-pages-overrides.css";
import Image from "./image";
import ActivityLogCard from "./activity-log-card";
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

function PreviewDialog({ title, onClose }: { title: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className="student-preview-modal" aria-labelledby="preview-action-title" onCancel={onClose} onClick={(event) => {
      if (event.target === event.currentTarget) {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }
    }}>
      <h2 id="preview-action-title">{title}</h2>
      <p>Chức năng này sẽ được kết nối khi triển khai màn hình tương ứng.</p>
      <button autoFocus className="btn btn-danger rounded-pill px-4" onClick={onClose}>Đóng</button>
    </dialog>
  );
}

export default function StudentShell({ children, profileHeader = false, fullWidth = false }: { children: ReactNode; profileHeader?: boolean; fullWidth?: boolean }) {
  const pathname = usePathname();
  const identity = useStudentIdentity();
  const { history } = useStudentData();
  const router = useRouter();
  const [action, setAction] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <PreviewActionContext.Provider value={setAction}>
      <div className="student-dashboard-wrapper student-preview">
        <header className="student-topbar">
          <Link to={dashboardPath} aria-label="Học Bá - Bảng điều khiển"><Image src="assets/hocba/hocbadentrang.png" className="student-brand" alt="Học Bá" /></Link>
          <button className="student-menu-toggle" aria-label="Mở menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><i aria-hidden="true" className="fa-solid fa-bars" /></button>
          <nav className={menuOpen ? "student-topnav is-open" : "student-topnav"} aria-label="Điều hướng chính">
            <Link to={dashboardPath} className={pathname !== all_routes.studentCourses ? "is-active" : ""} aria-current={pathname === dashboardPath ? "page" : undefined}>Bảng điều khiển</Link>
            <Link to={all_routes.studentCourses} className={pathname === all_routes.studentCourses ? "is-active" : ""} aria-current={pathname === all_routes.studentCourses ? "page" : undefined}>Khóa học</Link>
            <Link to="Thời khóa biểu">Thời khóa biểu⌄</Link>
            <Link to={all_routes.studentQuiz}>Luyện tập⌄</Link>
            <Link to="Từ vựng">Từ vựng⌄</Link>
          </nav>
          <div className="student-topbar-account">
            <StudentNotifications />
            <Link className="student-account" to={all_routes.studentProfile}><Image src={identity.avatarUrl} alt="" /><span>{identity.name}</span></Link>
          </div>
        </header>
        <main className="student-page-content">
          <div className="container-fluid student-dashboard-container" style={{ maxWidth: 1600 }}>
            {profileHeader && <ProfileCard />}
            {fullWidth ? children : <div className="row student-preview-row">
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
        {action && <PreviewDialog title={action} onClose={() => setAction("")} />}
      </div>
    </PreviewActionContext.Provider>
  );
}
