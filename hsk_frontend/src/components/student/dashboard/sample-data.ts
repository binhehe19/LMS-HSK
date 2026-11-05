// Frontend-only fixtures. Replace at the dashboard boundary when APIs are connected.
export interface StudentTimetableItem {
  id: string;
  title?: string;
  date?: string;
  session_date?: string;
  start_time?: string;
  end_time?: string;
  class_name?: string;
  session_no?: number;
}

export const sampleStudent = {
  name: "Học Bá", username: "Học Bá", avatarUrl: "/assets/figma-home/0e447.png", avatar_url: "", avatar: "",
};
export const sampleCourse = {
  name: "HSK3 LỚP GIAO TIẾP", startDate: "14/07/2026", endDate: "14/09/2026",
  completedSessions: 12, totalSessions: 32, percent: 37.5, remainingSessions: 20, currentLevel: "HSK2",
};
export const sampleNextSession: StudentTimetableItem = {
  id: "sample-session-13", title: "Bài 13: 第八课 - 生活中不二 缺少美…", date: "2026-08-12",
  start_time: "18:00", end_time: "20:30", class_name: sampleCourse.name, session_no: 13,
};
export const sampleSkills = [
  { key: "skillListening", icon: "assets/hocba/dashboard/listen.png", percent: 24 },
  { key: "skillSpeaking", icon: "assets/hocba/dashboard/talk.png", percent: 15 },
  { key: "skillReading", icon: "assets/hocba/dashboard/read.png", percent: 100 },
  { key: "skillWriting", icon: "assets/hocba/dashboard/write.png", percent: 52 },
  { key: "skillTranslation", icon: "assets/hocba/dashboard/write.png", percent: 52 },
];
export const sampleVocabulary = { total: 320, learned: 110, learning: 68, notLearned: 142, courseName: "HSK3" };
