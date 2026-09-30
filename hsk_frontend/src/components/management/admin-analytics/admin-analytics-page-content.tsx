"use client";

import { useState } from "react";
import { AdminAnalyticsView } from "@/components/management/admin-analytics/admin-analytics-view";
import { useAdminAnalytics } from "@/components/management/admin-analytics/use-admin-analytics";
import { DEFAULT_ANALYTICS_DAYS, type AnalyticsDays } from "@/lib/admin-overview/analytics-model";

// Màn "Phân tích hành vi" của Admin (HSK cũ: AdminAnalyticsDashboard). Cửa sổ ngày là state cục bộ như bản cũ (mặc định 7); không có thao tác ghi.
export function AdminAnalyticsPageContent() {
  const [days, setDays] = useState<AnalyticsDays>(DEFAULT_ANALYTICS_DAYS);
  const { state, reload } = useAdminAnalytics(days);
  return <AdminAnalyticsView state={state} days={days} onDaysChange={setDays} onRetry={reload} />;
}
