import type { ReactNode } from "react";

/**
 * Tiêu đề trang chuẩn của các màn quản lý — port của LMS_Frontend/src/core/common/page-header/page-header.tsx (cùng DOM/class; CSS ở page-header.scss,
 * nạp qua styles/page-styles.ts). Đặt trong `.card` làm `card-header`. `icon` là class iconsax đầy đủ hoặc chỉ phần `isax-...` như bản cũ.
 */
export function PageHeader({ icon, title, subtitle, actions }: { icon: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="card-header bg-white border-bottom page-header-standard">
      <div className="d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-3">
          <div className="page-header-icon">
            <i className={icon.startsWith("isax ") ? icon : `isax ${icon}`} />
          </div>
          <div>
            <h4 className="page-header-title">{title}</h4>
            {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
    </div>
  );
}
