// WAITING FOR BACKEND — tổng quan quản trị (Admin) theo HỢP ĐỒNG ĐỀ XUẤT qua hskClient (NEXT_PUBLIC_HSK_API_BASE_PATH), backend chung LMS_IELTS CHƯA có:
//   - /admin/dashboard : GET /management/dashboard/overview?days=  (MỘT endpoint gộp thay cho 4 lời gọi riêng lẻ của HSK cũ, trong đó 2 lời gọi
//                        thuộc dịch vụ identity/payment không còn ở backend chung)
//   - /admin/analytics : GET /id/analytics/admin/overview?days=   (đường dẫn kế thừa analytics.service.ts của HSK cũ)
// Chỉ ĐỌC, không có thao tác ghi. Production để trống NEXT_PUBLIC_HSK_API_BASE_PATH => ApiNotConfiguredError => màn hiện WAITING FOR BACKEND;
// xem trước cục bộ do scripts/mock/handlers/admin-overview.mjs mô phỏng. Hợp đồng chi tiết: docs/api-requirements/admin-overview.md.
// Kiểm tra hình dạng dữ liệu bất thường làm ở hook (isDashboardOverview / isAnalyticsOverview) theo code-standards mục 4.
"use client";

import { hskClient } from "@/lib/api/hsk-client";
import type { AnalyticsOverview, DashboardOverview } from "@/types/admin-overview";

export function getDashboardOverview(days: number) {
  return hskClient.get<DashboardOverview>(`/management/dashboard/overview?days=${encodeURIComponent(days)}`);
}

export function getAnalyticsOverview(days: number) {
  return hskClient.get<AnalyticsOverview>(`/id/analytics/admin/overview?days=${encodeURIComponent(days)}`);
}
