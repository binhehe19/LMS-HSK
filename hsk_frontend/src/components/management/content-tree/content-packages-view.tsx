"use client";

// Cấp GÓI — port PackageTypeManager (bản flashcard, components/package-type-manager.tsx của HSK cũ): tiêu đề + nút tạo/nhập Excel, ô tìm, tab theo loại,
// danh sách gói (icon gradient, huy hiệu loại + Published/Draft, ngày tạo, nút publish/sửa/xoá) và lưới "Tạo mới" theo loại. View thuần: nhận dữ liệu
// qua props. Bản cũ bấm gói là vào thẳng cấp thư mục (panel chi tiết bên phải không bao giờ hiện trong manage-flashcard) nên không port panel đó.
//
// Khác bản cũ có chủ đích: (1) phân trang client khi > 12 gói; (2) hiệu ứng hover nút viết bằng CSS (content-tree.scss) thay cho sửa style trực tiếp
// DOM; (3) lỗi tải/chưa cấu hình là khối thông báo (bản cũ: danh sách rỗng "Không tìm thấy gói"); (4) không có liên kết "File mẫu" (tài sản Excel chưa chuyển).
import { Pagination } from "antd";
import { useState } from "react";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { countPackagesByType, filterPackages, formatContentDate, isPublished, packageTypeMeta, paginate, publishStatusInfo } from "@/lib/content/content-tree-model";
import type { ContentItemBase, ContentModuleConfig, ContentPackage } from "@/types/content";

const PACKAGES_PAGE_SIZE = 12;

export interface ContentPackagesViewProps<TItem extends ContentItemBase> {
  config: ContentModuleConfig<TItem>;
  state: FetchState<ContentPackage[]>;
  packages: ContentPackage[];
  canWrite: boolean;
  canPublish: boolean;
  busy: boolean;
  onOpen: (pkg: ContentPackage) => void;
  onCreate: (type?: string) => void;
  onEdit: (pkg: ContentPackage) => void;
  onDelete: (pkg: ContentPackage) => void;
  onTogglePublish: (pkg: ContentPackage) => void;
  onImport: () => void;
  onRetry: () => void;
}

export function ContentPackagesView<TItem extends ContentItemBase>({ config, state, packages, canWrite, canPublish, busy, onOpen, onCreate, onEdit, onDelete, onTogglePublish, onImport, onRetry }: ContentPackagesViewProps<TItem>) {
  const [keyword, setKeyword] = useState("");
  const [activeType, setActiveType] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const { labels, packageTypes } = config;
  const noun = labels.package.toLowerCase();

  const filtered = filterPackages(packages, activeType, keyword);
  const visible = paginate(filtered, page, PACKAGES_PAGE_SIZE);
  const loading = state.kind === "loading" && packages.length === 0;
  const notice = state.kind === "waiting" || state.kind === "error";
  const activeMeta = activeType === "ALL" ? null : packageTypeMeta(packageTypes, activeType);

  const changeType = (type: string) => {
    setActiveType(type);
    setPage(1);
  };
  const changeKeyword = (value: string) => {
    setKeyword(value);
    setPage(1);
  };

  return (
    <div className="package-type-manager" data-testid="content-packages">
      <div className="ptm-header mb-5">
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
          <div>
            <h5 className="mb-2 fw-700">
              <i className={`isax ${config.icon.replace(/^isax\s+/, "")} me-2 text-primary`} />
              {config.packagesHeader.title}
            </h5>
            <p className="text-muted small mb-0">{config.packagesHeader.subtitle}</p>
          </div>
          {canWrite && (
            <div className="d-flex align-items-center gap-2">
              <button type="button" className="btn btn-primary rounded-pill px-3" onClick={() => onCreate()} disabled={busy}>
                <i className="isax isax-add-circle me-1" />
                Tạo {noun}
              </button>
              {config.supportsImport && (
                <button type="button" className="btn btn-outline-primary rounded-pill px-3" onClick={onImport} disabled={busy} title="Nhập từ Excel (chưa chuyển sang bản mới)">
                  <i className="isax isax-document-upload me-1" />
                  Nhập Excel
                </button>
              )}
            </div>
          )}
        </div>

        <div className="search-bar mb-4">
          <div className="input-group shadow-sm rounded-3 overflow-hidden">
            <span className="input-group-text bg-white border-0 ps-3">
              <i className="isax isax-search-normal-1 text-primary" />
            </span>
            <input type="text" className="form-control bg-white border-0 py-2" placeholder="Tìm kiếm gói..." value={keyword} onChange={(e) => changeKeyword(e.target.value)} aria-label="Tìm kiếm gói" />
          </div>
        </div>

        <div className="type-tabs-container">
          <div className="d-flex gap-2 overflow-x-auto pb-2" style={{ scrollBehavior: "smooth" }}>
            <button type="button" className={`type-tab-btn btn rounded-pill fw-600 px-4 py-2 ${activeType === "ALL" ? "active" : ""}`} onClick={() => changeType("ALL")} style={{ background: activeType === "ALL" ? "linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)" : "#f5f5f5", color: activeType === "ALL" ? "white" : "#333", border: "none", whiteSpace: "nowrap", transition: "all 0.3s ease" }}>
              <i className="isax isax-filter me-2" />
              Tất Cả ({packages.length})
            </button>
            {packageTypes.map((type) => {
              const active = activeType === type.value;
              return (
                <button key={type.value} type="button" className={`type-tab-btn btn rounded-pill fw-600 px-4 py-2 ${active ? "active" : ""}`} onClick={() => changeType(type.value)} style={{ background: active ? type.color : "#f5f5f5", color: active ? "white" : "#333", border: `2px solid ${active ? type.color : "#e0e0e0"}`, whiteSpace: "nowrap", transition: "all 0.3s ease" }}>
                  <i className={`${type.icon} me-2`} />
                  {type.label} ({countPackagesByType(packages, type.value)})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12">
          <div className="packages-list-card card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-bottom p-4">
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="card-title mb-0 fw-700">
                  <i className="isax isax-folder-2 me-2" />
                  {activeMeta ? activeMeta.label : "Tất cả gói"}
                </h6>
                <span className="badge bg-light text-dark">{filtered.length}</span>
              </div>
            </div>

            <div className="card-body p-0">
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status" />
                  <p className="text-muted mt-3 mb-0">Đang tải danh sách gói...</p>
                </div>
              ) : notice ? (
                <div className="p-4">
                  <FetchStateNotice state={state} waitingText={`Kho nội dung ${config.title.toLowerCase()} chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị.`} onRetry={onRetry} testId="content-packages-notice" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-5 px-4" data-testid="content-packages-empty">
                  <div className="mb-3 opacity-50">
                    <i className="isax isax-search-status" style={{ fontSize: "48px", color: "#B10019" }} />
                  </div>
                  <h6 className="text-muted fw-600 mb-2">Không tìm thấy gói</h6>
                  <p className="text-muted small mb-3">{keyword ? "Thử tìm kiếm với từ khóa khác" : "Hãy tạo gói mới để bắt đầu"}</p>
                  {!keyword && canWrite && (
                    <div className="d-flex flex-wrap gap-2 justify-content-center">
                      {packageTypes.map((type) => (
                        <button key={type.value} type="button" className="btn btn-sm rounded-pill" onClick={() => onCreate(type.value)} style={{ background: `${type.color}20`, color: type.color, border: `1px solid ${type.color}` }}>
                          <i className="isax isax-add me-1" />
                          Tạo {type.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="packages-list">
                    {visible.map((pkg) => {
                      const meta = packageTypeMeta(packageTypes, pkg.type);
                      const published = isPublished(pkg);
                      const status = publishStatusInfo(pkg.publishStatus);
                      return (
                        <div key={pkg.id} className="package-item p-4 border-bottom cursor-pointer transition-all" data-testid="content-package-row" onClick={() => onOpen(pkg)} style={{ background: "white", borderLeft: "4px solid transparent", cursor: "pointer", transition: "all 0.2s ease", position: "relative" }}>
                          <div className="d-flex align-items-start gap-3">
                            <div className="package-icon rounded-3" style={{ background: meta.gradient, width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0 }}>
                              <i className={meta.icon} style={{ fontSize: "24px" }} />
                            </div>
                            <div className="flex-grow-1 min-width-0">
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <h6 className="mb-0 fw-700 text-truncate">{pkg.name}</h6>
                                <div className="d-flex align-items-center gap-2 ms-2">
                                  <span className="badge rounded-pill" style={{ background: `${meta.color}20`, color: meta.color, whiteSpace: "nowrap" }}>
                                    {meta.label}
                                  </span>
                                  <span className="badge rounded-pill" style={{ background: status.bg, color: status.color, whiteSpace: "nowrap" }} data-testid="content-package-status">
                                    {status.label}
                                  </span>
                                </div>
                              </div>
                              <p className="text-muted small mb-2" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                {pkg.description || "Không có mô tả"}
                              </p>
                              <small className="text-muted">
                                <i className="isax isax-calendar-1 me-1" />
                                {formatContentDate(pkg.createdAt)}
                                {typeof pkg.folderCount === "number" && (
                                  <>
                                    <span className="mx-2">·</span>
                                    <i className="isax isax-folder-2 me-1" />
                                    {pkg.folderCount} {labels.folder.toLowerCase()}
                                  </>
                                )}
                              </small>
                            </div>

                            {(canWrite || canPublish) && (
                              <div className="d-flex gap-2 content-package-actions" style={{ flexShrink: 0 }}>
                                {canPublish && (
                                  <button type="button" className="btn p-2 rounded-2 content-icon-btn" onClick={(e) => { e.stopPropagation(); onTogglePublish(pkg); }} disabled={busy} title={published ? "Unpublish" : "Publish"} aria-label={published ? `Unpublish ${pkg.name}` : `Publish ${pkg.name}`}>
                                    <i className={published ? "isax isax-close-circle" : "isax isax-tick-circle"} style={{ fontSize: "14px", color: published ? "#dc3545" : "#198754" }} />
                                  </button>
                                )}
                                {canWrite && (
                                  <>
                                    <button type="button" className="btn p-2 rounded-2 content-icon-btn" onClick={(e) => { e.stopPropagation(); onEdit(pkg); }} disabled={busy} title="Chỉnh sửa" aria-label={`Chỉnh sửa ${pkg.name}`}>
                                      <i className="isax isax-edit-2" style={{ fontSize: "14px" }} />
                                    </button>
                                    <button type="button" className="btn p-2 rounded-2 content-icon-btn content-icon-btn-danger" onClick={(e) => { e.stopPropagation(); onDelete(pkg); }} disabled={busy} title="Xóa" aria-label={`Xóa ${pkg.name}`}>
                                      <i className="isax isax-trash" style={{ fontSize: "14px" }} />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {filtered.length > PACKAGES_PAGE_SIZE && (
                    <div className="d-flex justify-content-center py-3 border-top">
                      <Pagination current={page} pageSize={PACKAGES_PAGE_SIZE} total={filtered.length} showSizeChanger={false} onChange={setPage} />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {canWrite && !notice && (
          <div className="col-12">
            <div className="mb-4">
              <h4 className="fw-800">{config.packagesHeader.title}</h4>
              <p className="text-muted">Chọn loại gói để bắt đầu tạo mới</p>
            </div>
            <div className="row g-3 mt-2">
              {packageTypes.map((type) => (
                <div key={type.value} className="col-md-6">
                  <button type="button" className="btn h-100 w-100 rounded-4 p-4 text-start border-2 transition-all content-type-card" onClick={() => onCreate(type.value)} style={{ background: `${type.color}10`, borderColor: `${type.color}30`, color: type.color, minHeight: "160px" }}>
                    <div className="mb-3">
                      <i className={type.icon} style={{ fontSize: "32px" }} />
                    </div>
                    <h6 className="fw-700 mb-2">{type.label}</h6>
                    <p className="small mb-0" style={{ opacity: 0.8 }}>
                      {type.description}
                    </p>
                    <div className="mt-3 d-flex align-items-center">
                      <span className="small fw-600">Tạo mới</span>
                      <i className="isax isax-arrow-right-3 ms-2" />
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
