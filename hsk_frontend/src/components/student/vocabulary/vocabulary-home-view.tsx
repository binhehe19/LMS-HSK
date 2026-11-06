"use client";

// Giao diện màn Từ điển học viên (/vocabulary) — chuyển từ HSK cũ features/learning-path/vocabulary/home/vocabulary-home.tsx, giữ nguyên bố cục:
// banner xanh, ô tra cứu (nút "ZH" vẫn chỉ là nhãn như bản cũ), 2 panel lọc, lưới thẻ, phân trang tròn.
// Khác bản cũ có chủ đích: lỗi/chưa cấu hình API có trạng thái riêng (+ "Thử lại") thay vì rơi vào "Không tìm thấy từ vựng"; thẻ là liên kết thật (mở tab mới được).
import Link from "next/link";
import type { FormEvent } from "react";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { getWordTypeBadgeStyle } from "@/lib/dictionary/word-type-style";
import { paginationSlots, vocabularyCardSummary } from "@/lib/dictionary/vocabulary-list-params";
import type { VocabularyPage } from "@/types/dictionary";
import { HskFilterPanel } from "./hsk-filter-panel";
import { RadicalFilterPanel, type RadicalFilterValue } from "./radical-filter-panel";

export interface VocabularyHomeViewProps {
  keywordDraft: string;
  onKeywordDraftChange: (value: string) => void;
  onSubmitSearch: () => void;
  hskLevel?: number;
  levels: readonly number[];
  onHskChange: (hsk: number | undefined) => void;
  radicalFilter: RadicalFilterValue;
  onRadicalFilterChange: (next: RadicalFilterValue) => void;
  state: FetchState<VocabularyPage>;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}

const CIRCLE = { width: "40px", height: "40px", backgroundColor: "#fff", color: "#6c757d", transition: "all 0.3s ease" } as const;

export function VocabularyHomeView(props: VocabularyHomeViewProps) {
  const { state } = props;
  const page = state.kind === "ok" ? state.data : null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    props.onSubmitSearch();
  };

  return (
    <div className="content vocabulary-home hsk-vocab-home">
      <div className="container">
        <div className="module-header-banner position-relative overflow-hidden rounded-4 mb-4 p-4 shadow-sm d-flex align-items-center" style={{ backgroundColor: "#10b981", minHeight: "200px" }}>
          <div className="position-absolute" aria-hidden="true" style={{ top: "-30%", right: "-10%", width: "60%", height: "160%", background: "rgba(255,255,255,0.1)", borderRadius: "40% 60% 70% 30% / 40% 50% 60% 50%", transform: "rotate(-15deg)" }} />
          <div className="position-absolute" aria-hidden="true" style={{ bottom: "-50%", left: "-10%", width: "50%", height: "150%", background: "rgba(255,255,255,0.05)", borderRadius: "60% 40% 30% 70% / 50% 60% 40% 50%", transform: "rotate(10deg)" }} />
          <div className="position-relative z-1 d-flex align-items-center justify-content-between w-100">
            <div className="flex-grow-1 pe-4">
              <h1 className="h2 fw-900 text-white mb-2" style={{ letterSpacing: "-0.5px" }}>
                Từ vựng
              </h1>
              <p className="text-white opacity-75 mb-0" style={{ maxWidth: "400px", fontSize: "15px", lineHeight: "1.5" }}>
                Tra cứu và học từ vựng tiếng Trung với kho tàng phong phú.
              </p>
            </div>
            <div className="icon-circle-box d-none d-sm-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style={{ width: "80px", height: "80px", backgroundColor: "rgba(255,255,255,0.2)" }}>
              <i className="isax isax-book-1 text-white" style={{ fontSize: "40px" }} aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="search-strip mb-4">
          <form className="position-relative w-100 d-flex" role="search" onSubmit={submit}>
            <i className="isax isax-search-normal-1 position-absolute top-50 translate-middle-y text-muted" style={{ left: "16px", fontSize: "20px" }} aria-hidden="true" />
            <input
              type="search"
              className="form-control rounded-pill border-0 shadow-sm bg-white"
              style={{ paddingLeft: "44px", paddingRight: "80px", height: "48px", fontSize: "15px" }}
              placeholder="Tra cứu bằng tiếng Trung, Pinyin hoặc nghĩa tiếng Việt..."
              aria-label="Tra cứu từ vựng"
              maxLength={100}
              value={props.keywordDraft}
              onChange={(e) => props.onKeywordDraftChange(e.target.value)}
            />
            <button type="button" tabIndex={-1} aria-hidden="true" className="btn btn-primary bg-primary-gradient rounded-pill position-absolute px-3 fw-medium" style={{ right: "4px", top: "4px", bottom: "4px", border: "none" }}>
              ZH
            </button>
          </form>
        </div>

        <div className="mb-4">
          <HskFilterPanel selectedHsk={props.hskLevel} levels={props.levels} onHskChange={props.onHskChange} />
        </div>
        <div className="mb-4">
          <RadicalFilterPanel value={props.radicalFilter} onChange={props.onRadicalFilterChange} />
        </div>

        {state.kind === "loading" && (
          <div className="text-center py-5" role="status">
            <div className="spinner-border text-primary" aria-hidden="true" />
            <p className="mt-3 text-muted">Đang tải...</p>
          </div>
        )}

        <FetchStateNotice state={state} waitingText="Từ điển chưa được kết nối API (WAITING FOR BACKEND)." onRetry={props.onRetry} testId="vocabulary-list-notice" className="mb-4" />

        {page && page.items.length > 0 && (
          <div className="vocabulary-list-container">
            <ul className="vocabulary-list list-unstyled mb-0" data-testid="vocabulary-list">
              {page.items.map((vocab) => {
                const card = vocabularyCardSummary(vocab);
                return (
                  <li key={vocab.id}>
                    <Link href={`/vocabulary/${encodeURIComponent(vocab.id)}`} prefetch={false} className="card vocabulary-card mb-0 h-100 text-decoration-none" data-testid="vocabulary-card">
                      <div className="card-body d-flex flex-column h-100">
                        <div className="vocab-card-header mb-3">
                          <div className="hanzi-section">
                            <span className="hanzi text-truncate d-block" style={{ maxWidth: "100%" }} lang="zh">
                              {vocab.hanzi}
                            </span>
                            <span className="pinyin text-truncate d-block" style={{ maxWidth: "100%" }}>
                              {card.pinyin}
                            </span>
                          </div>
                        </div>
                        <div className="badges mb-3">
                          {card.wordTypes.length > 0 ? (
                            <div className="d-flex flex-wrap gap-1">
                              {card.wordTypes.map((type) => {
                                const style = getWordTypeBadgeStyle(type);
                                return (
                                  <span key={type} className="badge fw-medium text-truncate" style={{ backgroundColor: style.bg, color: style.color, border: style.border, maxWidth: "100%" }}>
                                    {type}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="badge fw-medium text-truncate" style={{ backgroundColor: "#f5f5f5", color: "#9e9e9e", border: "1px solid #e0e0e0", maxWidth: "100%" }}>
                              Chưa phân loại
                            </span>
                          )}
                        </div>
                        <div className="meaning fs-14 text-dark mt-auto">{card.meaning}</div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {page.totalPages > 1 && (
              <div className="d-flex justify-content-center mt-5 mb-4">
                <nav aria-label="Phân trang từ vựng">
                  <ul className="pagination pagination-md mb-0 gap-2 flex-wrap justify-content-center">
                    <li className={`page-item ${page.page === 0 ? "disabled" : ""}`}>
                      <button type="button" className="page-link border-0 rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={CIRCLE} aria-label="Trang trước" disabled={page.page === 0} onClick={() => props.onPageChange(page.page - 1)}>
                        <i className="isax isax-arrow-left-2" aria-hidden="true" />
                      </button>
                    </li>
                    {paginationSlots(page.page, page.totalPages).map((slot) => {
                      if (slot.kind === "gap") {
                        return (
                          <li key={slot.key} className="page-item disabled d-flex align-items-center" aria-hidden="true">
                            <span className="px-1" style={{ color: "#dee2e6" }}>
                              ...
                            </span>
                          </li>
                        );
                      }
                      const isActive = page.page === slot.index;
                      return (
                        <li key={slot.index} className={`page-item ${isActive ? "active" : ""}`}>
                          <button
                            type="button"
                            className={`page-link border-0 rounded-circle d-flex align-items-center justify-content-center ${isActive ? "shadow" : "shadow-sm"}`}
                            style={{ minWidth: "40px", height: "40px", backgroundColor: isActive ? "var(--bs-primary)" : "#fff", color: isActive ? "#fff" : "#495057", fontWeight: isActive ? 700 : 500, transition: "all 0.3s ease", fontSize: "15px" }}
                            aria-current={isActive ? "page" : undefined}
                            onClick={() => props.onPageChange(slot.index)}
                          >
                            {slot.index + 1}
                          </button>
                        </li>
                      );
                    })}
                    <li className={`page-item ${page.page >= page.totalPages - 1 ? "disabled" : ""}`}>
                      <button type="button" className="page-link border-0 rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={CIRCLE} aria-label="Trang sau" disabled={page.page >= page.totalPages - 1} onClick={() => props.onPageChange(page.page + 1)}>
                        <i className="isax isax-arrow-right-3" aria-hidden="true" />
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            )}
          </div>
        )}

        {page && page.items.length === 0 && (
          <div className="empty-state" data-testid="vocabulary-empty">
            <i className="isax isax-book-1" aria-hidden="true" />
            <h2 className="h4">Không tìm thấy từ vựng</h2>
            <p>Hãy thử tìm kiếm với từ khóa khác.</p>
          </div>
        )}
      </div>
    </div>
  );
}
