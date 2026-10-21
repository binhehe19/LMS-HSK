// Hàm thuần của màn /admin/analytics (Phân tích hành vi học viên): bảng nhãn, định dạng số rút gọn, kiểm tra hình dạng phản hồi và cấu hình
// hai biểu đồ ApexCharts — lấy NGUYÊN VĂN từ admin-analytics-dashboard.tsx của HSK cũ, chỉ tách khỏi component để kiểm thử được.
// Không import React/Next, không gọi API.
import type { ApexOptions } from "apexcharts";
import type { AnalyticsDailyCount, AnalyticsModuleCount, AnalyticsOverview } from "@/types/admin-overview";

export const ANALYTICS_DAY_OPTIONS = [7, 14, 30] as const;
export type AnalyticsDays = (typeof ANALYTICS_DAY_OPTIONS)[number];
export const DEFAULT_ANALYTICS_DAYS: AnalyticsDays = 7;

export function isAnalyticsDays(n: number): n is AnalyticsDays {
  return (ANALYTICS_DAY_OPTIONS as readonly number[]).includes(n);
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  page_view: "Xem trang",
  lesson_start: "Bắt đầu bài học",
  lesson_complete: "Hoàn thành bài",
  flashcard_flip: "Lật thẻ",
  flashcard_study_complete: "Hoàn thành Study Set",
  video_play: "Xem video",
  video_pause: "Tạm dừng video",
  video_complete: "Hoàn thành video",
  quiz_start: "Bắt đầu quiz",
  quiz_submit: "Nộp bài quiz",
  ai_practice_start: "Luyện AI",
  search: "Tìm kiếm",
  course_enroll: "Đăng ký khóa học",
  payment_success: "Thanh toán",
};

export const MODULE_LABELS: Record<string, string> = {
  navigation: "Điều hướng",
  flashcard: "Flashcard",
  "video-course": "Video Course",
  quiz: "Quiz",
  "ai-practice": "Luyện tập AI",
  search: "Tìm kiếm",
  payment: "Thanh toán",
  "learning-path": "Lộ trình",
  listening: "Nghe",
  pronunciation: "Phát âm",
  "kanji-origin": "Kanji",
  writing: "Viết",
};

export const MODULE_COLORS = ["#392C7D", "#FF4667", "#10B981", "#F59E0B", "#6366F1", "#EC4899", "#06B6D4", "#8B5CF6", "#EF4444", "#14B8A6"];

/** Loại sự kiện/module chưa có trong bảng nhãn hiện nguyên mã (như bản cũ), không ẩn. */
export const eventTypeLabel = (eventType: string): string => EVENT_TYPE_LABELS[eventType] ?? eventType;
export const moduleLabel = (module: string): string => MODULE_LABELS[module] ?? module;

/** "formatNumber" của màn phân tích cũ: 1.2K / 3.4M, số nhỏ giữ nguyên. */
export function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/** TB sự kiện/ngày của bản cũ: Math.round(totalEvents / selectedDays); 0 khi không có sự kiện hoặc days không hợp lệ. */
export function averagePerDay(totalEvents: number, days: number): number {
  if (totalEvents <= 0 || days <= 0) return 0;
  return Math.round(totalEvents / days);
}

/**
 * Nhãn trục X "d/m". Ngày ISO "YYYY-MM-DD" được đọc trực tiếp (bản cũ dùng `new Date(d.date).getDate()`, với chuỗi chỉ có ngày thì được hiểu là UTC
 * nên ở múi giờ âm bị lệch một ngày); chuỗi dạng khác vẫn qua Date như cũ, không đọc được thì giữ nguyên.
 */
export function dayMonthLabel(date: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (iso) return `${Number(iso[3])}/${Number(iso[2])}`;
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? date : `${d.getDate()}/${d.getMonth() + 1}`;
}

// ---- kiểm tra hình dạng ----

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isKeyedCount = (v: unknown, key: string): boolean => isRecord(v) && typeof v[key] === "string" && isCount(v.count);

export function isAnalyticsOverview(data: unknown): data is AnalyticsOverview {
  if (!isRecord(data)) return false;
  return (
    isCount(data.totalEvents) &&
    isCount(data.activeUsers) &&
    Array.isArray(data.eventBreakdown) &&
    data.eventBreakdown.every((e) => isKeyedCount(e, "eventType")) &&
    Array.isArray(data.moduleBreakdown) &&
    data.moduleBreakdown.every((m) => isKeyedCount(m, "module")) &&
    Array.isArray(data.dailyTrend) &&
    data.dailyTrend.every((d) => isKeyedCount(d, "date"))
  );
}

// ---- biểu đồ ----

export interface ChartConfig<S> {
  options: ApexOptions;
  series: S;
}

export function buildDailyTrendChart(trend: readonly AnalyticsDailyCount[]): ChartConfig<{ name: string; data: number[] }[]> {
  return {
    options: {
      chart: { type: "area", height: 300, toolbar: { show: false }, zoom: { enabled: false } },
      dataLabels: { enabled: false },
      stroke: { curve: "smooth", width: 3 },
      colors: ["#392C7D"],
      fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.05, stops: [0, 100] } },
      xaxis: { categories: trend.map((d) => dayMonthLabel(d.date)), labels: { style: { colors: "#6B7280", fontSize: "12px" } } },
      yaxis: { labels: { style: { colors: "#6B7280", fontSize: "12px" }, formatter: (v) => formatCompactNumber(v) } },
      grid: { borderColor: "#E5E7EB", strokeDashArray: 4 },
      tooltip: { theme: "dark" },
    },
    series: [{ name: "Sự kiện", data: trend.map((d) => d.count) }],
  };
}

interface DonutLabelContext {
  seriesIndex: number;
  w: { globals: { series: number[] } };
}

/** Donut "Phân bố theo Module"; null khi không có module (bản cũ hiện "Chưa có dữ liệu"). Nhãn % làm tròn 0 chữ số như cũ. */
export function buildModuleDonutChart(modules: readonly AnalyticsModuleCount[]): ChartConfig<number[]> | null {
  if (modules.length === 0) return null;
  return {
    options: {
      chart: { type: "donut" },
      labels: modules.map((m) => moduleLabel(m.module)),
      colors: MODULE_COLORS.slice(0, modules.length),
      legend: { position: "bottom", fontSize: "13px" },
      dataLabels: {
        enabled: true,
        formatter: (_: string | number | number[], opts: DonutLabelContext) => {
          const total = opts.w.globals.series.reduce((a, b) => a + b, 0);
          const val = opts.w.globals.series[opts.seriesIndex] ?? 0;
          return total > 0 ? `${((val / total) * 100).toFixed(0)}%` : "0%";
        },
      },
      plotOptions: { pie: { donut: { size: "55%", labels: { show: true, total: { show: true, label: "Tổng", fontSize: "16px", fontWeight: 700 } } } } },
    },
    series: modules.map((m) => m.count),
  };
}
