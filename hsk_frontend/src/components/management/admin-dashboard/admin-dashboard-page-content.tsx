"use client";

import { AdminDashboardView } from "@/components/management/admin-dashboard/admin-dashboard-view";
import { useAdminDashboard } from "@/components/management/admin-dashboard/use-admin-dashboard";

// Màn "Overview" của Admin (HSK cũ: AdminDashboard). Không có tham số URL, không có thao tác ghi.
export function AdminDashboardPageContent() {
  const { state, reload } = useAdminDashboard();
  return <AdminDashboardView state={state} onRetry={reload} />;
}
