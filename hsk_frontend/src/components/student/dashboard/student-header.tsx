"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStudentIdentity } from "../student-data";
import StudentNotifications from "../student-notifications";
import { TimetableClassMenu, type TimetableClassSelection } from "../timetable/timetable-class-menu";
import Image from "./image";
import { Link, dashboardPath, all_routes } from "./preview-navigation";

export default function StudentHeader({ timetableSelection }: { timetableSelection?: TimetableClassSelection }) {
 const pathname = usePathname();
 const router = useRouter();
 const identity = useStudentIdentity();
 const [menuOpen, setMenuOpen] = useState(false);
 const practiceActive = pathname === all_routes.studentQuiz;
 const lessonActive = pathname.startsWith("/learning-path/online-course/homework/");
 const resultActive = pathname.startsWith("/quiz-session/");
 const timetableActive = pathname === all_routes.studentTimetable || lessonActive;
 const dictionaryActive = pathname === all_routes.vocabulary || pathname.startsWith(`${all_routes.vocabulary}/`);
 return (
  <header className="student-topbar">
    <Link to={dashboardPath} aria-label="Học Bá - Bảng điều khiển"><Image src="assets/hocba/hocbadentrang.png" className="student-brand" alt="Học Bá" /></Link>
    <button type="button" className="student-menu-toggle" aria-label="Mở menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><i aria-hidden="true" className="fa-solid fa-bars" /></button>
    <nav className={menuOpen ? "student-topnav is-open" : "student-topnav"} aria-label="Điều hướng chính">
      <Link to={dashboardPath} className={pathname === dashboardPath ? "is-active" : ""} aria-current={pathname === dashboardPath ? "page" : undefined}>Bảng điều khiển</Link>
      <Link to={all_routes.studentCourses} className={pathname === all_routes.studentCourses ? "is-active" : ""} aria-current={pathname === all_routes.studentCourses ? "page" : undefined}>Khóa học</Link>
      <div className={`student-timetable-nav ${timetableActive ? "is-active" : resultActive ? "is-active-desktop" : ""}`}>
        {!timetableSelection && <Link to={all_routes.studentTimetable} aria-current={pathname === all_routes.studentTimetable ? "page" : lessonActive || resultActive ? "location" : undefined}>Thời khóa biểu</Link>}
        <TimetableClassMenu userId={identity.user?.id} selection={timetableSelection && {
          ...timetableSelection,
          onSelect: id => { timetableSelection.onSelect(id); setMenuOpen(false); },
        }} onNavigate={id => {
          setMenuOpen(false);
          router.push(`${all_routes.studentTimetable}?classId=${encodeURIComponent(id)}`);
        }} />
      </div>
      <Link to={all_routes.studentQuiz} className={practiceActive ? "is-active-desktop" : undefined} aria-current={practiceActive ? "page" : undefined}>Luyện tập<span className="d-lg-none" aria-hidden="true">⌄</span></Link>
      <Link to={all_routes.vocabulary} className={dictionaryActive ? "is-active" : undefined} aria-current={pathname === all_routes.vocabulary ? "page" : dictionaryActive ? "location" : undefined}>Từ điển</Link>
    </nav>
    <div className="student-topbar-account">
      <StudentNotifications />
      <Link className="student-account" to={all_routes.studentProfile} aria-current={pathname === all_routes.studentProfile ? "page" : undefined}><Image src={identity.avatarUrl} alt="" /><span>{identity.name}</span></Link>
    </div>
  </header>
 );
}
