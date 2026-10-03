"use client";

// Cấp BỘ (study set) — port FlashcardStudySetList của HSK cũ (lưới card `.study-set-list-wrapper`, nút Sửa/Xóa hiện khi hover, số mục, ngày tạo).
// View thuần. Khác bản cũ có chủ đích: ô tìm + phân trang client; nút "Tạo kèm thẻ" dẫn tới trang sửa bộ (/sets/create) khi module có trang đó;
// lỗi tải là khối thông báo thay cho "Chưa có bộ học nào".
import { Pagination } from "antd";
import Link from "next/link";
import { useState } from "react";
import { GRID_PAGE_SIZE } from "@/components/management/content-tree/content-folders-view";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { filterByKeyword, formatContentDate, paginate } from "@/lib/content/content-tree-model";
import type { ContentFolder, ContentItemBase, ContentModuleConfig, ContentStudySet } from "@/types/content";

export interface ContentStudySetsViewProps<TItem extends ContentItemBase> {
  config: ContentModuleConfig<TItem>;
  folder: ContentFolder | null;
  state: FetchState<ContentStudySet[]>;
  studySets: ContentStudySet[];
  canWrite: boolean;
  busy: boolean;
  /** Đường dẫn trang tạo bộ kèm mục (có khi module khai báo setEditorRoutes). */
  createWithItemsHref: string | null;
  onOpen: (set: ContentStudySet) => void;
  onCreate: () => void;
  onEdit: (set: ContentStudySet) => void;
  onDelete: (set: ContentStudySet) => void;
  onRetry: () => void;
}

export function ContentStudySetsView<TItem extends ContentItemBase>({ config, folder, state, studySets, canWrite, busy, createWithItemsHref, onOpen, onCreate, onEdit, onDelete, onRetry }: ContentStudySetsViewProps<TItem>) {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const { labels } = config;
  const filtered = filterByKeyword(studySets, keyword, (s) => [s.title, s.description]);
  const visible = paginate(filtered, page, GRID_PAGE_SIZE);
  const notice = state.kind === "waiting" || state.kind === "error";
  const skillLabel = (value: string | undefined) => config.skills?.find((s) => s.value === value)?.label ?? value;

  return (
    <div className="study-set-list-wrapper" data-testid="content-study-sets">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h6 className="section-title mb-0 fw-700">
          <i className="isax isax-cards me-2 text-success" />
          Danh sách {labels.studySet.toLowerCase()} <span className="badge bg-light text-dark ms-2">{studySets.length}</span>
        </h6>
        {canWrite && (
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-success rounded-pill btn-sm px-4 shadow-sm fw-600" onClick={onCreate} disabled={busy || !folder}>
              <i className="isax isax-add-circle me-1" />
              Thêm {labels.studySet.toLowerCase()}
            </button>
            {createWithItemsHref && (
              <Link href={createWithItemsHref} prefetch={false} className="btn btn-outline-success rounded-pill btn-sm px-4 fw-600">
                <i className="isax isax-note-add me-1" />
                Tạo kèm {labels.item.toLowerCase()}
              </Link>
            )}
          </div>
        )}
      </div>

      {folder?.description && <p className="text-muted small mb-4">{folder.description}</p>}

      <div className="flashcard-context-search mb-4">
        <div className="input-group">
          <span className="input-group-text bg-white border-end-0 ps-3">
            <i className="isax isax-search-normal-1 text-muted" />
          </span>
          <input type="text" className="form-control border-start-0 py-2" placeholder={`Tìm ${labels.studySet.toLowerCase()} theo tên hoặc mô tả...`} value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} aria-label={`Tìm ${labels.studySet.toLowerCase()}`} />
        </div>
      </div>

      {state.kind === "loading" ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
          <p className="text-muted mt-3 mb-0">Đang tải {labels.studySet.toLowerCase()}...</p>
        </div>
      ) : notice ? (
        <FetchStateNotice state={state} waitingText={`Danh sách ${labels.studySet.toLowerCase()} chưa được kết nối API (WAITING FOR BACKEND).`} onRetry={onRetry} testId="content-study-sets-notice" />
      ) : (
        <div className="row g-4">
          {visible.map((set) => (
            <div key={set.id} className="col-md-6 col-lg-4" data-testid="content-study-set-card">
              <div className="card h-100 border-0 shadow-sm hover-up pointer position-relative group" onClick={() => onOpen(set)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onOpen(set); }}>
                {canWrite && (
                  <div className="position-absolute top-0 end-0 p-3 opacity-0 group-hover-opacity-100 transition-opacity" style={{ zIndex: 2 }}>
                    <div className="d-flex gap-2">
                      <button type="button" className="btn btn-white btn-sm shadow-sm rounded-circle p-0 d-flex align-items-center justify-content-center text-primary-hover" style={{ width: "32px", height: "32px", background: "rgba(255,255,255,0.9)", border: "none" }} onClick={(e) => { e.stopPropagation(); onEdit(set); }} title="Sửa" aria-label={`Sửa ${set.title}`} disabled={busy}>
                        <i className="isax isax-edit-2" style={{ fontSize: "16px" }} />
                      </button>
                      <button type="button" className="btn btn-white btn-sm shadow-sm rounded-circle p-0 d-flex align-items-center justify-content-center text-danger-hover" style={{ width: "32px", height: "32px", background: "rgba(255,255,255,0.9)", border: "none" }} onClick={(e) => { e.stopPropagation(); onDelete(set); }} title="Xóa" aria-label={`Xóa ${set.title}`} disabled={busy}>
                        <i className="isax isax-trash" style={{ fontSize: "16px" }} />
                      </button>
                    </div>
                  </div>
                )}
                <div className="card-body p-4">
                  <div className="d-flex align-items-start mb-3">
                    <div className="icon-box me-3 rounded-3 shadow-sm" style={{ background: "linear-gradient(135deg, #10b98120, #10b98110)", color: "#10b981", width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <i className="isax isax-book-1" style={{ fontSize: "24px" }} />
                    </div>
                    <div className="flex-grow-1">
                      <h6 className="card-title mb-1 fw-700">{set.title || labels.studySet}</h6>
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className="badge bg-light text-success small">{labels.studySet}</span>
                        {set.skill && <span className="badge bg-primary-subtle text-primary small">{skillLabel(set.skill)}</span>}
                        {set.isPrivate && (
                          <span className="badge small bg-secondary">
                            <i className="isax isax-lock me-1" />
                            Riêng tư
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="card-text text-muted small mb-0" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "40px" }}>
                    {set.description || `${labels.studySet} học tập`}
                  </p>
                  <div className="mt-3 d-flex align-items-center justify-content-between">
                    <div className="text-muted small d-flex flex-column">
                      <span>
                        <i className="isax isax-calendar-1 me-1" />
                        {formatContentDate(set.createdAt)}
                      </span>
                      <span className="mt-1">
                        <i className="isax isax-cards me-1" />
                        {set.itemCount ?? 0} {labels.item.toLowerCase()}
                      </span>
                    </div>
                    <i className="isax isax-arrow-right-3 text-success" />
                  </div>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="col-12 text-center py-5 bg-light rounded-4" data-testid="content-study-sets-empty">
              <div className="mb-3 opacity-25">
                <i className="isax isax-book-1" style={{ fontSize: "48px", color: "#10b981" }} />
              </div>
              <h6 className="text-muted fw-600">{keyword ? `Không tìm thấy ${labels.studySet.toLowerCase()} phù hợp` : `Chưa có ${labels.studySet.toLowerCase()} nào`}</h6>
              <p className="text-muted small">{keyword ? "Thử đổi từ khóa hoặc xóa bộ lọc." : `${labels.folder} này hiện đang trống`}</p>
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
