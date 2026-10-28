"use client";

// Cấp THƯ MỤC — port FlashcardFolderList của HSK cũ (lưới card `.folder-list-wrapper`, icon màu, huy hiệu "Thư mục"/"Riêng tư", ngày tạo, nút Sửa/Xóa).
// View thuần. Khác bản cũ có chủ đích: thêm ô tìm theo tên/mô tả (bản cũ tính `contextSearchPlaceholder` nhưng không vẽ ô tìm) và phân trang client 9 thẻ/trang;
// lỗi tải là khối thông báo thay cho "Chưa có thư mục nào".
import { Pagination } from "antd";
import { useState } from "react";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { filterByKeyword, formatContentDate, paginate } from "@/lib/content/content-tree-model";
import type { ContentFolder, ContentItemBase, ContentModuleConfig, ContentPackage } from "@/types/content";

export const GRID_PAGE_SIZE = 9;

export interface ContentFoldersViewProps<TItem extends ContentItemBase> {
  config: ContentModuleConfig<TItem>;
  pkg: ContentPackage | null;
  state: FetchState<ContentFolder[]>;
  folders: ContentFolder[];
  canWrite: boolean;
  busy: boolean;
  onOpen: (folder: ContentFolder) => void;
  onCreate: () => void;
  onEdit: (folder: ContentFolder) => void;
  onDelete: (folder: ContentFolder) => void;
  onRetry: () => void;
}

export function ContentFoldersView<TItem extends ContentItemBase>({ config, pkg, state, folders, canWrite, busy, onOpen, onCreate, onEdit, onDelete, onRetry }: ContentFoldersViewProps<TItem>) {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const { labels } = config;
  const filtered = filterByKeyword(folders, keyword, (f) => [f.name, f.description]);
  const visible = paginate(filtered, page, GRID_PAGE_SIZE);
  const notice = state.kind === "waiting" || state.kind === "error";

  return (
    <div className="folder-list-wrapper" data-testid="content-folders">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h6 className="section-title mb-0 fw-700">
          <i className="isax isax-folder-2 me-2 text-warning" />
          Danh sách {labels.folder.toLowerCase()} <span className="badge bg-light text-dark ms-2">{folders.length}</span>
        </h6>
        {canWrite && (
          <button type="button" className="btn btn-warning rounded-pill btn-sm px-4 shadow-sm fw-600" onClick={onCreate} disabled={busy || !pkg}>
            <i className="isax isax-folder-add me-1" />
            Thêm {labels.folder.toLowerCase()}
          </button>
        )}
      </div>

      {pkg?.description && <p className="text-muted small mb-4">{pkg.description}</p>}

      <div className="flashcard-context-search mb-4">
        <div className="input-group">
          <span className="input-group-text bg-white border-end-0 ps-3">
            <i className="isax isax-search-normal-1 text-muted" />
          </span>
          <input type="text" className="form-control border-start-0 py-2" placeholder={`Tìm ${labels.folder.toLowerCase()} theo tên hoặc mô tả...`} value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} aria-label={`Tìm ${labels.folder.toLowerCase()}`} />
        </div>
      </div>

      {state.kind === "loading" ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
          <p className="text-muted mt-3 mb-0">Đang tải {labels.folder.toLowerCase()}...</p>
        </div>
      ) : notice ? (
        <FetchStateNotice state={state} waitingText={`Danh sách ${labels.folder.toLowerCase()} chưa được kết nối API (WAITING FOR BACKEND).`} onRetry={onRetry} testId="content-folders-notice" />
      ) : (
        <div className="row g-4">
          {visible.map((folder) => (
            <div key={folder.id} className="col-md-6 col-lg-4" data-testid="content-folder-card">
              <div className="card h-100 border-0 shadow-sm hover-up pointer" onClick={() => onOpen(folder)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onOpen(folder); }}>
                <div className="card-body p-4">
                  <div className="d-flex align-items-start mb-3">
                    <div className="icon-box me-3 rounded-3 shadow-sm" style={{ background: "linear-gradient(135deg, #B1001920, #B1001910)", color: "#B10019", width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <i className="isax isax-folder-2" style={{ fontSize: "24px" }} />
                    </div>
                    <div className="flex-grow-1">
                      <h6 className="card-title mb-1 fw-700">{folder.name}</h6>
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className="badge bg-light text-warning small">{labels.folder}</span>
                        {folder.isPrivate && (
                          <span className="badge small bg-secondary">
                            <i className="isax isax-lock me-1" />
                            Riêng tư
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="card-text text-muted small mb-0" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "40px" }}>
                    {folder.description || `${labels.folder} chứa các ${labels.studySet.toLowerCase()}`}
                  </p>
                  <div className="mt-3 d-flex align-items-center justify-content-between">
                    <span className="text-muted small">
                      <i className="isax isax-calendar-1 me-1" />
                      {formatContentDate(folder.createdAt)}
                      {typeof folder.studySetCount === "number" && (
                        <>
                          <span className="mx-2">·</span>
                          {folder.studySetCount} {labels.studySet.toLowerCase()}
                        </>
                      )}
                    </span>
                    <i className="isax isax-arrow-right-3 text-warning" />
                  </div>
                  {canWrite && (
                    <div className="mt-3 d-flex gap-2">
                      <button type="button" className="btn btn-outline-primary btn-sm rounded-pill flex-fill" onClick={(e) => { e.stopPropagation(); onEdit(folder); }} disabled={busy}>
                        <i className="isax isax-edit-2 me-1" />
                        Sửa
                      </button>
                      <button type="button" className="btn btn-outline-danger btn-sm rounded-pill flex-fill" onClick={(e) => { e.stopPropagation(); onDelete(folder); }} disabled={busy}>
                        <i className="isax isax-trash me-1" />
                        Xóa
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="col-12 text-center py-5 bg-light rounded-4" data-testid="content-folders-empty">
              <div className="mb-3 opacity-25">
                <i className="isax isax-folder-open" style={{ fontSize: "48px", color: "#f59e0b" }} />
              </div>
              <h6 className="text-muted fw-600">{keyword ? `Không tìm thấy ${labels.folder.toLowerCase()} phù hợp` : `Chưa có ${labels.folder.toLowerCase()} nào`}</h6>
              <p className="text-muted small">{keyword ? "Thử đổi từ khóa hoặc xóa bộ lọc." : `Bắt đầu bằng cách tạo ${labels.folder.toLowerCase()} mới`}</p>
            </div>
          )}

          {filtered.length > GRID_PAGE_SIZE && (
            <div className="col-12 d-flex justify-content-center">
              <Pagination current={page} pageSize={GRID_PAGE_SIZE} total={filtered.length} showSizeChanger={false} onChange={setPage} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
