"use client";

import { useEffect } from "react";
import { LoginOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { AuthInitializer } from "@/components/auth/auth-initializer";
import { AuthCard, FullScreenMessage } from "@/components/auth/auth-panels";
import { isAuthFrontendConfigured, redirectToAuthFrontend } from "@/lib/auth/auth-redirect";
import { isDevIdpLogin } from "@/lib/auth/dev-token-session";
import { markAuthRedirect } from "@/lib/auth/redirect-guard";
import { resolveHomeDestination } from "@/lib/auth/home-destination";
import { useAppSelector } from "@/redux/hooks";

function HomeDestination() {
  const router = useRouter();
  const { status, user } = useAppSelector((state) => state.auth);
  const destination = resolveHomeDestination(status, user?.roles);

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  if (destination) {
    return <AuthCard title="Đang chuyển trang…" pending />;
  }

  if (status === "unauthenticated") {
    const loginUnavailable = isDevIdpLogin() && !isAuthFrontendConfigured();

    return (
      <AuthCard title="Chưa đăng nhập">
        <p className={loginUnavailable ? "text-muted mb-0" : "text-muted mb-4"}>
          {loginUnavailable
            ? "Môi trường này chưa cấu hình đăng nhập."
            : "Đăng nhập bằng tài khoản Học Bá để tiếp tục vào LMS."}
        </p>
        {!loginUnavailable && (
          <button
            type="button"
            className="btn btn-primary rounded-pill w-100 d-inline-flex align-items-center justify-content-center gap-2"
            onClick={() => {
              markAuthRedirect();
              redirectToAuthFrontend("/login", "/");
            }}
          >
            <LoginOutlined aria-hidden="true" />
            Đăng nhập vào LMS
          </button>
        )}
      </AuthCard>
    );
  }

  const title = status === "error" ? "Không thể xác minh phiên đăng nhập"
    : user ? "Tài khoản chưa có quyền truy cập LMS" : "Chưa đăng nhập";

  return (
    <FullScreenMessage title={title}>
      <a className="btn btn-primary mt-2" href="https://hoc-ba.edu.vn/">
        Trang chủ Học Bá
      </a>
    </FullScreenMessage>
  );
}

export default function HomePage() {
  return <AuthInitializer><HomeDestination /></AuthInitializer>;
}
