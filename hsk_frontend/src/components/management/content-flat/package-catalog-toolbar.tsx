"use client";

import { Input, Select } from "antd";
import { useState } from "react";
import { CatalogToolbar } from "./catalog-toolbar";
import styles from "./content-catalog.module.css";

export interface PackageFilters {
  keyword: string;
  status?: string;
  syllabus?: string;
  level?: string;
}

export function PackageCatalogToolbar({ heading, icon, filters, onFilters, syllabuses, levels, onCreate, onReload, loading, busy }: {
  heading: string;
  icon: string;
  filters: PackageFilters;
  onFilters: (filters: PackageFilters) => void;
  syllabuses: { value: string; label: string; code?: string }[];
  levels: string[];
  onCreate?: () => void;
  onReload: () => void;
  loading: boolean;
  busy: boolean;
}) {
  const [syllabusOpen, setSyllabusOpen] = useState(false);
  const { keyword, status, syllabus, level } = filters;

  return (
    <CatalogToolbar
      label="Bộ lọc danh sách học phần"
      heading={heading}
      icon={icon}
      description={`Quản lý học phần ${heading.toLowerCase()} theo giáo trình và buổi học.`}
      onReload={onReload}
      onClearFilters={() => onFilters({ keyword: "" })}
      loading={loading}
      actions={onCreate && <button type="button" className={`btn btn-light rounded-pill ${styles.createButton}`} disabled={busy} onClick={onCreate}><i className="isax isax-add" aria-hidden="true" />Tạo học phần</button>}
    >
      <Input className={styles.search} aria-label="Tìm học phần" placeholder="Tìm theo tên, mã hoặc giáo trình" value={keyword} onChange={event => onFilters({ ...filters, keyword: event.target.value })} allowClear prefix={<i className="isax isax-search-normal-1" aria-hidden="true" />} />
      <Select className={styles.filter} popupClassName="package-select-popup" aria-label="Trạng thái" placeholder="Tất cả trạng thái" allowClear value={status} onChange={value => onFilters({ ...filters, status: value })} options={[{ value: "PUBLISHED", label: "Đã xuất bản" }, { value: "DRAFT", label: "Chưa xuất bản" }]} />
      <Select
        className={styles.filter}
        popupClassName="package-select-popup"
        aria-label="Giáo trình"
        placeholder={syllabusOpen ? "Tìm giáo trình…" : "Tất cả giáo trình"}
        showSearch
        allowClear
        value={syllabus}
        onDropdownVisibleChange={setSyllabusOpen}
        onChange={value => onFilters({ ...filters, syllabus: value })}
        filterOption={(query, option) => !!option && [option.label, option.code, option.value].some(text =>
          text?.toLowerCase().includes(query.trim().toLowerCase()),
        )}
        notFoundContent="Không tìm thấy giáo trình"
        options={syllabuses}
      />
      {levels.length > 0 && (
        <Select className={styles.filter} popupClassName="package-select-popup" aria-label="Trình độ" placeholder="Tất cả trình độ" allowClear value={level} onChange={value => onFilters({ ...filters, level: value })} options={levels.map(value => ({ value, label: value }))} />
      )}
    </CatalogToolbar>
  );
}
