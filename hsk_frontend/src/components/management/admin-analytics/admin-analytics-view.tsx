"use client";

// Port của LMS_Frontend/src/features/admin/analytics/admin-analytics-dashboard.tsx (cùng DOM, class Bootstrap, style nội tuyến và chữ):
// nút 7/14/30 ngày, 3 thẻ tổng hợp, biểu đồ area theo ngày, donut theo module, bảng "Top hành vi người dùng" (EVENT_TYPE_LABELS).
// View thuần: không gọi API (container: admin-analytics-page-content.tsx). Chỉ ĐỌC. <Breadcrumb/> của bản cũ trả null với /admin/* nên không port.
//
// Khác bản cũ có chủ đích: (1) dịch vụ chưa cấu hình => WAITING FOR BACKEND không có "Thử lại" (bản cũ gộp mọi lỗi thành "Không thể tải dữ liệu");
// (2) lỗi API hiện đúng thông điệp lỗi + "Thử lại" (FetchStateNotice); (3) chuỗi ngày rỗng => "Chưa có dữ liệu" thay vì vẽ biểu đồ trống;
// (4) nút chọn ngày có aria-pressed; (5) nhãn trục X đọc ngày ISO không qua múi giờ (xem analytics-model.dayMonthLabel).
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { ApexChart } from "@/components/shared/apex-chart";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import {
  ANALYTICS_DAY_OPTIONS,
  averagePerDay,
  buildDailyTrendChart,
  buildModuleDonutChart,
  eventTypeLabel,
  formatCompactNumber,
  type AnalyticsDays,
} from "@/lib/admin-overview/analytics-model";
import type { AnalyticsOverview } from "@/types/admin-overview";

const WAITING_TEXT = "Phân tích hành vi chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị.";

interface SummaryCardProps {
  label: string;
  value: string;
  icon: string;
  gradient: string;
}

function SummaryCard({ label, value, icon, gradient }: SummaryCardProps) {
  return (
    <div className="col-md-4">
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex align-items-center">
            <span className="rounded-circle d-flex align-items-center justify-content-center me-3 flex-shrink-0" style={{ width: 48, height: 48, background: gradient }}>
              <i className={`isax ${icon} text-white fs-5`} />
            </span>
            <div>
              <span className="text-muted d-block small">{label}</span>
              <h4 className="mb-0 fw-bold" data-testid="analytics-summary-value" data-stat={label}>
                {value}
              </h4>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AdminAnalyticsViewProps {
  state: FetchState<AnalyticsOverview>;
  days: AnalyticsDays;
  onDaysChange: (days: AnalyticsDays) => void;
  onRetry: () => void;
}

export function AdminAnalyticsView({ state, days, onDaysChange, onRetry }: AdminAnalyticsViewProps) {
  const data = state.kind === "ok" ? state.data : null;
  const dailyTrendChart = data && data.dailyTrend.length > 0 ? buildDailyTrendChart(data.dailyTrend) : null;
  const moduleDonutChart = data ? buildModuleDonutChart(data.moduleBreakdown) : null;

  return (
    <ManagementPageFrame>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="fw-bold mb-0">
          <i className="isax isax-chart-21 me-2 text-primary" />
          Phân tích hành vi học viên
        </h5>
        <div className="d-flex gap-2" role="group" aria-label="Khoảng thời gian">
          {ANALYTICS_DAY_OPTIONS.map((d) => (
            <button key={d} type="button" className={`btn btn-sm ${days === d ? "btn-primary" : "btn-outline-secondary"}`} aria-pressed={days === d} onClick={() => onDaysChange(d)}>
              {d} ngày
            </button>
          ))}
        </div>
      </div>

      {state.kind === "loading" ? (
        <div className="text-center py-5" data-testid="analytics-loading">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2 text-muted">Đang tải dữ liệu phân tích...</p>
        </div>
      ) : !data ? (
        <div className="card">
          <div className="card-body text-center py-4">
            <i className="isax isax-chart-fail fs-1 text-muted mb-3 d-block" />
            <FetchStateNotice state={state} waitingText={WAITING_TEXT} onRetry={onRetry} testId="analytics-notice" className="text-start" />
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="row mb-4">
            <SummaryCard label="Tổng sự kiện" value={formatCompactNumber(data.totalEvents)} icon="isax-activity" gradient="linear-gradient(135deg, #392C7D, #6366F1)" />
            <SummaryCard label="Học viên hoạt động" value={formatCompactNumber(data.activeUsers)} icon="isax-profile-2user" gradient="linear-gradient(135deg, #10B981, #059669)" />
            <SummaryCard label="TB sự kiện/ngày" value={formatCompactNumber(averagePerDay(data.totalEvents, days))} icon="isax-chart-square" gradient="linear-gradient(135deg, #F59E0B, #D97706)" />
          </div>

          {/* Daily Trend Chart */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body">
              <h6 className="fw-bold mb-3">
                <i className="isax isax-trend-up me-2 text-primary" />
                Xu hướng hoạt động theo ngày
              </h6>
              {dailyTrendChart ? (
                <ApexChart options={dailyTrendChart.options} series={dailyTrendChart.series} type="area" height={300} />
              ) : (
                <p className="text-muted text-center py-4" data-testid="analytics-trend-empty">
                  Chưa có dữ liệu
                </p>
              )}
            </div>
          </div>

          <div className="row">
            {/* Module Breakdown Donut */}
            <div className="col-md-6">
              <div className="card border-0 shadow-sm mb-4">
                <div className="card-body">
                  <h6 className="fw-bold mb-3">
                    <i className="isax isax-diagram me-2 text-primary" />
                    Phân bố theo Module
                  </h6>
                  {moduleDonutChart ? (
                    <ApexChart options={moduleDonutChart.options} series={moduleDonutChart.series} type="donut" height={320} />
                  ) : (
                    <p className="text-muted text-center py-4" data-testid="analytics-modules-empty">
                      Chưa có dữ liệu
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Event Type Ranking */}
            <div className="col-md-6">
              <div className="card border-0 shadow-sm mb-4">
                <div className="card-body">
                  <h6 className="fw-bold mb-3">
                    <i className="isax isax-ranking me-2 text-primary" />
                    Top hành vi người dùng
                  </h6>
                  {data.eventBreakdown.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0" data-testid="analytics-events-table">
                        <thead>
                          <tr>
                            <th className="border-0 text-muted small">#</th>
                            <th className="border-0 text-muted small">Hành vi</th>
                            <th className="border-0 text-muted small text-end">Số lần</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.eventBreakdown.map((e, i) => (
                            <tr key={e.eventType}>
                              <td>
                                <span className="badge rounded-pill" style={{ background: i < 3 ? "linear-gradient(135deg, #392C7D, #6366F1)" : "#E5E7EB", color: i < 3 ? "#fff" : "#6B7280", minWidth: 24 }}>
                                  {i + 1}
                                </span>
                              </td>
                              <td>{eventTypeLabel(e.eventType)}</td>
                              <td className="text-end fw-semibold">{formatCompactNumber(e.count)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-muted text-center py-4" data-testid="analytics-events-empty">
                      Chưa có dữ liệu
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </ManagementPageFrame>
  );
}
