// FIXTURE TĨNH — chỉ dùng trong test. KHÔNG phải dữ liệu thật và KHÔNG được import từ mã ứng dụng.
import type { AnalyticsOverview, DashboardOverview } from "@/types/admin-overview";

export const dashboardFixture: DashboardOverview = {
  users: { total: 1234, teachers: 48, teacherManagers: 3, students: 1150 },
  classes: { total: 12, ongoing: 7, upcoming: 2, finished: 3 },
  grading: { pendingAttempts: 19, submittedThisWeek: 86, returnedThisWeek: 54 },
  revenue: {
    total: 185_000_000,
    videoCourse: 120_000_000,
    membership: 65_000_000,
    byChannel: [
      { label: "Khóa học Video", amount: 120_000_000 },
      { label: "Gói Thành viên", amount: 65_000_000 },
    ],
    note: "giả lập",
  },
  courseDistribution: [
    { label: "HSK 3", count: 2 },
    { label: "HSK 4", count: 3 },
    { label: "Giao tiếp", count: 1 },
  ],
  generatedAt: "2026-10-27T08:00:00.000Z",
};

export const analyticsFixture: AnalyticsOverview = {
  period: { from: "2026-10-21", to: "2026-10-27", days: 7 },
  totalEvents: 12_600,
  activeUsers: 342,
  eventBreakdown: [
    { eventType: "page_view", count: 5200 },
    { eventType: "flashcard_flip", count: 2100 },
    { eventType: "lesson_start", count: 1800 },
    { eventType: "mystery_event", count: 900 },
  ],
  moduleBreakdown: [
    { module: "navigation", count: 5200 },
    { module: "flashcard", count: 3000 },
    { module: "quiz", count: 2400 },
  ],
  dailyTrend: [
    { date: "2026-10-21", count: 1500 },
    { date: "2026-10-22", count: 1700 },
    { date: "2026-10-23", count: 1900 },
    { date: "2026-10-24", count: 1600 },
    { date: "2026-10-25", count: 1200 },
    { date: "2026-10-26", count: 2300 },
    { date: "2026-10-27", count: 2400 },
  ],
};
