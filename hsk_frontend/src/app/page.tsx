"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthInitializer } from "@/components/auth/auth-initializer";
import { FullScreenMessage } from "@/components/auth/auth-panels";
import { hasAnyRole, ROLES } from "@/lib/auth/roles";
import { areaForRoles } from "@/lib/management/area";
import { useAppSelector } from "@/redux/hooks";

function HomeDestination() {
  const router = useRouter();
  const { status, user } = useAppSelector((state) => state.auth);
  const roles = user?.roles;
  const area = areaForRoles(roles);
  const destination = hasAnyRole(roles, [ROLES.USER, "ROLE_STUDENT"])
    ? "/student/student-dashboard"
    : area === "admin"
      ? "/admin/dashboard"
      : area === "instructor"
        ? "/instructor/welcome"
        : null;

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  if (destination) {
    return <FullScreenMessage title="Đang chuyển trang…" />;
  }

  const title = status === "error" ? "Không thể xác minh phiên đăng nhập"
    : user ? "Tài khoản chưa có quyền truy cập LMS" : "Chưa đăng nhập";

  return (
    <FullScreenMessage title={title}>
      <a className="btn btn-primary mt-2" href="https://hoc-ba.edu.vn/">
        Về trang chủ
      </a>
    </FullScreenMessage>
  );
}

export default function HomePage() {
  return <AuthInitializer><HomeDestination /></AuthInitializer>;
}
