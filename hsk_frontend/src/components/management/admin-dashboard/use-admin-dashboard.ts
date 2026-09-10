"use client";

import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { getDashboardOverview } from "@/lib/api/admin-overview-client";
import { ApiError } from "@/lib/api/api-client";
import { DASHBOARD_WINDOW_DAYS, isDashboardOverview } from "@/lib/admin-overview/dashboard-model";
import type { DashboardOverview } from "@/types/admin-overview";

/**
 * Tổng quan Admin: MỘT lời gọi (bản cũ gộp 4 lời gọi, lời gọi phụ lỗi thì im lặng giữ số 0 — ở đây mọi lỗi hiện trạng thái).
 * `waiting` = dịch vụ HSK chưa cấu hình (WAITING FOR BACKEND); phản hồi khác hợp đồng là lỗi, không hiện số 0 giả.
 */
export function useAdminDashboard() {
  return useKeyedFetch<DashboardOverview>("admin-dashboard", async () => {
    const data = await getDashboardOverview(DASHBOARD_WINDOW_DAYS);
    if (!isDashboardOverview(data)) throw new ApiError("Dữ liệu tổng quan trả về không đúng định dạng.", 200);
    return data;
  });
}
