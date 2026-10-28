"use client";

// Port của LMS_Frontend/src/core/common/data-table/index.tsx (bọc antd Table: ô tìm kiếm phía client trên mọi trường, pageSize 10,
// dòng "Hiển thị x-y trong tổng số N", cùng class CSS `.custom-table.antd-custom-table` đã có trong styles/scss). Thêm kiểu generic và `rowKey`
// (bản cũ dùng `any`); giữ nguyên DOM/class để CSS cũ áp dụng đúng.
import { Table, type TablePaginationConfig, type TableProps } from "antd";
import { useMemo, useState } from "react";

export interface DataTableProps<T extends object> {
  columns: TableProps<T>["columns"];
  dataSource: T[];
  rowKey: TableProps<T>["rowKey"];
  /** Hiện ô tìm kiếm phía client (lọc theo mọi giá trị chuỗi của bản ghi), như bản cũ. */
  search?: boolean;
  searchPlaceholder?: string;
  pagination?: boolean | TablePaginationConfig;
  loading?: boolean;
  locale?: TableProps<T>["locale"];
  onChange?: TableProps<T>["onChange"];
  scroll?: TableProps<T>["scroll"];
}

const DEFAULT_PAGINATION: TablePaginationConfig = {
  locale: { items_per_page: "" },
  nextIcon: (
    <span>
      <i className="fas fa-angle-right" />
    </span>
  ),
  prevIcon: (
    <span>
      <i className="fas fa-angle-left" />
    </span>
  ),
  pageSize: 10,
  showLessItems: false,
  showPrevNextJumpers: true,
  showTotal: (total: number, range: [number, number]) => `Hiển thị ${range[0]}-${range[1]} trong tổng số ${total}`,
};

export function DataTable<T extends object>({ columns, dataSource, rowKey, search = true, searchPlaceholder = "Search", pagination = true, loading, locale, onChange, scroll }: DataTableProps<T>) {
  // Khác bản cũ: không xoá ô tìm kiếm khi dataSource đổi (bản cũ setState trong effect; giữ từ khoá khi tải lại dữ liệu tự nhiên hơn).
  const [searchText, setSearchText] = useState("");

  const filtered = useMemo(() => {
    const value = searchText.trim().toLowerCase();
    if (!value) return dataSource;
    return dataSource.filter((record) => Object.values(record as Record<string, unknown>).some((field) => String(field ?? "").toLowerCase().includes(value)));
  }, [dataSource, searchText]);

  const tablePagination = pagination ? { ...DEFAULT_PAGINATION, ...(typeof pagination === "object" ? pagination : {}) } : false;

  return (
    <div className="custom-table antd-custom-table">
      {search && (
        <div className="table-search">
          <div className="input-icon mb-3">
            <span className="input-icon-addon">
              <i className="isax isax-search-normal-14" />
            </span>
            <input type="search" className="form-control form-control-md mb-3 w-auto float-end" value={searchText} placeholder={searchPlaceholder} onChange={(e) => setSearchText(e.target.value)} aria-label="Tìm kiếm trong bảng" />
          </div>
        </div>
      )}
      <Table<T> className="table datanew dataTable no-footer" columns={columns} rowKey={rowKey} rowHoverable={false} dataSource={filtered} pagination={tablePagination} loading={loading} locale={locale} onChange={onChange} scroll={scroll} />
    </div>
  );
}
