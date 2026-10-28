"use client";

// /pronunciation/manage/select-type — PronunciationSelectTypePage của HSK cũ là `<Navigate to="/pronunciation/manage" replace />` (bước chọn loại đã gộp
// vào màn quản lý). Giữ URL cũ hoạt động: chuyển hướng thay thế ngay khi gắn, kèm liên kết dự phòng nếu trình duyệt chặn điều hướng.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PRONUNCIATION_MANAGE_PATH } from "@/components/management/content-pronunciation/pronunciation-config";
import { ManagementPageFrame } from "@/components/management/management-page-frame";

export function PronunciationSelectTypePageContent() {
  const router = useRouter();

  useEffect(() => {
    router.replace(PRONUNCIATION_MANAGE_PATH);
  }, [router]);

  return (
    <ManagementPageFrame contentClassName="manage-pronunciation-page content-tree-page">
      <div className="alert alert-light border d-flex flex-wrap align-items-center justify-content-between gap-2 mb-0" role="status" data-testid="pronunciation-select-type-redirect">
        <span>
          <span className="spinner-border spinner-border-sm text-primary me-2" aria-hidden />
          Đang chuyển tới màn Quản lý Phát âm (chọn loại gói ngay trong màn quản lý)...
        </span>
        <Link href={PRONUNCIATION_MANAGE_PATH} prefetch={false} className="btn btn-sm btn-outline-primary rounded-pill px-3">
          Mở Quản lý Phát âm
        </Link>
      </div>
    </ManagementPageFrame>
  );
}
