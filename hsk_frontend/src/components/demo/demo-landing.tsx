"use client";

import { useSyncExternalStore } from "react";
import { FullScreenMessage, FullScreenSpinner } from "@/components/auth/auth-panels";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { demoLoginUrl, type DemoRole } from "@/lib/demo/demo-mode";

const noopSubscribe = () => () => {};

const ROLES: { role: DemoRole; title: string; description: string; to: string }[] = [
  { role: "admin", title: "Quản trị viên (Admin)", description: "Toàn bộ khu Admin: tổng quan, lớp học, giảng viên, nội dung, thông báo, phân công…", to: "/admin/dashboard" },
  { role: "teacher", title: "Giảng viên (Teacher)", description: "Lớp được phân công, danh sách bài học, bài nộp, chấm bài, phân tích học tập…", to: "/instructor/welcome" },
  { role: "mentor", title: "Trợ giảng (Mentor)", description: "Cùng khu Giảng viên theo HSK cũ, được phân công 2 lớp của giảng viên demo.", to: "/instructor/welcome" },
  { role: "user", title: "Học viên (không có quyền quản lý)", description: "Để xem màn \"Không có quyền truy cập\" của khu quản lý.", to: "/instructor/welcome" },
];

/**
 * Trang /demo: chọn tài khoản demo. Chỉ có nghĩa ở bản build demo chạy trên host được phép (useDemoMode); ở bản thật hiện thông báo không có demo.
 * Liên kết trỏ tới trang đăng nhập GIẢ LẬP (/__auth/mock-login) — cùng luồng trình duyệt thật: Auth → cookie → quay về app.
 */
export function DemoLanding() {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const demo = useDemoMode();
  if (!mounted) return <FullScreenSpinner />;
  if (!demo) {
    return (
      <FullScreenMessage title="Bản này không có chế độ xem trước cục bộ" testId="demo-unavailable">
        <p className="text-muted mb-0" style={{ maxWidth: 520 }}>
          Chế độ xem trước với dữ liệu giả lập chỉ có ở bản build chạy bằng <code>npm run preview:local</code> trên máy cục bộ hoặc mạng nội bộ. Bản đang chạy dùng Authentication và backend đã cấu hình.
        </p>
      </FullScreenMessage>
    );
  }
  return (
    <main className="demo-landing" data-testid="demo-landing">
      <div className="demo-landing-card">
        <div className="alert alert-warning py-2 small mb-3">
          <b>XEM TRƯỚC CỤC BỘ</b> — Authentication và dữ liệu đều GIẢ LẬP, chỉ chạy trên máy này để xem trước giao diện khi backend chung chưa có endpoint. Thao tác ghi chỉ thay đổi dữ liệu giả lập.
        </div>
        <h1 className="h4 mb-1">Chọn tài khoản giả lập</h1>
        <p className="text-muted small mb-3">Sau khi chọn, bạn được đăng nhập giả lập và chuyển tới màn hình đầu tiên của vai trò đó.</p>
        <div className="demo-role-list">
          {ROLES.map((r) => {
            const href = demoLoginUrl(r.role, r.to);
            return (
              <a key={r.role} href={href ?? "#"} className="demo-role-link" data-testid={`demo-role-${r.role}`} aria-disabled={!href}>
                <b>{r.title}</b>
                <small>{r.description}</small>
              </a>
            );
          })}
        </div>
        <p className="text-muted small mt-3 mb-0">
          Dữ liệu giả lập có thể đưa về trạng thái ban đầu bằng nút &quot;Reset dữ liệu giả lập&quot; trên thanh vàng trong khu quản lý.
        </p>
      </div>
    </main>
  );
}
