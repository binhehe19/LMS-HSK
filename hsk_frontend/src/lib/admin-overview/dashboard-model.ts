// Hàm thuần của màn /admin/dashboard: định dạng số liệu (formatNumber của HSK cũ, core/utils/format.ts), kiểm tra hình dạng phản hồi và
// dựng cấu hình hai biểu đồ ApexCharts (NGUYÊN VĂN options của admin-dashboard.tsx cũ, chỉ đổi dữ liệu từ cố định 2 kênh/2 loại sang mảng của API).
// Không import React/Next, không gọi API.
import type { ApexOptions } from "apexcharts";
import type { CourseDistributionItem, DashboardOverview, RevenueChannel } from "@/types/admin-overview";

/** Cửa sổ ngày gửi lên endpoint tổng quan (doanh thu trong N ngày gần nhất). */
export const DASHBOARD_WINDOW_DAYS = 30;

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n);
}

export function formatVnd(n: number): string {
  return `${formatNumber(n)} VNĐ`;
}

/** Nhãn trục Y của biểu đồ cột (triệu đồng), như bản cũ: formatNumber(Math.round(val / 1e6)) + "M VNĐ". */
export function formatMillionsVnd(n: number): string {
  return `${formatNumber(Math.round(n / 1_000_000))}M VNĐ`;
}

export function sumCounts(items: readonly { count: number }[]): number {
  return items.reduce((sum, item) => sum + item.count, 0);
}

// ---- kiểm tra hình dạng (phản hồi khác hợp đồng => hook coi là lỗi, không im lặng hiện số 0) ----

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const hasCounts = (v: unknown, keys: readonly string[]): boolean => isRecord(v) && keys.every((k) => isCount(v[k]));
const isLabelled = (v: unknown, valueKey: "amount" | "count"): boolean => isRecord(v) && typeof v.label === "string" && isCount(v[valueKey]);

export function isDashboardOverview(data: unknown): data is DashboardOverview {
  if (!isRecord(data)) return false;
  const revenue = data.revenue;
  return (
    hasCounts(data.users, ["total", "teachers", "teacherManagers", "students"]) &&
    hasCounts(data.classes, ["total", "ongoing", "upcoming", "finished"]) &&
    hasCounts(data.grading, ["pendingAttempts", "submittedThisWeek", "returnedThisWeek"]) &&
    hasCounts(revenue, ["total", "videoCourse", "membership"]) &&
    isRecord(revenue) &&
    Array.isArray(revenue.byChannel) &&
    revenue.byChannel.every((c) => isLabelled(c, "amount")) &&
    Array.isArray(data.courseDistribution) &&
    data.courseDistribution.every((c) => isLabelled(c, "count"))
  );
}

// ---- biểu đồ ----

export interface ChartConfig<S> {
  options: ApexOptions;
  series: S;
}

/** Giá trị mà formatter của ApexCharts truyền vào có thể là chuỗi/mảng; cột doanh thu luôn là một số. */
const toNumber = (v: string | number | number[]): number => (Array.isArray(v) ? (v[0] ?? 0) : Number(v));

/** Biểu đồ cột "Doanh thu theo kênh" (bản cũ: 2 cột cố định "Khóa học Video", "Gói Thành viên"; ở đây theo `revenue.byChannel`). */
export function buildRevenueColumnChart(channels: readonly RevenueChannel[]): ChartConfig<{ name: string; data: number[] }[]> {
  return {
    options: {
      chart: { type: "bar", fontFamily: "var(--hsk-font-ui)", toolbar: { show: false }, sparkline: { enabled: false } },
      plotOptions: { bar: { horizontal: false, columnWidth: "55%", borderRadius: 8, dataLabels: { position: "top" }, distributed: false } },
      dataLabels: { enabled: true, offsetY: -20, style: { fontSize: "13px", fontWeight: 700, colors: ["#1e293b"] }, formatter: (val) => formatVnd(toNumber(val)) },
      stroke: { show: false },
      colors: ["#6366f1", "#f59e0b"],
      xaxis: {
        categories: channels.map((c) => c.label),
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { fontSize: "13px", fontWeight: 600, colors: "#64748b" } },
      },
      yaxis: { title: { text: "" }, labels: { formatter: (val) => formatMillionsVnd(val), style: { fontSize: "13px", fontWeight: 500, colors: "#94a3b8" } } },
      grid: { borderColor: "#e2e8f0", strokeDashArray: 4, show: true },
      tooltip: { enabled: true, theme: "light", y: { formatter: (val) => formatVnd(val) }, marker: { show: false } },
      legend: { show: false },
    },
    series: [{ name: "Doanh thu", data: channels.map((c) => c.amount) }],
  };
}

const COURSE_COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#6366f1", "#ec4899", "#14b8a6"];

/** Donut "Phân bổ khóa học" (bản cũ: 2 lát cố định Video/Online; ở đây theo `courseDistribution`). Nhãn giữa = tổng số khóa. */
export function buildCourseDonutChart(items: readonly CourseDistributionItem[]): ChartConfig<number[]> {
  const total = sumCounts(items);
  return {
    options: {
      chart: { type: "donut", fontFamily: "var(--hsk-font-ui)" },
      labels: items.map((i) => i.label),
      colors: COURSE_COLORS.slice(0, Math.max(1, items.length)),
      legend: { position: "bottom", fontSize: "13px", fontWeight: 500 },
      dataLabels: { enabled: false },
      tooltip: { y: { formatter: (val) => `${val} khóa` } },
      plotOptions: {
        pie: {
          donut: {
            size: "72%",
            labels: {
              show: true,
              name: { fontSize: "13px", fontWeight: 600, color: "#64748b" },
              value: { fontSize: "24px", fontWeight: 800, color: "#1e293b", formatter: (val) => `${val} khóa` },
              total: { show: true, label: "Tổng khóa học", fontSize: "12px", color: "#94a3b8", formatter: () => `${total} khóa` },
            },
          },
        },
      },
      stroke: { show: false },
    },
    series: items.map((i) => i.count),
  };
}
