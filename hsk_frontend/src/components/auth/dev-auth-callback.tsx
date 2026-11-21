"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthCard, FullScreenMessage } from "@/components/auth/auth-panels";
import { parseTokenHash, safeReturnTo, saveSession } from "@/lib/auth/dev-token-session";

/** Nhận token trong hash do trang tài khoản chuyển về, lưu lại, xóa hash khỏi URL rồi tải lại trang đích. */
export function DevAuthCallback() {
  const [missingToken, setMissingToken] = useState(false);

  useEffect(() => {
    const session = parseTokenHash(window.location.hash);
    const returnTo = safeReturnTo(new URLSearchParams(window.location.search).get("rd"));
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!session) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hash chỉ đọc được ở trình duyệt, sau khi mount
      setMissingToken(true);
      return;
    }
    saveSession(session);
    // Tải lại hoàn toàn để AuthInitializer hỏi /users/me với token vừa lưu.
    window.location.replace(returnTo);
  }, []);

  return missingToken ? (
    <FullScreenMessage title="Không nhận được token đăng nhập" testId="dev-auth-missing-token">
      <p className="text-muted mb-3" style={{ maxWidth: 560 }}>
        Trang tài khoản không gửi token về. Kiểm tra AUTH dev chạy profile <code>dev</code> và origin này có trong{" "}
        <code>NEXT_PUBLIC_DEV_APP_ORIGINS</code>.
      </p>
      <Link className="btn btn-primary" href="/">
        Về trang chủ
      </Link>
    </FullScreenMessage>
  ) : (
    <AuthCard title="Đang đăng nhập…" pending testId="dev-auth-signing-in" />
  );
}
