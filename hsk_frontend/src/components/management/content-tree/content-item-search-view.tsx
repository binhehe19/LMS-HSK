"use client";

// Tab tìm mục toàn cây — port VocabularyManager của HSK cũ (tiêu đề + huy hiệu tổng, ô tìm, bảng Từ vựng/Nghĩa/Vị trí/Thao tác, phân trang Trước/Sau).
// View thuần; cột nội dung lấy từ ContentModuleConfig.itemColumns, cột "Vị trí" vẽ chuỗi gói › thư mục › bộ (CardLocationDisplay cũ).
// Khác bản cũ có chủ đích: lỗi/chưa cấu hình là khối thông báo có "Thử lại"; nút sửa chỉ hiện khi có quyền ghi (bản cũ mở modal chỉ đọc).
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import type { ContentItemBase, ContentItemWithContext, ContentModuleConfig, ContentPage } from "@/types/content";

export interface ContentItemSearchViewProps<TItem extends ContentItemBase> {
  config: ContentModuleConfig<TItem>;
  term: string;
  state: FetchState<ContentPage<ContentItemWithContext<TItem>>>;
  /** Kết quả đang hiển thị (trang hiện tại hoặc trang trước đó trong lúc tải). */
  result: ContentPage<ContentItemWithContext<TItem>> | null;
  canWrite: boolean;
  busy: boolean;
  onTermChange: (term: string) => void;
  onPageChange: (page: number) => void;
  onEdit: (item: ContentItemWithContext<TItem>) => void;
  onRetry: () => void;
}

export function ContentItemSearchView<TItem extends ContentItemBase>({ config, term, state, result, canWrite, busy, onTermChange, onPageChange, onEdit, onRetry }: ContentItemSearchViewProps<TItem>) {
  const tab = config.itemSearchTab;
  const noun = config.labels.item.toLowerCase();
  const items = result?.items ?? [];
  const totalElements = result?.totalElements ?? 0;
  const totalPages = result?.totalPages ?? 0;
  const currentPage = result?.page ?? 0;
  const loading = state.kind === "loading";
  const notice = state.kind === "waiting" || state.kind === "error";

  return (
    <div className="flashcard-vocabulary-manager" data-testid="content-item-search">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h4 className="fw-800 mb-1">{tab?.title}</h4>
          <p className="text-muted mb-0 small">{tab?.subtitle}</p>
        </div>
        <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 fw-700">
          {totalElements} {noun}
        </span>
      </div>

      <div className="bg-light p-3 mb-4 rounded-4">
        <div className="input-group">
          <span className="input-group-text bg-white border-end-0">
            <i className="isax isax-search-normal-1 text-muted" />
          </span>
          <input type="text" className="form-control border-start-0 py-2" placeholder={tab?.placeholder} value={term} onChange={(e) => onTermChange(e.target.value)} aria-label={tab?.placeholder ?? `Tìm ${noun}`} />
        </div>
      </div>

      {loading && !result ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
          <p className="text-muted mt-3 mb-0">Đang tải danh sách {noun}...</p>
        </div>
      ) : notice ? (
        <FetchStateNotice state={state} waitingText={`Tìm ${noun} toàn cây chưa được kết nối API (WAITING FOR BACKEND).`} onRetry={onRetry} testId="content-item-search-notice" />
      ) : items.length === 0 ? (
        <div className="text-center py-5 bg-white rounded-4 border" data-testid="content-item-search-empty">
          <i className="isax isax-search-normal-1 d-block mb-3 text-muted" style={{ fontSize: "64px", opacity: 0.15 }} />
          <h5 className="fw-800 text-dark mb-2">Không tìm thấy {noun}</h5>
          <p className="text-muted mb-0">{term ? "Thử tìm với từ khóa khác" : `Chưa có ${noun} nào trong kho`}</p>
        </div>
      ) : (
        <>
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden" style={{ opacity: loading ? 0.65 : 1, transition: "opacity 0.2s" }}>
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead className="bg-light">
                  <tr>
                    {config.itemColumns.map((col) => (
                      <th key={col.key} className="px-4 py-3 small text-uppercase text-muted fw-700" style={col.width ? { width: col.width } : undefined}>
                        {col.title}
                      </th>
                    ))}
                    <th className="px-4 py-3 small text-uppercase text-muted fw-700">Vị trí</th>
                    <th className="px-4 py-3 small text-uppercase text-muted fw-700 text-end">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} data-testid="content-search-row">
                      {config.itemColumns.map((col) => (
                        <td key={col.key} className="px-4 py-3">
                          {col.render(item)}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="small text-muted d-flex flex-column">
                          {item.packageName ? (
                            <>
                              <span className="fw-600 text-dark">
                                <i className="isax isax-box-1 me-1" />
                                {item.packageName}
                              </span>
                              <span>
                                <i className="isax isax-folder-2 me-1" />
                                {item.folderName ?? "—"} › {item.studySetTitle ?? "—"}
                              </span>
                            </>
                          ) : (
                            <span>Chưa thuộc gói nào</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-end">
                        {canWrite && (
                          <button type="button" className="btn btn-sm btn-light rounded-circle" style={{ width: "34px", height: "34px" }} onClick={() => onEdit(item)} disabled={busy} title="Chỉnh sửa" aria-label={`Chỉnh sửa ${config.itemSummary(item)}`}>
                            <i className="isax isax-edit text-primary" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-4">
              <span className="text-muted small">
                Trang {currentPage + 1} / {totalPages} — Tổng {totalElements} {noun}
              </span>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 0 || loading}>
                  <i className="isax isax-arrow-left-2 me-1" />
                  Trước
                </button>
                <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages - 1 || loading}>
                  Sau
                  <i className="isax isax-arrow-right-3 ms-1" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
