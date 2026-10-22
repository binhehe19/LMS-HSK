"use client";

import { useState } from "react";
import dayjs from "dayjs";
import StudentShell from "./student-shell";
import { useNavigate } from "./preview-navigation";
import DashboardHeroHeader from "./dashboard-hero-header";
import StreakWidget from "./streak-widget";
import NextSessionCard from "./next-session-card";
import AchievementsCard from "./achievements-card";
import SkillProgressCard from "./skill-progress-card";
import VocabularyCard from "./vocabulary-card";
import MentorAdviceCard from "./mentor-advice-card";
import { useStudentData, DataStatus } from "../student-data";
import { upcomingSession, safeMeetingUrl } from "../student-model";

function DashboardWidgets() {
  const [week, setWeek] = useState(() => dayjs().subtract((dayjs().day() + 6) % 7, "day").format("YYYY-MM-DD"));
  const open = useNavigate();
  const { classes } = useStudentData();
  const upcoming = upcomingSession(classes.data ?? []);
  const nextSession = upcoming ? { ...upcoming, title: upcoming.topic, session_no: upcoming.sessionNo, date: upcoming.startAt?.slice(0, 10), start_time: upcoming.startAt, end_time: upcoming.endAt } : null;
  const join = () => { const url = safeMeetingUrl(upcoming?.meetingLink); if (url) window.open(url, "_blank", "noopener,noreferrer"); else open("Chưa có liên kết vào lớp. Vui lòng liên hệ giảng viên."); };
  const weekDays = Array.from({ length: 7 }, (_, index) => dayjs(week).add(index, "day"));
  return <div className="student-dashboard-grid">
    <DashboardHeroHeader onContinueLearning={join} />
    <StreakWidget weekDays={weekDays} onPrevWeek={() => setWeek(dayjs(week).subtract(7, "day").format("YYYY-MM-DD"))} onNextWeek={() => setWeek(dayjs(week).add(7, "day").format("YYYY-MM-DD"))} />
    <div style={{ display: "contents" }}><NextSessionCard session={nextSession} loading={classes.loading} onJoin={join} />{classes.error && <DataStatus state={classes} />}</div>
    {classes.data?.filter(course => course.detailError).map(course => <p role="alert" className="text-danger small" key={course.id}>Không tải được lịch lớp {course.code || course.id}: {course.detailError}</p>)}
    <AchievementsCard /><SkillProgressCard /><VocabularyCard /><MentorAdviceCard />
  </div>;
}
export default function StudentDashboard() {
  return <StudentShell><DashboardWidgets /></StudentShell>;
}
