"use client";

import { Alert, Input, Select, Table, Tag, type TableColumnsType } from "antd";
import { useEffect, useState } from "react";
import { CatalogPagination } from "@/components/management/content-flat/catalog-pagination";
import { CatalogRowMenu } from "@/components/management/content-flat/catalog-row-menu";
import { CatalogToolbar } from "@/components/management/content-flat/catalog-toolbar";
import styles from "@/components/management/content-flat/content-catalog.module.css";
import { DictionaryWordTypeTag } from "@/components/management/dictionary/dictionary-word-type-tag";import type { FilterNavigation } from "@/components/management/dictionary/use-dictionary";
import { VocabularyRowDetails } from "@/components/management/dictionary/vocabulary-row-details";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { FetchErrorNotice, FetchStateNotice, WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import type { ContentAccess } from "@/hooks/use-content-access";
import { DEFAULT_CATALOG_PAGE_SIZE } from "@/lib/content/catalog-page-sizes";
import { DEFAULT_DICTIONARY_FILTERS, HSK_LEVELS, WORD_TYPES, hskBadgeStyle, meaningsSummary, primaryPinyin, wordTypesOf, type DictionaryFilters } from "@/lib/dictionary/vocabulary-model";
import type { Vocabulary, VocabularyPage, VocabularyPinyin } from "@/types/dictionary";

const SEARCH_DEBOUNCE_MS = 500;

interface DictionaryRow {
  key: string;
  vocab: Vocabulary;
  pinyin?: VocabularyPinyin;
  number: number;
  rowSpan: number;
}

const sharedCell = ({ rowSpan }: DictionaryRow) => ({ rowSpan });

export interface DictionaryManageViewProps {
  filters: DictionaryFilters;
  state: FetchState<VocabularyPage>;
  page: VocabularyPage | null;
  access: ContentAccess;
  writeEnabled: boolean;
  canWrite: boolean;
  busy: boolean;
  onFiltersChange: (next: DictionaryFilters, navigation?: FilterNavigation) => void;
  onCreate: () => void;
  onImport: () => void;
  onView: (vocab: Vocabulary) => void;
  onEdit: (vocab: Vocabulary) => void;
  onDelete: (vocab: Vocabulary) => void;
  onRetry: () => void;
}

export function DictionaryManageView({ filters, state, page, access, writeEnabled, canWrite, busy, onFiltersChange, onCreate, onImport, onView, onEdit, onDelete, onRetry }: DictionaryManageViewProps) {
  // Khi quay lại bằng lịch sử trình duyệt, đọc từ khóa từ URL thay vì áp lại nội dung đang gõ.
  const [draft, setDraft] = useState<{ text: string; base: string } | null>(null);
  const keyword = draft && draft.base === filters.keySearch ? draft.text : filters.keySearch;
  const size = filters.size ?? DEFAULT_CATALOG_PAGE_SIZE;
  const [expanded, setExpanded] = useState<readonly React.Key[]>([]);

  useEffect(() => {
    if (keyword === filters.keySearch) return;
    const timer = window.setTimeout(() => onFiltersChange({ ...filters, keySearch: keyword, page: 1 }, "replace"), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [keyword, filters, onFiltersChange]);

  const change = (patch: Partial<DictionaryFilters>) => onFiltersChange({ ...filters, ...patch, page: 1 });
  const loading = state.kind === "loading";
  const loadError = state.kind === "error" ? (
    <FetchErrorNotice
      title="Không thể tải danh sách từ vựng"
      description={page
        ? "Bảng đang hiển thị kết quả từ lần tải thành công gần nhất. Hãy thử lại để cập nhật."
        : "Hãy thử tải lại danh sách với bộ lọc hiện tại."}
      onRetry={onRetry}
      testId="dictionary-notice"
    />
  ) : null;
  const readOnly = access.status !== "loading" && !access.canManage;
  const toggleDetails = (id: string) => setExpanded(keys =>
    keys.includes(id) ? keys.filter(key => key !== id) : [...keys, id]);

  const pageOffset = (page?.page ?? 0) * (page?.size || size);
  const rows: DictionaryRow[] = (page?.items ?? []).flatMap((vocab, index) => {
    const primary = primaryPinyin(vocab);
    const readings = [primary, ...(vocab.pinyins ?? []).filter(pinyin => pinyin !== primary)];
    return readings.map((pinyin, readingIndex) => ({
      // Gắn chi tiết vào dòng Pinyin cuối để các ô gộp kết thúc trước phần mở rộng.
      key: readingIndex === readings.length - 1 ? vocab.id : `${vocab.id}:${readingIndex}`,
      vocab,
      pinyin,
      number: pageOffset + index + 1,
      rowSpan: readingIndex === 0 ? readings.length : 0,
    }));
  });

  const columns: TableColumnsType<DictionaryRow> = [
    {
      title: "STT", key: "number", width: 62, align: "center", onCell: sharedCell,
      render: (_, { number }) => <span className={styles.rowNumber}>{number}</span>,
    },
    {
      title: "Hán tự", key: "hanzi", width: 125, onCell: sharedCell,
      render: (_, { vocab }) => <span lang="zh" className={`${styles.name} ${styles.selectableName}`}>{vocab.hanzi}</span>,
    },
    {
      title: "Pinyin", key: "pinyin", width: 125,
      render: (_, { pinyin }) => pinyin?.pinyin || "—",
    },
    {
      title: "Bộ thủ", key: "radical", width: 95, onCell: sharedCell,
      render: (_, { vocab }) => vocab.radical || "—",
    },
    {
      title: "Cấp độ", key: "hsk", width: 92, onCell: sharedCell,
      render: (_, { vocab }) => vocab.hskLevel ? <Tag bordered={false} style={hskBadgeStyle(vocab.hskLevel)}>HSK {vocab.hskLevel}</Tag> : "—",
    },
    {
      title: "Loại", key: "types", width: 160,
      render: (_, { vocab, pinyin, rowSpan }) => (
        <>
          {rowSpan > 0 && <div className="mb-1"><Tag>{vocab.isSingleVocab ? "Từ đơn" : "Từ ghép"}</Tag></div>}
          <div className="d-flex flex-wrap gap-1">
            {wordTypesOf({ pinyins: pinyin ? [pinyin] : [] }).map(type => <DictionaryWordTypeTag key={type} type={type} />)}
          </div>
        </>
      ),
    },
    {
      title: "Nghĩa chính", key: "meanings",
      render: (_, { pinyin }) => {
        const summary = meaningsSummary({ pinyins: pinyin ? [pinyin] : [] });
        return <span className={styles.ellipsis} title={summary}>{summary}</span>;
      },
    },
    {
      title: <span className="visually-hidden">Thao tác</span>, key: "actions", width: 64, onCell: sharedCell, align: "center", fixed: "right",
      render: (_, { vocab }) => (
        <CatalogRowMenu label={`Thao tác ${vocab.hanzi}`} items={[
          {
            key: "view",
            label: "Xem chi tiết",
            icon: <i className="isax isax-eye" aria-hidden="true" />,
            disabled: busy,
            onClick: () => onView(vocab),
          },
          canWrite ? { key: "edit", label: "Chỉnh sửa", icon: <i className="isax isax-edit-2" aria-hidden="true" />, disabled: busy, onClick: () => onEdit(vocab) } : null,
          canWrite ? { key: "delete", label: "Xóa", icon: <i className="isax isax-trash" aria-hidden="true" />, disabled: busy, danger: true, onClick: () => onDelete(vocab) } : null,
        ]} />
      ),
    },
  ];

  return (
    <ManagementPageFrame contentClassName="dictionary-manage-page">
      <div className={`${styles.catalog} p-3`} data-testid="dictionary-manage">
        {readOnly && (
          <Alert message="Chế độ Xem duy nhất" description="Bạn hiện không có Ticket được cấp cho Module này. Bạn vẫn có thể xem các nội dung nhưng không thể Thêm, Sửa hoặc Xóa." type="warning" showIcon data-testid="content-readonly-alert" />
        )}
        {access.canManage && !writeEnabled && <WriteLockedNotice what="Thêm/Sửa/Xóa từ vựng" />}
        <CatalogToolbar
          label="Bộ lọc từ điển"
          heading="Từ điển"
          icon="isax-book-1"
          description="Quản lý kho từ vựng tiếng Trung dùng chung cho các học phần."
          onReload={onRetry}
          onClearFilters={() => {
            setDraft(null);
            onFiltersChange({ ...DEFAULT_DICTIONARY_FILTERS, size: filters.size });
          }}
          loading={loading}
          actions={canWrite && (
            <>
              <button type="button" className="btn btn-light rounded-pill" disabled={busy} onClick={onCreate}>
                <i className="isax isax-add" aria-hidden="true" />Thêm từ mới
              </button>
              <button type="button" className={`btn rounded-pill ${styles.bannerRefresh}`} disabled={busy} onClick={onImport} title="Import từ Excel (chưa chuyển sang bản mới)">
                <i className="isax isax-import" aria-hidden="true" />Import từ Excel
              </button>
            </>
          )}
        >
          <Input className={styles.search} aria-label="Tìm kiếm" placeholder="Tìm Hán tự, Pinyin hoặc bộ thủ" value={keyword} onChange={event => setDraft({ text: event.target.value, base: filters.keySearch })} allowClear prefix={<i className="isax isax-search-normal-1" aria-hidden="true" />} />
          <Select className={styles.filter} popupClassName="package-select-popup" aria-label="Cấp độ HSK" placeholder="Tất cả cấp độ" allowClear value={filters.hskLevel} options={HSK_LEVELS.map(value => ({ value, label: `HSK ${value}` }))} onChange={hskLevel => change({ hskLevel })} />
          <Select className={styles.filter} popupClassName="package-select-popup" aria-label="Cấu trúc từ" placeholder="Tất cả cấu trúc" allowClear value={filters.isSingleVocab?.toString()} options={[{ value: "true", label: "Từ đơn" }, { value: "false", label: "Từ ghép" }]} onChange={value => change({ isSingleVocab: value === undefined ? undefined : value === "true" })} />
          <Select className={styles.filter} popupClassName="package-select-popup" aria-label="Loại từ" placeholder="Tất cả loại từ" showSearch optionFilterProp="label" allowClear value={filters.wordType} options={WORD_TYPES.map(value => ({ value, label: value }))} onChange={wordType => change({ wordType })} />
        </CatalogToolbar>

        {state.kind === "waiting" && (
          <FetchStateNotice state={state} waitingText="Từ điển chưa được kết nối API (WAITING FOR BACKEND)." testId="dictionary-notice" />
        )}
        {(state.kind !== "waiting" || page) && (
          <section className={styles.panel} aria-label="Danh sách từ vựng">
              {page && loadError}
              <Table
                data-testid="dictionary-table"
                className={styles.table}
                rowKey="key"
                columns={columns}
                dataSource={rows}
                onRow={({ vocab, rowSpan }) => ({
                  className: "dictionary-expandable-row",
                  tabIndex: rowSpan > 0 ? 0 : undefined,
                  "aria-expanded": expanded.includes(vocab.id),
                  onClick: event => {
                    const selection = window.getSelection();
                    if (selection && !selection.isCollapsed && event.currentTarget.contains(selection.anchorNode)) return;
                    toggleDetails(vocab.id);
                  },
                  onKeyDown: event => {
                    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
                    event.preventDefault();
                    toggleDetails(vocab.id);
                  },
                })}
                pagination={false}
                loading={loading}
                scroll={{ x: 870 }}
                locale={{ emptyText: (!page && loadError) || <span data-testid="dictionary-empty">Không tìm thấy từ vựng nào</span> }}
                expandable={{
                  showExpandColumn: false,
                  expandedRowKeys: expanded,
                  rowExpandable: ({ key, vocab }) => key === vocab.id,
                  expandedRowRender: ({ vocab }, _index, _indent, isExpanded) => isExpanded && (
                    <div className="vocabulary-inline-details p-3 bg-white">
                      <VocabularyRowDetails
                        vocab={vocab}
                        onView={onView}
                        onEdit={canWrite ? () => onEdit(vocab) : undefined}
                        busy={busy}
                      />
                    </div>
                  ),
                }}
              />
              {page && (
                <CatalogPagination
                  page={filters.page}
                  size={size}
                  total={page.totalElements}
                  onChange={(nextPage, nextSize) => onFiltersChange({ ...filters, page: nextPage, size: nextSize })}
                />
              )}
          </section>
        )}
      </div>

    </ManagementPageFrame>
  );
}
