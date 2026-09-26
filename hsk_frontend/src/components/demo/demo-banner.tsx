"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { demoControlUrl } from "@/lib/demo/demo-mode";

/**
 * Băng-rôn nhận biết CHẾ ĐỘ DEMO (chỉ render khi bản build demo chạy trên host được phép). "Reset dữ liệu demo" gọi điểm điều khiển của máy chủ
 * giả lập qua địa chỉ Auth giả lập (/__auth/mock-reset → gateway → mock) rồi tải lại trang; ở bản build thật không có băng-rôn này.
 */
export function DemoBanner() {
  const demo = useDemoMode();
  const [busy, setBusy] = useState(false);
  if (!demo) return null;

  const reset = async () => {
    const url = demoControlUrl("mock-reset");
    if (!url || busy) return;
    setBusy(true);
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      toast.success("Đã đưa dữ liệu demo về trạng thái ban đầu. Đang tải lại…");
      window.location.reload();
    } catch {
      toast.error("Không reset được dữ liệu demo (máy chủ giả lập không phản hồi).");
      setBusy(false);
    }
  };

  return (
    <div className="demo-banner" role="status" data-testid="demo-banner">
      <span className="demo-banner-badge">XEM TRƯỚC CỤC BỘ</span>
      <span className="demo-banner-text">Đăng nhập và dữ liệu đều GIẢ LẬP trên máy này (backend chung chưa có endpoint tương ứng); bản build thật không có thanh này.</span>
      <span className="demo-banner-actions">
        <Link href="/demo" prefetch={false} className="btn btn-sm btn-outline-dark" data-testid="demo-switch-role">
          Đổi vai trò
        </Link>
        <button type="button" className="btn btn-sm btn-dark" onClick={reset} disabled={busy} data-testid="demo-reset">
          {busy ? "Đang reset…" : "Reset dữ liệu giả lập"}
        </button>
      </span>
    </div>
  );
}
