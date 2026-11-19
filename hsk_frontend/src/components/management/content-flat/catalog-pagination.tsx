"use client";

import { Pagination, Select } from "antd";
import { CATALOG_PAGE_SIZES } from "@/lib/content/catalog-page-sizes";
import styles from "./content-catalog.module.css";

const pageSizes = CATALOG_PAGE_SIZES.map(value => ({ value, label: `${value} / trang` }));

export function CatalogPagination({ page, size, total, onChange, showQuickJumper = true }: {
  page: number; size: number; total: number; onChange: (page: number, size: number) => void; showQuickJumper?: boolean;
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
          showQuickJumper={showQuickJumper && total > size * 5}
          locale={{ jump_to: "Đến trang", page: "", prev_page: "Trang trước", next_page: "Trang sau" }}
          onChange={next => onChange(next, size)}
        />
      </div>
    </div>
  );
}
