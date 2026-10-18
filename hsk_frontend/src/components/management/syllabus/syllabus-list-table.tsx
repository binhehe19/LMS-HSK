"use client";

import { Input, Table, type TableColumnsType } from "antd";
import { useState, type ReactNode } from "react";
import { CatalogPagination } from "@/components/management/content-flat/catalog-pagination";
import { CatalogRowMenu } from "@/components/management/content-flat/catalog-row-menu";
import { CatalogToolbar } from "@/components/management/content-flat/catalog-toolbar";
import styles from "@/components/management/content-flat/content-catalog.module.css";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { FetchErrorNotice, FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { DEFAULT_CATALOG_PAGE_SIZE } from "@/lib/content/catalog-page-sizes";
import { clampPage, paginate } from "@/lib/content/content-tree-model";
import { displayText, formatSyllabusDate, syllabusTitle } from "@/lib/syllabus/syllabus-model";
import type { SyllabusSummaryResponse } from "@/types/lms";

interface SyllabusListTableProps {
  state: FetchState<SyllabusSummaryResponse[]>;
  keyword: string;
  filtered: SyllabusSummaryResponse[];
  onKeywordChange: (keyword: string) => void;
  onOpen: (syllabusId: string) => void;
  onRetry: () => void;
  notice?: ReactNode;
}

export function SyllabusListTable({ state, keyword, filtered, onKeywordChange, onOpen, onRetry, notice }: SyllabusListTableProps) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(DEFAULT_CATALOG_PAGE_SIZE);
  const currentPage = clampPage(page, filtered.length, size);
  const loading = state.kind === "loading";

  const columns: TableColumnsType<SyllabusSummaryResponse> = [
    { title: "STT", key: "number", width: 62, align: "center", render: (_, _syllabus, index) => <span className={styles.rowNumber}>{(currentPage - 1) * size + index + 1}</span> },
    {
      title: "Tên giáo trình", key: "name",
      render: (_, syllabus) => (
        <button type="button" className={`btn btn-link p-0 text-start ${styles.name}`} onClick={() => onOpen(syllabus.id)}>
          {syllabusTitle(syllabus)}
        </button>
      ),
    },
    { title: "Mã", dataIndex: "code", width: 105, render: displayText },
    { title: "Cấp độ", dataIndex: "educationLevelName", width: 115, render: displayText },
    { title: "Loại", dataIndex: "type", width: 115, render: displayText },
    { title: "Tác giả", dataIndex: "author", width: 130, render: displayText },
    { title: "Phiên bản mới nhất", dataIndex: "latestVersionNo", width: 150, align: "center", render: displayText },
    { title: "Ngày tạo", dataIndex: "createdAt", width: 113, render: formatSyllabusDate },
    {
      title: <span className="visually-hidden">Thao tác</span>, key: "actions", width: 64, align: "center", fixed: "right",
      render: (_, syllabus) => (
        <CatalogRowMenu label={`Thao tác ${syllabusTitle(syllabus)}`} items={[
          { key: "view", label: "Xem chi tiết", icon: <i className="isax isax-eye" aria-hidden="true" />, onClick: () => onOpen(syllabus.id) },
        ]} />
      ),
    },
  ];

  return (
    <div className={`${styles.catalog} p-3`}>
      {notice}
      <CatalogToolbar
        label="Bộ lọc giáo trình"
        heading="Giáo trình"
        icon="isax-book-saved"
        description="Tra cứu giáo trình, phiên bản và lịch trình giảng dạy."
        onReload={onRetry}
        onClearFilters={() => { onKeywordChange(""); setPage(1); }}
        loading={loading}
      >
        <Input
          className={styles.search}
          aria-label="Tìm giáo trình"
          placeholder="Tên, mã, cấp độ, loại, tác giả"
          value={keyword}
          onChange={event => { onKeywordChange(event.target.value); setPage(1); }}
          prefix={<i className="isax isax-search-normal-1" aria-hidden="true" />}
          allowClear
        />
      </CatalogToolbar>
      <section className={styles.panel} aria-label="Danh sách giáo trình">
        {state.kind === "waiting" ? (
          <div className="p-3">
            <FetchStateNotice state={state} waitingText="Danh sách giáo trình chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị." onRetry={onRetry} testId="syllabus-notice" />
          </div>
        ) : (
          <>
            <Table
              data-testid="syllabus-list"
              className={styles.table}
              columns={columns}
              dataSource={state.kind === "error" ? [] : paginate(filtered, currentPage, size)}
              rowKey="id"
              pagination={false}
              loading={loading}
              scroll={{ x: 1040 }}
              locale={{ emptyText: state.kind === "error"
                ? <FetchErrorNotice title="Không thể tải danh sách giáo trình" description={state.message} onRetry={onRetry} testId="syllabus-notice" />
                : keyword.trim() ? "Không tìm thấy giáo trình phù hợp" : "Chưa có giáo trình" }}
            />
            {state.kind !== "error" && <CatalogPagination page={currentPage} size={size} total={filtered.length} onChange={(nextPage, nextSize) => { setPage(nextPage); setSize(nextSize); }} />}
          </>
        )}
      </section>
    </div>
  );
}
