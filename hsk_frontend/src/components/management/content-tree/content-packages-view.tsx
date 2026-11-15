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
import { filterPackages, formatContentDate, isPublished, packageSyllabusOptions, packageTypeMeta, paginate, publishStatusInfo } from "@/lib/content/content-tree-model";
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
  const [page, setPage] = useState(1);
  const [syllabusId, setSyllabusId] = useState("");
  const { labels, packageTypes } = config;
  const noun = labels.package.toLowerCase();

  // Bộ lọc giáo trình chỉ hiện khi danh sách có từ 2 nguồn trở lên; nguồn đang chọn biến mất (tải lại) thì coi như không lọc.
  const syllabusOptions = packageSyllabusOptions(packages);
  const activeSyllabusId = syllabusOptions.some((o) => o.id === syllabusId) ? syllabusId : "";
  const filtered = filterPackages(activeSyllabusId ? packages.filter((p) => p.syllabusId === activeSyllabusId) : packages, "ALL", keyword);
  const visible = paginate(filtered, page, PACKAGES_PAGE_SIZE);
  const loading = state.kind === "loading" && packages.length === 0;
  const notice = state.kind === "waiting" || state.kind === "error";

  const changeKeyword = (value: string) => {
    setKeyword(value);
    setPage(1);
  };
  const changeSyllabus = (value: string) => {
    setSyllabusId(value);
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
        {syllabusOptions.length > 1 && (
          <div className="mb-4" style={{ maxWidth: 420 }}>
            <select className="form-select rounded-3" value={activeSyllabusId} onChange={(e) => changeSyllabus(e.target.value)} aria-label="Lọc theo giáo trình" data-testid="content-packages-syllabus-filter">
              <option value="">Tất cả giáo trình ({packages.length})</option>
              {syllabusOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.count})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="row g-4">
        <div className="col-12">
          <div className="packages-list-card card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-bottom p-4">
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="card-title mb-0 fw-700">
                  <i className="isax isax-folder-2 me-2" />
                  Tất cả gói
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
                  <p className="text-muted small mb-3">{keyword || activeSyllabusId ? "Thử tìm kiếm với từ khóa hoặc giáo trình khác" : "Hãy tạo gói mới để bắt đầu"}</p>
                  {!keyword && !activeSyllabusId && canWrite && (
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
                                {pkg.syllabusName && (
                                  <span data-testid="content-package-syllabus">
                                    <i className="isax isax-book-saved me-1" />
                                    {pkg.syllabusName}
                                    <span className="mx-2">·</span>
                                  </span>
                                )}
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
      </div>
    </div>
  );
}
