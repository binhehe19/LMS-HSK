import type { ReactNode } from "react";
import { ManagementRouteGate } from "@/components/management/management-route-gate";

// Nhóm route (không xuất hiện trong URL) cho toàn bộ khu quản lý. Guard theo từng route do ManagementRouteGate đọc từ route-registry.
export default function ManagementLayout({ children }: { children: ReactNode }) {
  return <ManagementRouteGate>{children}</ManagementRouteGate>;
}
