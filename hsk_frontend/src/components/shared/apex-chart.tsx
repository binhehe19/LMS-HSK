"use client";

import dynamic from "next/dynamic";

/**
 * Biểu đồ ApexCharts (HSK cũ dùng react-apexcharts ở Dashboard, Phân tích hành vi, Phân tích học tập). Thư viện chỉ chạy ở trình duyệt (dùng window)
 * nên nạp động với ssr:false; trong lúc nạp hiện spinner cùng kích thước để bố cục không nhảy.
 */
export const ApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => (
    <div className="d-flex align-items-center justify-content-center py-5" role="status" aria-live="polite">
      <span className="spinner-border text-primary" aria-hidden="true" />
      <span className="visually-hidden">Đang tải biểu đồ…</span>
    </div>
  ),
});
