"use client";

import { EllipsisOutlined } from "@ant-design/icons";
import { Dropdown, Table, Tag, type TableColumnsType } from "antd";
import { isPublished, paginate } from "@/lib/content/content-tree-model";
import type { ContentPackage } from "@/types/content";
import { CatalogPagination } from "./catalog-pagination";
import styles from "./content-catalog.module.css";

export interface PackageCatalogActions {
  onEdit?: (pkg: ContentPackage) => void;
  onDelete?: (pkg: ContentPackage) => void;
  onTogglePublish?: (pkg: ContentPackage) => void;
  busy: boolean;
}

export function PackageCatalogTable({ heading, packages, page, size, onPageChange, loading, syllabusName, onPreview, onEdit, onDelete, onTogglePublish, busy, loadError }: PackageCatalogActions & {
  heading: string;
  loadError?: React.ReactNode;
  packages: ContentPackage[];
  page: number;
  size: number;
  onPageChange: (page: number, size: number) => void;
  loading: boolean;
  syllabusName: (id: string) => string;
  onPreview: (pkg: ContentPackage) => void;
}) {
  const packageLabel = `học phần ${heading.toLowerCase()}`;
  const columns: TableColumnsType<ContentPackage> = [
    {
      title: "STT", key: "number", width: 62, align: "center",
      render: (_, _pkg, index) => <span className={styles.rowNumber}>{(page - 1) * size + index + 1}</span>,
    },
    {
      title: `Học phần ${heading.toLowerCase()}`, key: "name", width: 340,
      render: (_, pkg) => (
        <>
          <button type="button" className={`btn btn-link p-0 text-start ${styles.name}`} onClick={() => onPreview(pkg)}>{pkg.name || pkg.id}</button>
          <small className={styles.summary}>{pkg.syllabusId ? `Giáo trình: ${syllabusName(pkg.syllabusId)}` : "Học phần tự do"}</small>
          {pkg.description && <small className={`${styles.summary} ${styles.ellipsis}`}>{pkg.description}</small>}
        </>
      ),
    },
    { title: "Trình độ", key: "level", width: 100, render: (_, pkg) => pkg.level || "—" },
    { title: "Chủ đề", key: "topic", width: 130, render: (_, pkg) => pkg.topic || "—" },
    { title: heading, key: "resources", width: 95, align: "center", render: (_, pkg) => pkg.resourceCount ?? "—" },
    {
      title: "Phiên bản", key: "version", width: 138,
      render: (_, pkg) => isPublished(pkg)
        ? <Tag color="success">{pkg.publishedVersion != null ? `v${pkg.publishedVersion}` : "Đã xuất bản"}</Tag>
        : <Tag>Chưa xuất bản</Tag>,
    },
    { title: "Số buổi", key: "sessions", width: 90, align: "center", render: (_, pkg) => pkg.sessionCount ?? "—" },
    {
      title: <span className="visually-hidden">Thao tác</span>, key: "actions", width: 64, align: "center", fixed: "right",
      render: (_, pkg) => (
        <Dropdown trigger={["click"]} placement="bottomRight" menu={{ items: [
          { key: "view", label: "Xem chi tiết", icon: <i className="isax isax-eye" aria-hidden="true" />, onClick: () => onPreview(pkg) },
          onEdit ? { key: "edit", label: "Chỉnh sửa", disabled: busy, icon: <i className="isax isax-edit-2" aria-hidden="true" />, onClick: () => onEdit(pkg) } : null,
          onTogglePublish ? { key: "publish", label: isPublished(pkg) ? "Ngừng xuất bản" : "Xuất bản", disabled: busy, icon: <i className="isax isax-send-2" aria-hidden="true" />, onClick: () => onTogglePublish(pkg) } : null,
          onDelete ? { key: "delete", label: "Xóa", danger: true, disabled: busy, icon: <i className="isax isax-trash" aria-hidden="true" />, onClick: () => onDelete(pkg) } : null,
        ] }}>
          <button type="button" className={`btn btn-sm btn-light rounded-3 ${styles.rowMenu}`} aria-label={`Thao tác ${pkg.name || pkg.id}`} aria-haspopup="menu">
            <EllipsisOutlined aria-hidden="true" />
          </button>
        </Dropdown>
      ),
    },
  ];

  return (
    <>
      <Table
        className={styles.table}
        rowKey="id"
        columns={columns}
        dataSource={paginate(packages, page, size)}
        pagination={false}
        loading={loading}
        scroll={{ x: 1019 }}
        locale={{ emptyText: loadError ?? `Không tìm thấy ${packageLabel}` }}
      />
      {!loadError && <CatalogPagination page={page} size={size} total={packages.length} onChange={onPageChange} />}
    </>
  );
}
