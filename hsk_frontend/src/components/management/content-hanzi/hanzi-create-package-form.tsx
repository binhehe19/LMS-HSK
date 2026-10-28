"use client";

// Giao diện thuần của trang tạo gói luyện viết — port create-package.tsx (HanziCreatePackage) của HSK cũ: card có nút quay lại + "Tạo gói mới",
// ba trường Tên gói*/Loại gói*/Mô tả, hai nút Hủy/Tạo gói. Không gọi API; container (hanzi-create-package-page-content.tsx) xử lý submit.
// Khác bản cũ có chủ đích: loại gói là danh sách cố định 4 loại với nhãn tiếng Việt (bản cũ gọi GET /packages/types rồi hiện mã thô "LEARNING PATH").
import Link from "next/link";
import type { FormEvent } from "react";
import type { ContentPackageInput, ContentPackageTypeMeta } from "@/types/content";

export interface HanziCreatePackageFormProps {
  values: ContentPackageInput;
  types: readonly ContentPackageTypeMeta[];
  /** Không có quyền (ticket) hoặc công tắc ghi đóng: khoá toàn bộ ô nhập và nút Tạo. */
  disabled: boolean;
  submitting: boolean;
  cancelHref: string;
  onChange: (next: ContentPackageInput) => void;
  onSubmit: () => void;
}

export function HanziCreatePackageForm({ values, types, disabled, submitting, cancelHref, onChange, onSubmit }: HanziCreatePackageFormProps) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit();
  };
  const locked = disabled || submitting;

  return (
    <div className="card border-0 shadow-sm rounded-3" data-testid="hanzi-create-package">
      <div className="card-header bg-white border-bottom-0 pt-4 px-4">
        <div className="d-flex align-items-center gap-3">
          <Link href={cancelHref} prefetch={false} className="btn btn-icon btn-light btn-sm rounded-circle" aria-label="Quay lại">
            <i className="isax isax-arrow-left" />
          </Link>
          <div>
            <h4 className="fw-bold mb-1">Tạo gói mới</h4>
            <p className="text-muted mb-0 small">Điền thông tin để tạo gói luyện viết mới</p>
          </div>
        </div>
      </div>

      <div className="card-body p-4">
        <form onSubmit={submit}>
          <div className="row g-4">
            <div className="col-12">
              <label className="form-label fw-semibold" htmlFor="hanzi-package-name">
                Tên gói <span className="text-danger">*</span>
              </label>
              <input id="hanzi-package-name" type="text" className="form-control form-control-lg bg-light border-0" placeholder="VD: HSK 1 Luyện viết cơ bản" value={values.name} onChange={(e) => onChange({ ...values, name: e.target.value })} disabled={locked} />
            </div>

            <div className="col-12">
              <label className="form-label fw-semibold" htmlFor="hanzi-package-type">
                Loại gói <span className="text-danger">*</span>
              </label>
              <select id="hanzi-package-type" className="form-select form-select-lg bg-light border-0" value={values.type} onChange={(e) => onChange({ ...values, type: e.target.value })} disabled={locked}>
                <option value="">Chọn loại</option>
                {types.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12">
              <label className="form-label fw-semibold" htmlFor="hanzi-package-description">
                Mô tả
              </label>
              <textarea id="hanzi-package-description" className="form-control bg-light border-0" rows={4} placeholder="Học viên sẽ học được gì từ gói này?" value={values.description ?? ""} onChange={(e) => onChange({ ...values, description: e.target.value })} disabled={locked} />
            </div>
          </div>

          <div className="d-flex gap-3 mt-4 pt-3 border-top">
            <Link href={cancelHref} prefetch={false} className="btn btn-light px-4">
              Hủy
            </Link>
            <button type="submit" className="btn btn-primary px-4 d-flex align-items-center gap-2" disabled={locked} data-testid="hanzi-create-package-submit">
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm" />
                  Đang tạo...
                </>
              ) : (
                <>
                  <i className="isax isax-add-circle" />
                  Tạo gói
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
