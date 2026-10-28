"use client";

import { useEffect, type ReactNode } from "react";
import { subscribeSessionExpired } from "@/lib/api/auth-session";
import { getCurrentUser } from "@/lib/api/auth-client";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { isMockConfigOnRealHost, mockLikeConfigNames } from "@/lib/api/endpoint-safety";
import { clearAuthRedirectMark } from "@/lib/auth/redirect-guard";
import { isDemoBlockedOnHost } from "@/lib/demo/demo-mode";
import { consumeTokensFromUrlHash } from "@/lib/auth/token-store";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { authCheckError, authCheckFailed, signinSuccess } from "@/redux/slices/auth-slice";
import { FullScreenSpinner } from "@/components/auth/auth-panels";

/**
 * Khởi tạo phiên trước khi cho render nội dung cần bảo vệ — theo mẫu AuthInitializer của IELTS. Đặt trong layout của nhóm
 * route cần đăng nhập (KHÔNG đặt ở root). Thứ tự: (1) từ chối nếu cấu hình mock đang chạy trên host thật, (2) nhận token
 * callback ở URL hash nếu có, (3) GET /users/me (api-client tự làm mới phiên một lần khi 401).
 *
 * Phân loại kết quả (khác IELTS: IELTS coi mọi lỗi là "chưa đăng nhập"):
 *  - 401/403 từ Auth      => unauthenticated (RequireAuth chuyển sang Auth, có chống lặp)
 *  - lỗi mạng / 5xx / không làm mới được / chưa cấu hình => error (thông báo + Thử lại, KHÔNG bỏ qua kiểm tra,
 *    KHÔNG đá người dùng ra trang đăng nhập chỉ vì backend đang gián đoạn)
 * Sau khi đã xác thực, nếu một API khác bị từ chối làm mới phiên thì quay về unauthenticated.
 */
export function AuthInitializer({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.auth.status);

  useEffect(() => subscribeSessionExpired(() => dispatch(authCheckFailed())), [dispatch]);

  useEffect(() => {
    if (status !== "loading") return;
    let cancelled = false;

    if (isMockConfigOnRealHost(window.location.hostname)) {
      dispatch(
        authCheckError(
          `Cấu hình MOCK/local bị chặn trên máy chủ này (${mockLikeConfigNames().join(", ")}). Cần cấu hình Authentication thật.`,
        ),
      );
      return;
    }
    // Bản build DEMO (NEXT_PUBLIC_DEMO_MODE=1) chỉ được chạy trên host loopback/mạng riêng; ở nơi khác từ chối như cấu hình mock.
    if (isDemoBlockedOnHost(window.location.hostname)) {
      dispatch(authCheckError("Bản build DEMO chỉ chạy trên máy cục bộ hoặc mạng nội bộ; máy chủ này bị từ chối. Cần bản build thật với Authentication thật."));
      return;
    }

    consumeTokensFromUrlHash();

    getCurrentUser()
      .then((user) => {
        if (cancelled) return;
        clearAuthRedirectMark();
        dispatch(signinSuccess(user));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          dispatch(authCheckFailed());
        } else if (error instanceof ApiNotConfiguredError) {
          dispatch(authCheckError("Chưa cấu hình kết nối Authentication (NEXT_PUBLIC_AUTH_API_BASE_URL)."));
        } else if (error instanceof ApiError) {
          dispatch(authCheckError(error.message));
        } else {
          dispatch(authCheckError("Không xác minh được phiên đăng nhập."));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status, dispatch]);

  if (status === "loading") return <FullScreenSpinner />;
  return <>{children}</>;
}
