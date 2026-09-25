"use client";

import { useEffect, type ReactNode } from "react";
import { isAuthFrontendConfigured, redirectToAuthFrontend } from "@/lib/auth/auth-redirect";
import { isDevIdpLogin } from "@/lib/auth/dev-token-session";
import { clearAuthRedirectMark, hasRecentAuthRedirect, markAuthRedirect } from "@/lib/auth/redirect-guard";
import { hasAnyRole } from "@/lib/auth/roles";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { authCheckRetry, authRedirectBlocked } from "@/redux/slices/auth-slice";
import { AuthCard, FullScreenMessage } from "@/components/auth/auth-panels";

interface RequireAuthProps {
  children: ReactNode;
  /** Chỉ cho phép user có ÍT NHẤT MỘT role trong danh sách (so khớp chính xác, vd ["ROLE_ADMIN"]). */
  allowedRoles?: readonly string[];
}

/**
 * Bảo vệ một nhóm route (đặt trong layout, BÊN TRONG <AuthInitializer>). Theo mẫu RequireAuth của
 * IELTS nhưng KHÔNG có đường tắt bỏ qua kiểm tra (IELTS bỏ qua mọi kiểm tra khi NODE_ENV=development):
 * ở đây dev/prod hành xử giống nhau.
 *
 * Chưa đăng nhập => đăng nhập qua oauth2-proxy (`/oauth2/start`, quay về đúng trang hiện tại; `next dev` thì qua trang tài khoản),
 * tối đa một lần trong cửa sổ thời gian (redirect-guard); quay về mà vẫn chưa có phiên thì hiện hướng dẫn thay vì chuyển
 * tiếp (chống vòng lặp).
 *
 * LƯU Ý: đây chỉ là rào chắn giao diện. Quyền thật phải được backend kiểm tra ở mỗi API.
 */
export function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.auth.status);
  const user = useAppSelector((state) => state.auth.user);
  const errorMessage = useAppSelector((state) => state.auth.errorMessage);
  // Chỉ `next dev` đăng nhập qua trang tài khoản nên cần địa chỉ của nó; còn lại đăng nhập là /oauth2/start cùng origin.
  // Biến môi trường là hằng số lúc build: thiếu cấu hình => không thể chuyển sang Auth (fail-closed).
  const redirectUnavailable = isDevIdpLogin() && !isAuthFrontendConfigured();

  useEffect(() => {
    if (status !== "unauthenticated" || redirectUnavailable) return;
    if (hasRecentAuthRedirect()) {
      dispatch(authRedirectBlocked());
      return;
    }
    markAuthRedirect();
    redirectToAuthFrontend();
  }, [status, redirectUnavailable, dispatch]);

  if (status === "loading") return <AuthCard title="Đang kiểm tra phiên đăng nhập…" pending />;

  if (status === "error") {
    return (
      <FullScreenMessage title="Không thể xác minh phiên đăng nhập" testId="auth-error">
        <p className="text-muted mb-3">{errorMessage}</p>
        <button type="button" className="btn btn-primary" onClick={() => dispatch(authCheckRetry())}>
          Thử lại
        </button>
      </FullScreenMessage>
    );
  }

  if (status === "signed-out") {
    // Đăng xuất chủ động: handler đăng xuất tự chuyển sang /oauth2/sign_out.
    return <AuthCard title="Đang đăng xuất…" pending testId="auth-signed-out" />;
  }

  if (status === "redirect-loop") {
    return (
      <FullScreenMessage title="Chưa thiết lập được phiên đăng nhập" testId="auth-redirect-loop">
        <p className="text-muted mb-3" style={{ maxWidth: 560 }}>
          Bạn vừa được chuyển sang trang đăng nhập nhưng khi quay lại hệ thống vẫn chưa nhận được phiên. Nguyên nhân thường gặp: cookie
          đăng nhập của cổng (oauth2-proxy) không được lưu hoặc phiên bị từ chối. Hệ thống không tự chuyển trang thêm để tránh vòng
          lặp.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            clearAuthRedirectMark();
            markAuthRedirect();
            redirectToAuthFrontend();
          }}
        >
          Thử đăng nhập lại
        </button>
      </FullScreenMessage>
    );
  }

  if (status === "unauthenticated" || !user) {
    return redirectUnavailable ? (
      <FullScreenMessage title="Chưa đăng nhập" testId="auth-redirect-unavailable">
        <p className="text-muted mb-0">
          Chưa cấu hình địa chỉ Authentication_Frontend (NEXT_PUBLIC_AUTH_FRONTEND_URL) nên không thể chuyển tới trang
          đăng nhập khi chạy `next dev`.
        </p>
      </FullScreenMessage>
    ) : (
      <AuthCard title="Đang chuyển tới trang đăng nhập…" pending testId="auth-redirecting" />
    );
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasAnyRole(user.roles, allowedRoles)) {
    return (
      <FullScreenMessage title="Không có quyền truy cập" testId="auth-forbidden">
        <p className="text-muted mb-0">Tài khoản của bạn không có quyền xem trang này.</p>
      </FullScreenMessage>
    );
  }

  return <>{children}</>;
}
