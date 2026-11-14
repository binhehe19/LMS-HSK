// DTO của hai endpoint tổng quan quản trị theo HỢP ĐỒNG ĐỀ XUẤT (backend chung LMS_IELTS chưa có — docs/api-requirements/admin-overview.md):
//   GET {HSK}/management/dashboard/overview?days=  → DashboardOverview  (màn /admin/dashboard; MỘT endpoint thay cho 4 lời gọi của HSK cũ:
//                                                    payment/lms-overview + admin-user/statistics + teacher-analytics/overview + video-course/count)
//   GET {HSK}/id/analytics/admin/overview?days=    → AnalyticsOverview  (màn /admin/analytics; giữ NGUYÊN hình dạng analytics.service.ts của HSK cũ)
// Mọi số đếm là số nguyên ≥ 0; tiền tệ là VNĐ (số nguyên). Đường dẫn cuối do backend quyết định.

export interface DashboardUserStats {
  total: number;
  teachers: number;
  teacherManagers: number;
  students: number;
}

/** Bổ sung so với HSK cũ: LMS quản lý lớp nên tổng quan cần số lớp theo trạng thái. */
export interface DashboardClassStats {
  total: number;
  ongoing: number;
  upcoming: number;
  finished: number;
}

/** Bổ sung so với HSK cũ: khối lượng chấm bài. `*ThisWeek` cố định 7 ngày gần nhất (không phụ thuộc `days`). */
export interface DashboardGradingStats {
  pendingAttempts: number;
  submittedThisWeek: number;
  returnedThisWeek: number;
}

export interface RevenueChannel {
  label: string;
  amount: number;
}

export interface DashboardRevenueStats {
  total: number;
  videoCourse: number;
  membership: number;
  /** Cột của biểu đồ "Doanh thu theo kênh"; HSK cũ cố định 2 kênh (Video, Gói thành viên). */
  byChannel: RevenueChannel[];
  /** Ghi chú nguồn số liệu (máy chủ giả lập trả "giả lập" vì không có nguồn doanh thu); giao diện hiển thị nguyên văn nếu có. */
  note?: string;
}

export interface CourseDistributionItem {
  label: string;
  count: number;
}

export interface DashboardOverview {
  users: DashboardUserStats;
  classes: DashboardClassStats;
  grading: DashboardGradingStats;
  revenue: DashboardRevenueStats;
  courseDistribution: CourseDistributionItem[];
  /** ISO datetime lúc backend tính số liệu. */
  generatedAt: string;
}

export interface AnalyticsPeriod {
  from: string;
  to: string;
  days: number;
}

export interface AnalyticsEventCount {
  eventType: string;
  count: number;
}

export interface AnalyticsModuleCount {
  module: string;
  count: number;
}

export interface AnalyticsDailyCount {
  /** Ngày ISO "YYYY-MM-DD". */
  date: string;
  count: number;
}

export interface AnalyticsOverview {
  period: AnalyticsPeriod;
  totalEvents: number;
  activeUsers: number;
  /** Đã sắp giảm theo count (frontend không sắp lại, như HSK cũ). */
  eventBreakdown: AnalyticsEventCount[];
  moduleBreakdown: AnalyticsModuleCount[];
  dailyTrend: AnalyticsDailyCount[];
}
