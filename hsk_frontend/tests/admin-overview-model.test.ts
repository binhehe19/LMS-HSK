import { describe, expect, it } from "vitest";
import {
  ANALYTICS_DAY_OPTIONS,
  averagePerDay,
  buildDailyTrendChart,
  buildModuleDonutChart,
  dayMonthLabel,
  eventTypeLabel,
  formatCompactNumber,
  isAnalyticsDays,
  isAnalyticsOverview,
  moduleLabel,
} from "@/lib/admin-overview/analytics-model";
import { buildCourseDonutChart, buildRevenueColumnChart, formatMillionsVnd, formatNumber, formatVnd, isDashboardOverview, sumCounts } from "@/lib/admin-overview/dashboard-model";
import { attendanceLabel, formatPercent, percentTone } from "@/lib/class-management/student-display";
import { analyticsFixture, dashboardFixture } from "./fixtures/admin-overview";

describe("dashboard-model: định dạng số liệu (formatNumber của HSK cũ, Intl vi-VN)", () => {
  it("formatNumber nhóm hàng nghìn bằng dấu chấm; formatVnd thêm đơn vị; formatMillionsVnd làm tròn triệu", () => {
    expect(formatNumber(1234567)).toBe("1.234.567");
    expect(formatNumber(0)).toBe("0");
    expect(formatVnd(185_000_000)).toBe("185.000.000 VNĐ");
    expect(formatMillionsVnd(120_000_000)).toBe("120M VNĐ");
    expect(formatMillionsVnd(1_499_999)).toBe("1M VNĐ");
    expect(sumCounts([{ count: 2 }, { count: 3 }])).toBe(5);
  });

  it("buildRevenueColumnChart: cột theo byChannel (nhãn trục X + một series), formatter nhãn dùng VNĐ", () => {
    const chart = buildRevenueColumnChart(dashboardFixture.revenue.byChannel);
    expect(chart.options.xaxis?.categories).toEqual(["Khóa học Video", "Gói Thành viên"]);
    expect(chart.series).toEqual([{ name: "Doanh thu", data: [120_000_000, 65_000_000] }]);
    const dataLabelFormatter = chart.options.dataLabels?.formatter;
    expect(dataLabelFormatter?.(120_000_000, undefined)).toBe("120.000.000 VNĐ");
    expect(chart.options.chart?.type).toBe("bar");
  });

  it("buildCourseDonutChart: nhãn/lát theo courseDistribution, nhãn giữa là tổng số khóa", () => {
    const chart = buildCourseDonutChart(dashboardFixture.courseDistribution);
    expect(chart.options.labels).toEqual(["HSK 3", "HSK 4", "Giao tiếp"]);
    expect(chart.series).toEqual([2, 3, 1]);
    expect(chart.options.colors).toHaveLength(3);
    const total = chart.options.plotOptions?.pie?.donut?.labels?.total?.formatter;
    expect(total?.({} as never)).toBe("6 khóa");
  });

  it("isDashboardOverview: nhận đúng hợp đồng, từ chối thiếu khối / sai kiểu / byChannel không phải mảng", () => {
    expect(isDashboardOverview(dashboardFixture)).toBe(true);
    expect(isDashboardOverview({ ...dashboardFixture, revenue: { ...dashboardFixture.revenue, note: undefined } })).toBe(true);
    expect(isDashboardOverview(null)).toBe(false);
    expect(isDashboardOverview([])).toBe(false);
    expect(isDashboardOverview({ ...dashboardFixture, users: { total: "1234" } })).toBe(false);
    expect(isDashboardOverview({ ...dashboardFixture, grading: undefined })).toBe(false);
    expect(isDashboardOverview({ ...dashboardFixture, revenue: { ...dashboardFixture.revenue, byChannel: { label: "x" } } })).toBe(false);
    expect(isDashboardOverview({ ...dashboardFixture, courseDistribution: [{ label: "HSK", count: "2" }] })).toBe(false);
  });
});

describe("analytics-model: nhãn, số rút gọn, trục ngày", () => {
  it("formatCompactNumber: K/M một chữ số thập phân, số nhỏ giữ nguyên (như bản cũ)", () => {
    expect(formatCompactNumber(999)).toBe("999");
    expect(formatCompactNumber(1_000)).toBe("1.0K");
    expect(formatCompactNumber(12_600)).toBe("12.6K");
    expect(formatCompactNumber(2_450_000)).toBe("2.5M");
  });

  it("averagePerDay: làm tròn tổng/ngày; 0 khi không có sự kiện hoặc days không hợp lệ", () => {
    expect(averagePerDay(12_600, 7)).toBe(1800);
    expect(averagePerDay(10, 3)).toBe(3);
    expect(averagePerDay(0, 7)).toBe(0);
    expect(averagePerDay(100, 0)).toBe(0);
  });

  it("dayMonthLabel: ngày ISO đọc trực tiếp (không lệch múi giờ), chuỗi khác qua Date, không đọc được thì giữ nguyên", () => {
    expect(dayMonthLabel("2026-10-05")).toBe("5/10");
    expect(dayMonthLabel("2026-01-31T00:00:00Z")).toBe("31/1");
    expect(dayMonthLabel("không phải ngày")).toBe("không phải ngày");
  });

  it("eventTypeLabel/moduleLabel: tra bảng tiếng Việt của bản cũ, mã lạ hiện nguyên văn", () => {
    expect(eventTypeLabel("quiz_submit")).toBe("Nộp bài quiz");
    expect(eventTypeLabel("mystery_event")).toBe("mystery_event");
    expect(moduleLabel("ai-practice")).toBe("Luyện tập AI");
    expect(moduleLabel("unknown-module")).toBe("unknown-module");
  });

  it("isAnalyticsDays chỉ nhận 7/14/30", () => {
    expect(ANALYTICS_DAY_OPTIONS).toEqual([7, 14, 30]);
    expect(isAnalyticsDays(14)).toBe(true);
    expect(isAnalyticsDays(10)).toBe(false);
  });

  it("buildDailyTrendChart: trục X d/m theo thứ tự, series là số sự kiện", () => {
    const chart = buildDailyTrendChart(analyticsFixture.dailyTrend);
    expect(chart.options.xaxis?.categories).toEqual(["21/10", "22/10", "23/10", "24/10", "25/10", "26/10", "27/10"]);
    expect(chart.series).toEqual([{ name: "Sự kiện", data: [1500, 1700, 1900, 1600, 1200, 2300, 2400] }]);
    expect(chart.options.chart?.type).toBe("area");
  });

  it("buildModuleDonutChart: null khi rỗng; nhãn tiếng Việt, màu theo số module, nhãn % làm tròn 0 chữ số", () => {
    expect(buildModuleDonutChart([])).toBeNull();
    const chart = buildModuleDonutChart(analyticsFixture.moduleBreakdown);
    expect(chart?.options.labels).toEqual(["Điều hướng", "Flashcard", "Quiz"]);
    expect(chart?.series).toEqual([5200, 3000, 2400]);
    expect(chart?.options.colors).toHaveLength(3);
    const formatter = chart?.options.dataLabels?.formatter;
    expect(formatter?.(49, { seriesIndex: 0, w: { globals: { series: [5200, 3000, 2400] } } })).toBe("49%");
  });

  it("isAnalyticsOverview: nhận đúng hợp đồng, từ chối thiếu mảng / sai kiểu phần tử", () => {
    expect(isAnalyticsOverview(analyticsFixture)).toBe(true);
    expect(isAnalyticsOverview(null)).toBe(false);
    expect(isAnalyticsOverview({ ...analyticsFixture, totalEvents: "12600" })).toBe(false);
    expect(isAnalyticsOverview({ ...analyticsFixture, dailyTrend: undefined })).toBe(false);
    expect(isAnalyticsOverview({ ...analyticsFixture, eventBreakdown: [{ eventType: 1, count: 2 }] })).toBe(false);
    expect(isAnalyticsOverview({ ...analyticsFixture, moduleBreakdown: [{ module: "quiz", count: "2" }] })).toBe(false);
  });
});

describe("student-display: cột của bảng học viên lớp (Admin)", () => {
  it("percentTone theo ngưỡng của bản cũ (≥70 xanh, ≥50 vàng, còn lại đỏ)", () => {
    expect(percentTone(100)).toBe("text-success");
    expect(percentTone(70)).toBe("text-success");
    expect(percentTone(69)).toBe("text-warning");
    expect(percentTone(50)).toBe("text-warning");
    expect(percentTone(49)).toBe("text-danger");
    expect(percentTone(0)).toBe("text-danger");
  });

  it("formatPercent: số => 'n%', thiếu/NaN => null", () => {
    expect(formatPercent(72)).toBe("72%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(undefined)).toBeNull();
    expect(formatPercent(null)).toBeNull();
    expect(formatPercent(Number.NaN)).toBeNull();
  });

  it("attendanceLabel: 'x/y' khi có cả hai và y > 0; còn lại '—' (HSK cũ luôn '—')", () => {
    expect(attendanceLabel({ attendancePresent: 7, attendanceTotal: 9 })).toBe("7/9");
    expect(attendanceLabel({ attendancePresent: 0, attendanceTotal: 3 })).toBe("0/3");
    expect(attendanceLabel({ attendancePresent: 0, attendanceTotal: 0 })).toBe("—");
    expect(attendanceLabel({ attendancePresent: 5 })).toBe("—");
    expect(attendanceLabel({})).toBe("—");
  });
});
