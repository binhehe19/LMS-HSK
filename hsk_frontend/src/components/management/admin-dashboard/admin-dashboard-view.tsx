"use client";

// Port của LMS_Frontend/src/features/admin/dashboard/admin-dashboard.tsx: giữ bố cục (hàng thẻ thống kê người dùng, 3 thẻ doanh thu nền gradient,
// biểu đồ cột "Doanh thu theo kênh" + donut "Phân bổ khóa học"), class CSS (.dash-widget-card/.premium-card ở admin-dashboard.css) và chữ.
// View thuần: không gọi API (container: admin-dashboard-page-content.tsx). Chỉ ĐỌC. <Breadcrumb/> của bản cũ trả null với /admin/* nên không port.
//
// Khác bản cũ có chủ đích (UI_STD, D-UI-2 của docs/M5-FULL-DEMO-PLAN.md):
//  (1) BỔ SUNG hàng thẻ "Lớp học & chấm bài" (Lớp đang học / Bài chờ chấm / Bài nộp tuần này / Đã trả bài tuần này) — LMS này quản lý lớp, HSK cũ không có;
//  (2) dữ liệu từ MỘT endpoint gộp; dịch vụ chưa cấu hình / lỗi => FetchStateNotice + các ô "—" (bản cũ hiện số 0 như thật và chỉ báo lỗi khi cả 3 nguồn lỗi);
//  (3) doanh thu tính trong cửa sổ `days` (tiêu đề mục ghi rõ) và hiện `revenue.note` nếu backend trả (mock: "giả lập"); biểu đồ cột/donut vẽ theo mảng
//      byChannel/courseDistribution thay cho 2 cột/2 lát cố định; (4) biểu đồ treemap của bản cũ không port (được khai báo nhưng không render ở bản cũ).
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { ApexChart } from "@/components/shared/apex-chart";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { DASHBOARD_WINDOW_DAYS, buildCourseDonutChart, buildRevenueColumnChart, formatNumber, formatVnd, sumCounts } from "@/lib/admin-overview/dashboard-model";
import type { DashboardOverview } from "@/types/admin-overview";

const UNAVAILABLE = "—";
const WAITING_TEXT = "Số liệu tổng quan chưa được kết nối API (WAITING FOR BACKEND). Các ô hiển thị — nghĩa là chưa có dữ liệu.";

type Phase = "loading" | "ok" | "unavailable";

interface StatCardProps {
  title: string;
  value: string;
  iconClass: string;
  bgColor: string;
  textColor: string;
  phase: Phase;
}

function StatCard({ title, value, iconClass, bgColor, textColor, phase }: StatCardProps) {
  return (
    <div className="col-md-6 col-xl-3 mb-4">
      <div className="dash-widget-card p-4 h-100 transition-all hover-shadow" style={{ borderRadius: "16px", border: "1px solid #f1f5f9", backgroundColor: "#fff" }}>
        <div className="d-flex align-items-center">
          <div
            className="me-3 flex-shrink-0 d-flex align-items-center justify-content-center"
            style={{ width: "52px", height: "52px", borderRadius: "12px", backgroundColor: bgColor, color: textColor }}
          >
            <i className={`isax ${iconClass}`} style={{ fontSize: "28px" }}></i>
          </div>
          <div className="overflow-hidden">
            <span className="d-block text-muted fw-medium mb-1 text-truncate" style={{ fontSize: "13px" }}>
              {title}
            </span>
            <h3 className="mb-0 fw-bold text-dark" style={{ fontSize: "22px", letterSpacing: "-0.5px" }} data-testid="dash-stat-value" data-stat={title}>
              {phase === "loading" ? <span className="placeholder col-6"></span> : value}
            </h3>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FinancialCardProps {
  title: string;
  amount: string;
  subtitle: string;
  gradient: string;
  iconClass: string;
  phase: Phase;
}

function FinancialCard({ title, amount, subtitle, gradient, iconClass, phase }: FinancialCardProps) {
  return (
    <div className="col-md-4 mb-4">
      <div className="p-4 h-100 text-white position-relative overflow-hidden" style={{ borderRadius: "20px", background: gradient, boxShadow: "0 10px 30px rgba(0,0,0,0.08)", minHeight: "160px" }}>
        <div className="position-absolute" style={{ top: "-10px", right: "-10px", opacity: 0.2, fontSize: "140px" }}>
          <i className={`isax ${iconClass}`}></i>
        </div>
        <div className="position-relative" style={{ zIndex: 1 }}>
          <span className="d-block mb-2 fw-medium" style={{ fontSize: "14px", opacity: 0.9 }}>
            {title}
          </span>
          <h2 className="fw-bold mb-1 text-white" style={{ fontSize: "32px", letterSpacing: "-0.5px", textShadow: "0 2px 4px rgba(0,0,0,0.1)" }} data-testid="dash-revenue-value" data-stat={title}>
            {phase === "loading" ? <span className="placeholder col-8 bg-light"></span> : amount}
          </h2>
          <span className="d-inline-block px-3 py-1 rounded-pill mt-2" style={{ fontSize: "12px", fontWeight: 600, backgroundColor: "rgba(255,255,255,0.25)", backdropFilter: "blur(4px)" }}>
            {subtitle}
          </span>
        </div>
      </div>
    </div>
  );
}

function ChartPlaceholder({ icon, text, height, testId }: { icon: string; text: string; height: number; testId: string }) {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center" style={{ height: `${height}px` }} data-testid={testId}>
      <i className={`isax ${icon}`} style={{ fontSize: "60px", color: "#e2e8f0" }}></i>
      <span className="text-muted mt-3 fw-medium">{text}</span>
    </div>
  );
}

interface AdminDashboardViewProps {
  state: FetchState<DashboardOverview>;
  onRetry: () => void;
}

export function AdminDashboardView({ state, onRetry }: AdminDashboardViewProps) {
  const phase: Phase = state.kind === "loading" ? "loading" : state.kind === "ok" ? "ok" : "unavailable";
  const data = state.kind === "ok" ? state.data : null;
  const num = (pick: (d: DashboardOverview) => number): string => (data ? formatNumber(pick(data)) : UNAVAILABLE);
  const vnd = (pick: (d: DashboardOverview) => number): string => (data ? formatVnd(pick(data)) : UNAVAILABLE);

  const revenueChart = data && data.revenue.total > 0 ? buildRevenueColumnChart(data.revenue.byChannel) : null;
  const totalCourses = data ? sumCounts(data.courseDistribution) : 0;
  const courseChart = data && totalCourses > 0 ? buildCourseDonutChart(data.courseDistribution) : null;

  return (
    <ManagementPageFrame rowClassName="g-4">
      <FetchStateNotice state={state} waitingText={WAITING_TEXT} onRetry={onRetry} testId="dashboard-notice" className="mb-4" />

      {/* Thống kê người dùng */}
      <div className="row">
        <div className="col-12 mb-3">
          <h5 className="fw-bold text-dark d-flex align-items-center gap-2">
            <i className="isax isax-user-square text-primary" /> Thống kê người dùng
          </h5>
        </div>
        <StatCard title="Tổng người dùng" value={num((d) => d.users.total)} iconClass="isax-profile-2user" bgColor="rgba(99, 102, 241, 0.1)" textColor="#6366f1" phase={phase} />
        <StatCard title="Giảng viên" value={num((d) => d.users.teachers)} iconClass="isax-teacher" bgColor="rgba(16, 185, 129, 0.1)" textColor="#10b981" phase={phase} />
        <StatCard title="Quản lý giảng viên" value={num((d) => d.users.teacherManagers)} iconClass="isax-security-user" bgColor="rgba(245, 158, 11, 0.1)" textColor="#f59e0b" phase={phase} />
        <StatCard title="Học viên" value={num((d) => d.users.students)} iconClass="isax-user-octagon" bgColor="rgba(6, 182, 212, 0.1)" textColor="#06b6d4" phase={phase} />
      </div>

      {/* Lớp học & chấm bài — BỔ SUNG so với HSK cũ */}
      <div className="row" data-testid="dash-class-grading-row">
        <div className="col-12 mb-3">
          <h5 className="fw-bold text-dark d-flex align-items-center gap-2 mt-2">
            <i className="isax isax-teacher text-danger" /> Lớp học &amp; chấm bài
          </h5>
        </div>
        <StatCard title="Lớp đang học" value={num((d) => d.classes.ongoing)} iconClass="isax-teacher" bgColor="rgba(177, 0, 25, 0.1)" textColor="#b10019" phase={phase} />
        <StatCard title="Bài chờ chấm" value={num((d) => d.grading.pendingAttempts)} iconClass="isax-edit-2" bgColor="rgba(245, 158, 11, 0.1)" textColor="#f59e0b" phase={phase} />
        <StatCard title="Bài nộp tuần này" value={num((d) => d.grading.submittedThisWeek)} iconClass="isax-document-upload" bgColor="rgba(99, 102, 241, 0.1)" textColor="#6366f1" phase={phase} />
        <StatCard title="Đã trả bài tuần này" value={num((d) => d.grading.returnedThisWeek)} iconClass="isax-tick-circle" bgColor="rgba(16, 185, 129, 0.1)" textColor="#10b981" phase={phase} />
      </div>

      {/* Financial Hero Cards */}
      <div className="row">
        <div className="col-12 mb-3">
          <h5 className="fw-bold text-dark d-flex align-items-center gap-2 mt-2 flex-wrap">
            <i className="isax isax-money-recive text-success" /> Tổng quan doanh thu
            <small className="text-muted fw-normal" style={{ fontSize: "13px" }}>· {DASHBOARD_WINDOW_DAYS} ngày gần nhất</small>
            {data?.revenue.note && (
              <span className="badge rounded-pill bg-warning-subtle text-warning-emphasis fw-semibold" data-testid="dash-revenue-note">
                {data.revenue.note}
              </span>
            )}
          </h5>
        </div>
        <FinancialCard title="Tổng doanh thu hệ thống" amount={vnd((d) => d.revenue.total)} subtitle="Tất cả kênh" gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" iconClass="isax-dollar-circle" phase={phase} />
        <FinancialCard title="Doanh thu Khóa học Video" amount={vnd((d) => d.revenue.videoCourse)} subtitle="Nguồn thu từ Video" gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)" iconClass="isax-video-play" phase={phase} />
        <FinancialCard title="Doanh thu Gói Thành viên" amount={vnd((d) => d.revenue.membership)} subtitle="Membership Plans" gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" iconClass="isax-card" phase={phase} />
      </div>

      {/* Charts Row */}
      <div className="row">
        {/* Column Chart — Revenue by channel */}
        <div className="col-xl-6 mb-4">
          <div className="premium-card h-100">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <h5 className="fw-bold text-dark mb-1">Doanh thu theo kênh</h5>
                <p className="text-muted small mb-0">So sánh doanh thu theo loại khóa học</p>
              </div>
              <span className="badge rounded-pill d-flex align-items-center gap-1" style={{ backgroundColor: "#f0fdf4", color: "#16a34a", fontWeight: 700, fontSize: "13px", padding: "6px 14px" }}>
                <i className="isax isax-money-recive"></i> Doanh thu
              </span>
            </div>
            <div>
              {phase === "loading" ? (
                <div className="d-flex align-items-center justify-content-center" style={{ height: "300px" }}>
                  <div className="spinner-border text-primary" role="status"></div>
                </div>
              ) : revenueChart ? (
                <ApexChart options={revenueChart.options} series={revenueChart.series} type="bar" height={340} />
              ) : phase === "ok" ? (
                <ChartPlaceholder icon="isax-chart-21" text="Chưa phát sinh doanh thu" height={300} testId="dash-revenue-empty" />
              ) : (
                <ChartPlaceholder icon="isax-chart-21" text="Chưa có dữ liệu để hiển thị" height={300} testId="dash-revenue-unavailable" />
              )}
            </div>
          </div>
        </div>

        {/* Course Donut */}
        <div className="col-xl-6 mb-4">
          <div className="premium-card h-100">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <h5 className="fw-bold text-dark mb-1">Phân bổ khóa học</h5>
                <p className="text-muted small mb-0">Số lượng khóa học theo loại</p>
              </div>
              <span className="badge rounded-pill d-flex align-items-center gap-1" style={{ backgroundColor: "#eff6ff", color: "#3b82f6", fontWeight: 700, fontSize: "13px", padding: "6px 14px" }}>
                <i className="isax isax-book"></i> Khóa học
              </span>
            </div>
            <div className="d-flex align-items-center justify-content-center" style={{ height: "280px" }}>
              {phase === "loading" ? (
                <div className="spinner-border text-info" role="status"></div>
              ) : courseChart ? (
                <ApexChart options={courseChart.options} series={courseChart.series} type="donut" width="100%" height={320} />
              ) : phase === "ok" ? (
                <div className="text-center py-5 opacity-50" data-testid="dash-courses-empty">
                  <i className="isax isax-book" style={{ fontSize: "60px", color: "#e2e8f0" }}></i>
                  <span className="d-block text-muted mt-2">Chưa có khóa học</span>
                </div>
              ) : (
                <ChartPlaceholder icon="isax-book" text="Chưa có dữ liệu để hiển thị" height={260} testId="dash-courses-unavailable" />
              )}
            </div>
          </div>
        </div>
      </div>
    </ManagementPageFrame>
  );
}
