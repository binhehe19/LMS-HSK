"use client";

// /hanzi/manage/select-type — HanziSelectTypePage của HSK cũ chỉ còn là `navigate('/hanzi/manage', { replace: true })` (bước chọn loại đã gộp vào
// màn quản lý). Khác bản cũ có chủ đích: giữ URL cũ hoạt động bằng một trang mỏng THẬT "chọn loại gói" (4 loại của WRITING_PACKAGE_TYPES) dẫn sang
// /hanzi/manage/create-package?type=..., kèm lối về màn quản lý; không gọi API nên không cần hook/quyền (trang tạo gói mới kiểm tra quyền).
import Link from "next/link";
import { HANZI_CREATE_PACKAGE_PATH, HANZI_MANAGE_PATH, WRITING_PACKAGE_TYPES } from "@/components/management/content-hanzi/hanzi-config";
import { ManagementPageFrame } from "@/components/management/management-page-frame";

export function HanziSelectTypePageContent() {
  return (
    <ManagementPageFrame contentClassName="manage-hanzi-page content-tree-page">
      <div className="card manage-lp-container border-0 shadow-sm" data-testid="hanzi-select-type">
        <div className="manage-lp-header px-4 pt-4 border-0">
          <div className="d-flex align-items-center gap-3 mb-3">
            <Link href={HANZI_MANAGE_PATH} prefetch={false} className="btn btn-sm btn-icon btn-light rounded-circle" aria-label="Quay lại">
              <i className="isax isax-arrow-left" />
            </Link>
            <div>
              <h5 className="section-title mb-1 fw-800">
                <i className="isax isax-edit-2 me-2 text-primary" />
                Chọn loại gói luyện viết
              </h5>
              <p className="text-muted small mb-0">Chọn loại gói để bắt đầu tạo mới</p>
            </div>
          </div>
        </div>
        <div className="card-body p-4">
          <div className="row g-3">
            {WRITING_PACKAGE_TYPES.map((type) => (
              <div key={type.value} className="col-md-6">
                <Link href={`${HANZI_CREATE_PACKAGE_PATH}?type=${encodeURIComponent(type.value)}`} prefetch={false} className="btn h-100 w-100 rounded-4 p-4 text-start border-2 transition-all content-type-card d-block" style={{ background: `${type.color}10`, borderColor: `${type.color}30`, color: type.color, minHeight: "160px" }} data-testid="hanzi-type-card" data-type={type.value}>
                  <div className="mb-3">
                    <i className={type.icon} style={{ fontSize: "32px" }} />
                  </div>
                  <h6 className="fw-700 mb-2">{type.label}</h6>
                  <p className="small mb-0" style={{ opacity: 0.8 }}>
                    {type.description}
                  </p>
                  <div className="mt-3 d-flex align-items-center">
                    <span className="small fw-600">Tạo ngay</span>
                    <i className="isax isax-arrow-right-3 ms-2" />
                  </div>
                </Link>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link href={HANZI_MANAGE_PATH} prefetch={false} className="btn btn-light rounded-pill px-4 fw-600">
              Về màn Quản lý Luyện viết
            </Link>
          </div>
        </div>
      </div>
    </ManagementPageFrame>
  );
}
