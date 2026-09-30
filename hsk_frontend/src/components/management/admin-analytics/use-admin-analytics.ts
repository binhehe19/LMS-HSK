"use client";

import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { getAnalyticsOverview } from "@/lib/api/admin-overview-client";
import { ApiError } from "@/lib/api/api-client";
import { isAnalyticsOverview, type AnalyticsDays } from "@/lib/admin-overview/analytics-model";
import type { AnalyticsOverview } from "@/types/admin-overview";

/**
 * Phân tích hành vi theo cửa sổ ngày. Khoá = days: đổi 7/14/30 => tải lại, phản hồi của cửa sổ cũ bị bỏ (bản cũ có thể hiện nhầm dữ liệu cũ nếu
 * phản hồi về trễ). `waiting` = dịch vụ HSK chưa cấu hình (WAITING FOR BACKEND); bản cũ nuốt mọi lỗi thành null ("Không thể tải dữ liệu").
 */
export function useAdminAnalytics(days: AnalyticsDays) {
  return useKeyedFetch<AnalyticsOverview>(`admin-analytics:${days}`, async () => {
    const data = await getAnalyticsOverview(days);
    if (!isAnalyticsOverview(data)) throw new ApiError("Dữ liệu phân tích trả về không đúng định dạng.", 200);
    return data;
  });
}
