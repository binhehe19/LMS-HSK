"use client";

import { Pagination, Select } from "antd";
import styles from "./content-catalog.module.css";

export const DEFAULT_CATALOG_PAGE_SIZE = 20;
const pageSizes = [DEFAULT_CATALOG_PAGE_SIZE, 50, 100].map(value => ({ value, label: `${value} / trang` }));

export function CatalogPagination({ page, size, total, onChange }: {
  page: number; size: number; total: number; onChange: (page: number, size: number) => void;
}) {
  return (
    <div className={styles.footer}>
      <Select
        aria-label="Số dòng mỗi trang"
        value={size}
        options={pageSizes}
        onChange={nextSize => onChange(1, nextSize)}
      />
      <div className={styles.pageNavigation}>
        <span>{total} bản ghi</span>
        <Pagination
          size="small"
          current={page}
          pageSize={size}
          total={total}
          showSizeChanger={false}
          showQuickJumper={total > size * 5}
          locale={{ jump_to: "Đến trang", page: "", prev_page: "Trang trước", next_page: "Trang sau" }}
          onChange={next => onChange(next, size)}
        />
      </div>
    </div>
  );
}
