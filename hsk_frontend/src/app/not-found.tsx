import Link from "next/link";
import { FullScreenMessage } from "@/components/auth/auth-panels";

// Trang 404 chung: URL không thuộc khu quản lý, route UNKNOWN/OUT_OF_SCOPE của HSK cũ (xem docs/ROUTE-STATUS.md), hoặc đường dẫn sai.
// Không tiết lộ route nào tồn tại; chỉ gợi ý hai điểm vào theo vai trò (route guard sẽ tự kiểm tra quyền).
export default function NotFound() {
  return (
    <FullScreenMessage title="Không tìm thấy trang" testId="not-found">
      <p className="text-muted mb-3" style={{ maxWidth: 520 }}>
        Địa chỉ này không tồn tại trong hệ thống quản lý mới, hoặc chức năng chưa được mở cho vai trò của bạn.
      </p>
      <div className="d-flex flex-wrap justify-content-center gap-2">
        <Link href="/admin/dashboard" prefetch={false} className="btn btn-outline-primary">
          Khu Quản trị
        </Link>
        <Link href="/instructor/welcome" prefetch={false} className="btn btn-primary">
          Khu Giảng viên
        </Link>
      </div>
    </FullScreenMessage>
  );
}
