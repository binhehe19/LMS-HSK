"use client";

import type { ReactNode } from "react";
import { AuthInitializer } from "@/components/auth/auth-initializer";
import { RequireAuth } from "@/components/auth/require-auth";
import { ManagementShell } from "@/components/management/management-shell";
import { areaForRoles } from "@/lib/management/area";
import { getServedRoute } from "@/lib/management/route-registry";
import { useAppSelector } from "@/redux/hooks";
import { usePathname } from "next/navigation";
import { FullScreenMessage } from "@/components/auth/auth-panels";

/**
 * Ranh giới Auth cho MỌI route khu quản lý, theo TỪNG ROUTE (không theo tiền tố URL), đặt ở layout nhóm route `(management)`.
 * Lý do: HSK cũ phân quyền theo từng route (PrivateRoute allowedRoles) và có URL dùng chung nhiều role dưới /instructor/*, /hanzi/*, ...;
 * một guard theo tiền tố sẽ hoặc chặn nhầm (Admin vào /instructor/manage-storage) hoặc cấp thừa quyền.
 *
 * - Route được phục vụ (trang thật hoặc trang "đang chuyển đổi"): đăng nhập + role ∈ route.allowedRoles (route-registry.ts), rồi bọc khung
 *   quản lý với sidebar theo role (Admin → menu Admin; Teacher/Mentor → menu Giảng viên).
 * - Route không được phục vụ (UNKNOWN, OUT_OF_SCOPE, không đăng ký): KHÔNG yêu cầu đăng nhập và KHÔNG hiện khung; children lúc này
 *   chỉ có thể là trang 404 (tests/route-registry.test.ts bảo đảm mọi page.tsx trong nhóm này đều là route MIGRATED), nên không lộ gì.
 *
 * Quyền ở đây chỉ là rào chắn giao diện; backend phải kiểm tra quyền ở mỗi API.
 */
export function ManagementRouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const route = getServedRoute(pathname);
  if (!route) return <>{children}</>;
  return (
    <AuthInitializer>
      <RequireAuth allowedRoles={route.allowedRoles}>
        <RoleShell>{children}</RoleShell>
      </RequireAuth>
    </AuthInitializer>
  );
}

function RoleShell({ children }: { children: ReactNode }) {
  const roles = useAppSelector((state) => state.auth.user?.roles);
  const area = areaForRoles(roles);
  // RequireAuth đã bảo đảm role ∈ allowedRoles ⊂ role được hỗ trợ, nên nhánh null chỉ xảy ra khi cấu hình registry sai: từ chối thay vì đoán.
  if (!area) {
    return (
      <FullScreenMessage title="Không có quyền truy cập" testId="auth-forbidden">
        <p className="text-muted mb-0">Tài khoản của bạn không có khu vực quản lý phù hợp.</p>
      </FullScreenMessage>
    );
  }
  return <ManagementShell area={area}>{children}</ManagementShell>;
}
