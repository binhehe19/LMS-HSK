"use client";
import { AppstoreOutlined, LogoutOutlined, UserOutlined } from "@ant-design/icons";
import { Dropdown } from "antd";
import { redirectToSignOut } from "@/lib/auth/auth-redirect";
import { resolveHomeDestination } from "@/lib/auth/home-destination";
import { hasAnyRole, MANAGEMENT_SUPPORTED_ROLES } from "@/lib/auth/roles";
import { useAppDispatch } from "@/redux/hooks";
import { signout } from "@/redux/slices/auth-slice";
import { useState } from "react";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStudentIdentity } from "../student-data";
import StudentNotifications from "../student-notifications";
import { TimetableClassMenu, type TimetableClassSelection } from "../timetable/timetable-class-menu";
import Image from "./image";
import { Link, dashboardPath, all_routes } from "./preview-navigation";

export default function StudentHeader({ timetableSelection }: { timetableSelection?: TimetableClassSelection }) {
 const pathname = usePathname();
 const router = useRouter();
 const dispatch = useAppDispatch();
 const identity = useStudentIdentity();
 const [menuOpen, setMenuOpen] = useState(false);
 const [accountOpen, setAccountOpen] = useState(false);
 const practiceActive = pathname === all_routes.studentQuiz;
 const lessonActive = pathname.startsWith("/learning-path/online-course/homework/");
 const resultActive = pathname.startsWith("/quiz-session/");
 const timetableActive = pathname === all_routes.studentTimetable || lessonActive;
 const dictionaryActive = pathname === all_routes.vocabulary || pathname.startsWith(`${all_routes.vocabulary}/`);
 const managementHref = hasAnyRole(identity.user?.roles, MANAGEMENT_SUPPORTED_ROLES)
   ? resolveHomeDestination("authenticated", identity.user?.roles)
   : null;
 return (
  <header className="student-topbar">
    <button type="button" className="student-menu-toggle" aria-label="Mở menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><i aria-hidden="true" className="fa-solid fa-bars" /></button>
    <Link to={dashboardPath} aria-label="Học Bá - Bảng điều khiển"><Image src="assets/hocba/hocbadentrang.png" className="student-brand" alt="Học Bá" /></Link>
    <nav className={menuOpen ? "student-topnav is-open" : "student-topnav"} aria-label="Điều hướng chính">
      <Link to={dashboardPath} className={pathname === dashboardPath ? "is-active" : ""} aria-current={pathname === dashboardPath ? "page" : undefined}>Bảng điều khiển</Link>
      <Link to={all_routes.studentCourses} className={pathname === all_routes.studentCourses ? "is-active" : ""} aria-current={pathname === all_routes.studentCourses ? "page" : undefined}>Khóa học</Link>
      <div className={`student-timetable-nav ${timetableActive ? "is-active" : resultActive ? "is-active-desktop" : ""}`}>
        <TimetableClassMenu userId={identity.user?.id} current={pathname === all_routes.studentTimetable ? "page" : lessonActive || resultActive ? "location" : undefined} selection={timetableSelection && {
          ...timetableSelection,
          onSelect: id => { timetableSelection.onSelect(id); setMenuOpen(false); },
        }} onNavigate={id => {
          setMenuOpen(false);
          router.push(id ? `${all_routes.studentTimetable}?classId=${encodeURIComponent(id)}` : all_routes.studentTimetable);
        }} />
      </div>
      <Link to={all_routes.studentQuiz} className={practiceActive ? "is-active-desktop" : undefined} aria-current={practiceActive ? "page" : undefined}>Luyện tập<span className="d-lg-none" aria-hidden="true">⌄</span></Link>
      <Link to={all_routes.vocabulary} className={dictionaryActive ? "is-active" : undefined} aria-current={pathname === all_routes.vocabulary ? "page" : dictionaryActive ? "location" : undefined}>Từ điển</Link>
    </nav>
    <div className="student-topbar-account">
      <StudentNotifications />
      <Dropdown
        autoFocus
        trigger={["click"]}
        placement="bottomRight"
        overlayClassName="student-account-dropdown"
        open={accountOpen}
        onOpenChange={setAccountOpen}
        menu={{
          items: [{
            type: "group",
            label: <div className="student-account-dropdown__identity">
              <Image src={identity.avatarUrl} alt="" />
              <strong>{identity.name}</strong>
            </div>,
            children: [
              {
                key: "profile",
                label: (
                  <Link to={all_routes.studentProfile} style={{ color: "inherit", textDecoration: "none" }} onClick={() => setAccountOpen(false)}>
                    Hồ sơ của tôi
                  </Link>
                ),
                icon: <UserOutlined aria-hidden="true" />,
              },
              ...(managementHref
                ? [{
                    key: "management",
                    label: (
                      <NextLink href={managementHref} style={{ color: "inherit", textDecoration: "none" }} onClick={() => setAccountOpen(false)}>
                        Quản trị
                      </NextLink>
                    ),
                    icon: <AppstoreOutlined aria-hidden="true" />,
                  }]
                : []),
              { key: "logout", label: "Đăng xuất", icon: <LogoutOutlined aria-hidden="true" />, danger: true },
            ],
          }],
          onClick: ({ key }) => {
            setAccountOpen(false);
            if (key === "logout") {
              dispatch(signout());
              redirectToSignOut();
            }
          },
        }}
      >
        <button type="button" className="student-account" aria-label={`Tài khoản của ${identity.name}`} aria-haspopup="menu" aria-expanded={accountOpen}>
          <Image src={identity.avatarUrl} alt="" />
          <span className="d-none d-md-inline">{identity.name}</span>
          <i className="fa-solid fa-chevron-down d-none d-md-inline" aria-hidden="true" />
        </button>
      </Dropdown>
    </div>
  </header>
 );
}
