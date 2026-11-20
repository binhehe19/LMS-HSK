"use client";

import type { TableProps } from "antd";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { DataTable } from "@/components/shared/data-table";
import { FetchErrorNotice, FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { displayText, formatSyllabusDate, syllabusTitle } from "@/lib/syllabus/syllabus-model";
import type { SyllabusSummaryResponse } from "@/types/lms";

interface SyllabusListTableProps {
  state: FetchState<SyllabusSummaryResponse[]>;
  keyword: string;
  /** Đã lọc theo từ khoá (filterSyllabuses). */
  filtered: SyllabusSummaryResponse[];
  onKeywordChange: (keyword: string) => void;
  onOpen: (syllabusId: string) => void;
  onRetry: () => void;
}

/** Bảng danh sách giáo trình (chế độ danh sách của màn Quản lý Syllabus) — thay dropdown "Syllabus" trong toolbar của bản cũ. */
export function SyllabusListTable({ state, keyword, filtered, onKeywordChange, onOpen, onRetry }: SyllabusListTableProps) {
  const columns: TableProps<SyllabusSummaryResponse>["columns"] = [
    {
      title: "Tên giáo trình",
      dataIndex: "name",
      key: "name",
      render: (_value, s) => (
        <button type="button" className="btn btn-link p-0 text-start fw-semibold syllabus-name-link" onClick={() => onOpen(s.id)}>
          {syllabusTitle(s)}
        </button>
      ),
    },
    { title: "Mã", dataIndex: "code", key: "code", render: (value: unknown) => displayText(value) },
    { title: "Cấp độ", dataIndex: "educationLevelName", key: "level", render: (value: unknown) => displayText(value) },
    { title: "Loại", dataIndex: "type", key: "type", render: (value: unknown) => displayText(value) },
    { title: "Tác giả", dataIndex: "author", key: "author", render: (value: unknown) => displayText(value) },
    { title: "Phiên bản mới nhất", dataIndex: "latestVersionNo", key: "version", align: "center", render: (value: unknown) => displayText(value) },
    { title: "Ngày tạo", dataIndex: "createdAt", key: "createdAt", render: (value: string | undefined) => formatSyllabusDate(value) },
    {
      title: "Thao tác",
      key: "actions",
      align: "center",
      render: (_value, s) => (
        <button type="button" className="btn btn-sm btn-outline-primary rounded-pill px-3" onClick={() => onOpen(s.id)} aria-label={`Xem chi tiết ${syllabusTitle(s)}`}>
          <i className="isax isax-eye me-1" />
          Xem chi tiết
        </button>
      ),
    },
  ];

  const notice = state.kind === "waiting";

  return (
    <>
      <div className="toolbar px-4 py-3 border-bottom bg-light">
        <div className="d-flex flex-wrap align-items-end gap-3">
          <div className="syllabus-selector">
            <label className="form-label mb-1 text-muted small" htmlFor="syllabus-search">
              Tìm giáo trình
            </label>
            <input id="syllabus-search" className="form-control form-control-sm" placeholder="Tên, mã, cấp độ, loại, tác giả" value={keyword} onChange={(e) => onKeywordChange(e.target.value)} />
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3" onClick={onRetry} disabled={state.kind === "loading"}>
            <i className="isax isax-arrow-2 me-1" />
            Tải lại
          </button>
        </div>
      </div>

      <div className="content-wrapper">
        {notice ? (
          <div className="p-3">
            <FetchStateNotice state={state} waitingText="Danh sách giáo trình chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị." onRetry={onRetry} testId="syllabus-notice" />
          </div>
        ) : (
          <div className="p-3 p-lg-4" data-testid="syllabus-list">
            <DataTable<SyllabusSummaryResponse>
              columns={columns}
              dataSource={state.kind === "error" ? [] : filtered}
              rowKey="id"
              search={false}
              loading={state.kind === "loading"}
              locale={{ emptyText: state.kind === "error"
                ? <FetchErrorNotice title="Không thể tải danh sách giáo trình" description={state.message} onRetry={onRetry} testId="syllabus-notice" />
                : keyword.trim() ? "Không tìm thấy giáo trình phù hợp" : "Chưa có syllabus" }}
            />
          </div>
        )}
      </div>
    </>
  );
}
