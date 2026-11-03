"use client";

// Màn Từ điển — port manage-vocabulary.tsx của HSK cũ: PageHeader "Danh sách từ vựng" + nút Thêm, khối bộ lọc (tìm kiếm, HSK, cấu trúc từ, loại từ,
// bộ thủ), bảng có dòng mở rộng, phân trang phía máy chủ, modal xem nét viết. View thuần: nhận state qua props, không gọi API.
//
// Khác bản cũ có chủ đích: (1) bộ lọc trong URL, ô tìm kiếm gõ xong 500ms mới áp (router.replace) như debounce cũ; (2) RadicalFilterPanel (bảng 214 bộ
// thủ) rút gọn thành ô nhập bộ thủ; (3) phân trang antd Pagination thay cho ul.pagination tự vẽ; (4) nút "Tải Template" (link Google Sheets) và
// "Import từ Excel" (bất đồng bộ, poll job) chưa chuyển — mục Import hiện toast; (5) lỗi tải/chưa cấu hình là khối trạng thái, không phải alert + Thử lại;
// (6) nút ghi ẩn khi không có quyền ticket DICTIONARY hoặc công tắc ghi đóng (WriteLockedNotice).
import { Alert, Modal, Pagination } from "antd";
import { useEffect, useState } from "react";
import { VocabularyRowDetails } from "@/components/management/dictionary/vocabulary-row-details";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { AssetImage } from "@/components/shared/asset-image";
import { FetchStateNotice, WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import { PageHeader } from "@/components/shared/page-header";
import type { ContentAccess } from "@/hooks/use-content-access";
import type { FilterNavigation } from "@/components/management/dictionary/use-dictionary";
import { DICTIONARY_PAGE_SIZE, type DictionaryFilters, HSK_LEVELS, hskBadgeClass, meaningsSummary, primaryPinyin, WORD_TYPES, wordTypeBadgeStyle, wordTypesOf } from "@/lib/dictionary/vocabulary-model";
import type { Vocabulary, VocabularyPage } from "@/types/dictionary";

const SEARCH_DEBOUNCE_MS = 500;
const TH_STYLE = { backgroundColor: "#f8fafc" } as const;
const FILTER_LABEL = "form-label fw-bold text-dark small text-uppercase";

export interface DictionaryManageViewProps {
  filters: DictionaryFilters;
  state: FetchState<VocabularyPage>;
  page: VocabularyPage | null;
  refreshing: boolean;
  access: ContentAccess;
  writeEnabled: boolean;
  canWrite: boolean;
  busy: boolean;
  onFiltersChange: (next: DictionaryFilters, navigation?: FilterNavigation) => void;
  onCreate: () => void;
  onImport: () => void;
  onEdit: (vocab: Vocabulary) => void;
  onDelete: (vocab: Vocabulary) => void;
  onRetry: () => void;
}

export function DictionaryManageView({ filters, state, page, refreshing, access, writeEnabled, canWrite, busy, onFiltersChange, onCreate, onImport, onEdit, onDelete, onRetry }: DictionaryManageViewProps) {
  // Ô tìm kiếm: giá trị đang gõ gắn với keySearch của URL lúc bắt đầu gõ; URL đổi từ nơi khác (back) => hiện lại giá trị của URL, không ghi đè.
  const [draft, setDraft] = useState<{ text: string; base: string } | null>(null);
  const keyword = draft && draft.base === filters.keySearch ? draft.text : filters.keySearch;
  useEffect(() => {
    if (keyword === filters.keySearch) return;
    const timer = window.setTimeout(() => onFiltersChange({ ...filters, keySearch: keyword, page: 1 }, "replace"), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [keyword, filters, onFiltersChange]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [strokeModal, setStrokeModal] = useState<Vocabulary | null>(null);
  const toggleRow = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const change = (patch: Partial<DictionaryFilters>) => onFiltersChange({ ...filters, ...patch, page: 1 });
  const notice = state.kind === "waiting" || state.kind === "error";
  const items = page?.items ?? [];
  const readOnly = access.status !== "loading" && !access.canManage;

  return (
    <ManagementPageFrame contentClassName="manage-vocabulary-page dictionary-manage-page">
      {readOnly && (
        <div className="mb-4">
          <Alert message="Chế độ Xem duy nhất" description="Bạn hiện không có Ticket được cấp cho Module này. Bạn vẫn có thể xem các nội dung nhưng không thể Thêm, Sửa hoặc Xóa." type="warning" showIcon className="rounded-3 border-warning bg-soft-warning shadow-sm" data-testid="content-readonly-alert" />
        </div>
      )}
      {access.canManage && !writeEnabled && (
        <div className="mb-4">
          <WriteLockedNotice what="Thêm/Sửa/Xóa từ vựng" />
        </div>
      )}
      <div className="card border-0" style={{ borderRadius: "1rem", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)" }} data-testid="dictionary-manage">
        <PageHeader
          icon="isax-book-1"
          title="Danh sách từ vựng"
          subtitle="Quản lý toàn bộ kho từ vựng tiếng Trung"
          actions={
            canWrite ? (
              <div className="d-flex align-items-center gap-2">
                <button type="button" className="btn btn-primary shadow-sm px-4 rounded-3 fw-medium" style={{ height: 42, fontSize: 14 }} onClick={onCreate} disabled={busy}>
                  <i className="isax isax-add-circle me-1" /> Thêm từ mới
                </button>
                <button type="button" className="btn btn-outline-success shadow-sm px-3 rounded-3 fw-medium" style={{ height: 42, fontSize: 14 }} onClick={onImport} disabled={busy} title="Import từ Excel (chưa chuyển sang bản mới)">
                  <i className="isax isax-import me-1" /> Import từ Excel
                </button>
              </div>
            ) : undefined
          }
        />
        <div className="card-body p-4">
          <div className="bg-light p-4 mb-4" style={{ borderRadius: "0.75rem" }}>
            <div className="row g-3">
              <div className="col-lg-4">
                <label className={FILTER_LABEL} htmlFor="dictionary-search">
                  Tìm kiếm
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-white border-end-0 ps-3">
                    <i className="isax isax-search-normal-1 text-muted" />
                  </span>
                  <input id="dictionary-search" type="text" className="form-control border-start-0 py-2" placeholder="Nhập Hán tự, Pinyin, hoặc Nghĩa..." value={keyword} onChange={(e) => setDraft({ text: e.target.value, base: filters.keySearch })} />
                </div>
              </div>
              <div className="col-lg-2">
                <label className={FILTER_LABEL} htmlFor="dictionary-hsk">
                  Cấp độ HSK
                </label>
                <select id="dictionary-hsk" className="form-select py-2" value={filters.hskLevel ?? ""} onChange={(e) => change({ hskLevel: e.target.value ? Number(e.target.value) : undefined })}>
                  <option value="">Tất cả</option>
                  {HSK_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      HSK {level}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-lg-2">
                <label className={FILTER_LABEL} htmlFor="dictionary-single">
                  Cấu trúc từ
                </label>
                <select id="dictionary-single" className="form-select py-2" value={filters.isSingleVocab === undefined ? "" : String(filters.isSingleVocab)} onChange={(e) => change({ isSingleVocab: e.target.value === "" ? undefined : e.target.value === "true" })}>
                  <option value="">Tất cả</option>
                  <option value="true">Từ đơn</option>
                  <option value="false">Từ ghép</option>
                </select>
              </div>
              <div className="col-lg-2">
                <label className={FILTER_LABEL} htmlFor="dictionary-word-type">
                  Loại từ
                </label>
                <select id="dictionary-word-type" className="form-select py-2" value={filters.wordType ?? ""} onChange={(e) => change({ wordType: e.target.value || undefined })}>
                  <option value="">Tất cả</option>
                  {WORD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-lg-2">
                <label className={FILTER_LABEL} htmlFor="dictionary-radical">
                  Bộ thủ
                </label>
                <input id="dictionary-radical" type="text" className="form-control py-2" placeholder="VD: 口" maxLength={4} value={filters.radical ?? ""} onChange={(e) => change({ radical: e.target.value.trim() || undefined })} />
              </div>
            </div>
          </div>

          {state.kind === "loading" && !page ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status" />
              <p className="mt-2 text-muted">Đang tải dữ liệu...</p>
            </div>
          ) : notice && !page ? (
            <FetchStateNotice state={state} waitingText="Từ điển chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị." onRetry={onRetry} testId="dictionary-notice" />
          ) : (
            <>
              {notice && <FetchStateNotice state={state} waitingText="Từ điển chưa được kết nối API (WAITING FOR BACKEND)." onRetry={onRetry} testId="dictionary-notice" className="mb-3" />}
              <div className="table-responsive bg-white shadow-sm p-3 mb-4" style={{ borderRadius: "1rem", border: "1px solid rgba(0,0,0,0.05)", opacity: refreshing ? 0.6 : 1 }} aria-busy={refreshing}>
                <table className="table table-hover align-middle mb-0" data-testid="dictionary-table">
                  <thead className="table-light">
                    <tr className="text-uppercase small text-muted">
                      <th scope="col" className="ps-3 border-0 rounded-start" style={{ width: 40, ...TH_STYLE }} />
                      <th scope="col" className="border-0" style={TH_STYLE}>Hán tự</th>
                      <th scope="col" className="border-0" style={TH_STYLE}>Pinyin</th>
                      <th scope="col" className="border-0" style={TH_STYLE}>Cấp độ</th>
                      <th scope="col" className="border-0" style={TH_STYLE}>Bộ</th>
                      <th scope="col" className="border-0" style={TH_STYLE}>Số nét</th>
                      <th scope="col" className="border-0" style={TH_STYLE}>Nét bút</th>
                      <th scope="col" className="border-0" style={TH_STYLE}>Loại</th>
                      <th scope="col" className="border-0" style={TH_STYLE}>Nghĩa chính</th>
                      <th scope="col" className="text-end pe-3 border-0 rounded-end" style={TH_STYLE}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="border-top-0">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-5 text-muted bg-white" data-testid="dictionary-empty">
                          <div className="mb-3">
                            <i className="isax isax-search-status fs-1" style={{ opacity: 0.15 }} />
                          </div>
                          <div className="fw-500 mb-1">Không tìm thấy từ vựng nào</div>
                          <p className="small mb-0 opacity-75">Thử điều chỉnh lại bộ lọc hoặc từ khóa tìm kiếm</p>
                        </td>
                      </tr>
                    ) : (
                      items.map((vocab) => {
                        const isExpanded = expanded.has(vocab.id);
                        const types = wordTypesOf(vocab);
                        const summary = meaningsSummary(vocab);
                        return [
                          <tr key={vocab.id} onClick={() => toggleRow(vocab.id)} style={{ cursor: "pointer", transition: "all 0.2s" }} className={isExpanded ? "bg-light" : "hover-up"} data-testid="dictionary-row" aria-expanded={isExpanded}>
                            <td className="ps-4">
                              <div className={`d-flex align-items-center justify-content-center rounded-circle ${isExpanded ? "bg-primary text-white" : "bg-light text-muted"}`} style={{ width: 28, height: 28 }}>
                                <i className={`isax isax-arrow-${isExpanded ? "down" : "right"}-1`} style={{ fontSize: 14 }} />
                              </div>
                            </td>
                            <td>
                              <span className="fw-700 text-dark" style={{ fontSize: 16 }}>
                                {vocab.hanzi}
                              </span>
                            </td>
                            <td>
                              <span className="fw-500" style={{ color: "#e53e3e" }}>
                                {primaryPinyin(vocab)?.pinyin ?? "---"}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${hskBadgeClass(vocab.hskLevel)} px-3 py-2 border`} style={{ fontSize: 12, borderRadius: 8 }}>
                                HSK {vocab.hskLevel ?? "?"}
                              </span>
                            </td>
                            <td>
                              <span className="text-muted" style={{ fontSize: 14 }}>
                                {vocab.radical || "---"}
                              </span>
                            </td>
                            <td>
                              <span className="text-muted" style={{ fontSize: 14 }}>
                                {vocab.strokeCount || "---"}
                              </span>
                            </td>
                            <td>
                              <span className="text-muted" style={{ fontSize: 14 }}>
                                {vocab.strokes || "---"}
                              </span>
                            </td>
                            <td>
                              {types.length > 0 ? (
                                <div className="d-flex flex-wrap gap-1">
                                  {types.map((type) => {
                                    const style = wordTypeBadgeStyle(type);
                                    return (
                                      <span key={type} className="badge" style={{ backgroundColor: style.bg, color: style.color, border: style.border, padding: "4px 10px", borderRadius: 8, fontWeight: 600, fontSize: 12 }}>
                                        {type}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-muted small">---</span>
                              )}
                              <div className="small text-muted mt-1" style={{ fontSize: "0.75rem" }}>
                                {vocab.isSingleVocab ? "Từ đơn" : "Từ ghép"}
                              </div>
                            </td>
                            <td className="text-muted text-truncate" style={{ maxWidth: 200, fontSize: 14 }} title={summary}>
                              {summary}
                            </td>
                            <td className="text-end pe-4">
                              {canWrite && (
                                <>
                                  <button type="button" className="btn btn-sm btn-light text-primary me-2 shadow-sm border-0 rounded-circle" style={{ width: 32, height: 32 }} title="Chỉnh sửa" aria-label={`Chỉnh sửa ${vocab.hanzi}`} disabled={busy} onClick={(e) => { e.stopPropagation(); onEdit(vocab); }}>
                                    <i className="isax isax-edit-2" />
                                  </button>
                                  <button type="button" className="btn btn-sm btn-light text-danger shadow-sm border-0 rounded-circle" style={{ width: 32, height: 32 }} title="Xóa" aria-label={`Xóa ${vocab.hanzi}`} disabled={busy} onClick={(e) => { e.stopPropagation(); onDelete(vocab); }}>
                                    <i className="isax isax-trash" />
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>,
                          isExpanded ? (
                            <tr key={`${vocab.id}-details`} className="bg-light">
                              <td colSpan={10} className="p-0 border-0">
                                <VocabularyRowDetails vocab={vocab} onShowStrokes={setStrokeModal} />
                              </td>
                            </tr>
                          ) : null,
                        ];
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {page && page.totalElements > 0 && (
                <div className="d-flex justify-content-between align-items-center mt-4 pt-3 border-top flex-wrap gap-2" data-testid="dictionary-pagination">
                  <small className="text-muted">
                    Hiển thị {page.page * page.size + 1}-{Math.min((page.page + 1) * page.size, page.totalElements)} / {page.totalElements} từ vựng
                  </small>
                  {page.totalPages > 1 && <Pagination current={filters.page} pageSize={page.size || DICTIONARY_PAGE_SIZE} total={page.totalElements} showSizeChanger={false} onChange={(next) => onFiltersChange({ ...filters, page: next })} />}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal open={strokeModal !== null} onCancel={() => setStrokeModal(null)} footer={null} centered width={400} title={strokeModal ? `Cách viết từ: ${strokeModal.hanzi}` : ""}>
        {strokeModal?.strokeAnimationUrl && (
          <div className="text-center">
            <div className="bg-light p-3 rounded-4 d-flex align-items-center justify-content-center" style={{ minHeight: 220 }}>
              <AssetImage src={strokeModal.strokeAnimationUrl} alt="Ảnh động nét viết" className="img-fluid rounded" style={{ maxHeight: 200, width: "auto" }} />
            </div>
            <p className="text-muted small mt-4 mb-0">Ảnh động hiển thị quy trình viết các nét của Hán tự.</p>
          </div>
        )}
      </Modal>
    </ManagementPageFrame>
  );
}
