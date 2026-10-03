"use client";

// Breadcrumb "Packages › gói › thư mục › bộ" — cùng DOM/class với manage-flashcard.tsx cũ (nav[aria-label=breadcrumb] > ol.breadcrumb > li.breadcrumb-item).
// Khác bản cũ có chủ đích: mục bấm được là <button> (bản cũ <a href="#"> + preventDefault) để không đổi URL hash và đọc được bằng bàn phím.
import type { BreadcrumbCrumb } from "@/lib/content/content-tree-model";
import type { ContentTreeLocation } from "@/lib/content/content-tree-params";

export function ContentTreeBreadcrumb({ crumbs, onNavigate }: { crumbs: BreadcrumbCrumb[]; onNavigate: (location: ContentTreeLocation) => void }) {
  return (
    <nav aria-label="breadcrumb">
      <ol className="breadcrumb mb-0" data-testid="content-breadcrumb">
        {crumbs.map((crumb) => (
          <li key={crumb.key} className={`breadcrumb-item ${crumb.active ? "active" : ""}`} aria-current={crumb.active ? "page" : undefined}>
            {crumb.active ? (
              <>
                <i className={`isax ${crumb.icon} me-1`} /> {crumb.label}
              </>
            ) : (
              <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => onNavigate(crumb.location)}>
                <i className={`isax ${crumb.icon} me-1`} /> {crumb.label}
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
