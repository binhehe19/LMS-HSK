import type { Metadata } from "next";
import { DemoLanding } from "@/components/demo/demo-landing";

export const metadata: Metadata = { title: "Demo · LMS HSK" };

// Trang chọn tài khoản của CHẾ ĐỘ DEMO. Nằm NGOÀI nhóm (management) (không cần đăng nhập) và không phải route của HSK cũ; ở bản build thật trang chỉ
// hiện thông báo "không có demo" (xem components/demo/demo-landing.tsx).
export default function DemoPage() {
  return <DemoLanding />;
}
