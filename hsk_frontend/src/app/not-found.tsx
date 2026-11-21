import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-panels";

export default function NotFound() {
  return (
    <AuthCard title="Không tìm thấy trang" testId="not-found">
      <p className="text-muted mb-4">
        Địa chỉ có thể đã thay đổi hoặc trang hiện không khả dụng.
      </p>
      <Link href="/" className="btn btn-primary rounded-pill w-100">
        Về trang chủ
      </Link>
    </AuthCard>
  );
}
