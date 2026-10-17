"use client";

// View thuần (không gọi API) của /learning-path/lesson-materials/manage, HAI CỘT: cột trái bộ tài liệu (tìm kiếm), cột phải bảng tài liệu của bộ
// đang chọn. Gắn trực tiếp vào ContentPackage/LearningResource có sẵn (xem use-lesson-materials.ts): mỗi bộ có đúng 1 loại (Slides/Tài liệu) cố định,
// trạng thái bộ = publish của package (Bản nháp/Đã xuất bản, không còn ACTIVE/ARCHIVED riêng), không còn "Chưa phân loại" hay trạng thái riêng từng
// tài liệu — mỗi tài liệu dùng nút "Xoá" (xoá thật) thay các nút vòng đời cũ.
import { Input, Table, type TableColumnsType } from "antd";
import { useState, type ReactNode } from "react";
import { CatalogPagination } from "@/components/management/content-flat/catalog-pagination";
import { CatalogRowMenu } from "@/components/management/content-flat/catalog-row-menu";
import { CatalogToolbar } from "@/components/management/content-flat/catalog-toolbar";
import styles from "@/components/management/content-flat/content-catalog.module.css";
import { FlatTopicPanel, FlatTopicSelect } from "@/components/management/content-flat/flat-topic-panel";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { MaterialSelection } from "@/components/management/lesson-materials-management/use-lesson-materials";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice, WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import { fileUrl } from "@/lib/api/storage-client";
import { DEFAULT_CATALOG_PAGE_SIZE } from "@/lib/content/catalog-page-sizes";
import { filterGroups, formatBytes, groupStatusLabel, LESSON_MATERIAL_TYPE_LABELS } from "@/lib/lesson-materials/lesson-material-model";
import type { FlatTopicUi } from "@/types/content";
import type { LessonMaterial, LessonMaterialGroup } from "@/types/lesson-materials";

export const LESSON_MATERIALS_WAITING_TEXT = "Danh sách bộ tài liệu chưa được kết nối API (WAITING FOR BACKEND).";

export interface LessonMaterialsViewProps {
  state: FetchState<LessonMaterialGroup[]>;
  groups: LessonMaterialGroup[];
  refreshing: boolean;
  writeEnabled: boolean;
  busy: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  selection: MaterialSelection;
  selectedGroup: LessonMaterialGroup | null;
  detailState: FetchState<LessonMaterial[]>;
  sessionNo: number;
  detailActions: ReactNode;
  /** Chủ đề của bộ đang chọn; không có thì không hiện khối và cột chủ đề. */
  topicUi?: FlatTopicUi;
  onSelect: (selection: MaterialSelection) => void;
  onOpenCreateGroup: () => void;
  onEditGroup: (group: LessonMaterialGroup) => void;
  onTogglePublish: (group: LessonMaterialGroup) => void;
  onRemoveGroup: (group: LessonMaterialGroup) => void;
  onOpenCreate: () => void;
  onOpenBulk: () => void;
  onRemoveMaterial: (material: LessonMaterial) => void;
  onRetry: () => void;
  onRetryDetail: () => void;
}

function MaterialsTable({ materials, topicUi, writeEnabled, busy, onRemove }: {
  materials: LessonMaterial[]; topicUi?: FlatTopicUi; writeEnabled: boolean; busy: boolean; onRemove: LessonMaterialsViewProps["onRemoveMaterial"];
}) {
  const [pagination, setPagination] = useState({ page: 1, size: DEFAULT_CATALOG_PAGE_SIZE });
  const { size } = pagination;
  const page = Math.min(pagination.page, Math.max(1, Math.ceil(materials.length / size)));
  const offset = (page - 1) * size;
  const columns: TableColumnsType<LessonMaterial> = [
    { title: "Tên tài liệu", key: "title", render: (_, material) => <span className={`lesson-material-management__material-title ${styles.name}`}>{material.title}</span> },
    {
      title: "Tệp", key: "file", width: 180,
      render: (_, material) => {
        const href = fileUrl(material.fileId);
        const filename = material.filename || "Tệp đã tải lên";
        return (
          <>
            <div className="lesson-material-management__file-name">
              {href ? <a href={href} target="_blank" rel="noreferrer noopener">{filename}</a> : filename}
            </div>
            <small className={styles.summary}>{material.mimeType || "Chờ metadata"}</small>
          </>
        );
      },
    },
    { title: "Dung lượng", key: "size", width: 110, render: (_, material) => formatBytes(material.sizeBytes) },
  ];
  if (topicUi?.topics.length) {
    columns.push({
      title: "Chủ đề", key: "topic", width: 180,
      render: (_, material) => <FlatTopicSelect ui={topicUi} itemId={material.id} canWrite={writeEnabled} busy={busy} />,
    });
  }
  columns.push({
    title: <span className="visually-hidden">Thao tác</span>, key: "actions", width: 64, fixed: "right", align: "center",
    render: (_, material) => <CatalogRowMenu label={`Thao tác ${material.title}`} items={[
      { key: "remove", label: "Xoá", danger: true, disabled: !writeEnabled || busy, onClick: () => onRemove(material) },
    ]} />,
  });
  return (
    <section className={styles.panel} aria-label="Danh sách tài liệu">
      <Table
        data-testid="lm-table"
        className={styles.table}
        rowKey="id"
        columns={columns}
        dataSource={materials.slice(offset, offset + size)}
        onRow={() => ({ className: "align-middle", "data-testid": "lm-material-row" })}
        pagination={false}
        scroll={{ x: topicUi?.topics.length ? 700 : 520 }}
      />
      <CatalogPagination page={page} size={size} total={materials.length} onChange={(page, size) => setPagination({ page, size })} showQuickJumper={false} />
    </section>
  );
}

export function LessonMaterialsView(props: LessonMaterialsViewProps) {
  const { state, groups, refreshing, writeEnabled, busy, search, selection, selectedGroup, detailState } = props;
  const loading = state.kind === "loading" || refreshing;
  const canWrite = writeEnabled && !busy;
  const filteredGroups = filterGroups(groups, search);
  const [groupPagination, setGroupPagination] = useState({ page: 1, size: DEFAULT_CATALOG_PAGE_SIZE });
  const groupSize = groupPagination.size;
  const groupPage = Math.min(groupPagination.page, Math.max(1, Math.ceil(filteredGroups.length / groupSize)));
  const groupOffset = (groupPage - 1) * groupSize;
  const changeSearch = (value: string) => {
    props.onSearchChange(value);
    setGroupPagination(current => ({ ...current, page: 1 }));
  };

  const groupColumns: TableColumnsType<LessonMaterialGroup> = [
    {
      title: "Bộ tài liệu", key: "group",
      render: (_, group) => (
        <>
          <button type="button" className={`btn btn-link p-0 text-start ${styles.name}`} aria-pressed={selection?.id === group.id} onClick={() => props.onSelect({ id: group.id })}>
            {group.name}
          </button>
          {group.description && <small className={`${styles.summary} ${styles.ellipsis}`} title={group.description}>{group.description}</small>}
          <div className="d-flex flex-wrap gap-1 mt-1">
            <span className="badge text-bg-light border">{LESSON_MATERIAL_TYPE_LABELS[group.type]}</span>
            <span className={`lesson-material-management__group-status ${group.status.toLowerCase()}`}>{groupStatusLabel(group.status)}</span>
          </div>
        </>
      ),
    },
    {
      title: <span className="visually-hidden">Thao tác</span>, key: "actions", width: 64, fixed: "right", align: "center",
      render: (_, group) => <CatalogRowMenu label={`Thao tác ${group.name}`} items={[
        { key: "edit", label: "Sửa", disabled: !canWrite, onClick: () => props.onEditGroup(group) },
        { key: "publish", label: group.status === "PUBLISHED" ? "Về nháp" : "Xuất bản", disabled: !canWrite, onClick: () => props.onTogglePublish(group) },
        { key: "remove", label: "Xoá", danger: true, disabled: !canWrite, onClick: () => props.onRemoveGroup(group) },
      ]} />,
    },
  ];

  return (
    <ManagementPageFrame contentClassName="lesson-material-management">
      <div className={`${styles.catalog} p-3`}>
        <CatalogToolbar
          label="Bộ lọc bộ tài liệu"
          heading="Quản lý tài liệu học tập"
          icon="isax-document-text"
          description="Quản lý các bộ tài liệu và slide dùng cho buổi học."
          onReload={props.onRetry}
          onClearFilters={() => changeSearch("")}
          loading={loading}
          actions={
            <>
              <button type="button" className={`btn btn-light rounded-pill ${styles.createButton}`} onClick={props.onOpenCreateGroup} disabled={!canWrite}>
                <i className="isax isax-folder-add" aria-hidden="true" /> Thêm bộ tài liệu
              </button>
              <button type="button" className={`btn rounded-pill ${styles.bannerRefresh}`} onClick={props.onOpenBulk} disabled={!canWrite}>
                <i className="isax isax-document-upload" aria-hidden="true" /> Thêm nhiều tài liệu
              </button>
              <button type="button" className={`btn btn-light rounded-pill ${styles.createButton}`} onClick={props.onOpenCreate} disabled={!canWrite}>
                <i className="isax isax-add-circle" aria-hidden="true" /> Thêm tài liệu
              </button>
            </>
          }
        >
          <Input className={styles.search} aria-label="Tìm bộ tài liệu" placeholder="Tìm bộ tài liệu..." value={search} onChange={event => changeSearch(event.target.value)} allowClear prefix={<i className="isax isax-search-normal-1" aria-hidden="true" />} />
        </CatalogToolbar>

        <div className="lesson-material-management__notice">
          <i className="isax isax-shield-search" aria-hidden="true" />
          <span>Không tải lên tài liệu nhạy cảm, dữ liệu cá nhân, tài liệu mật hoặc tài liệu yêu cầu kiểm soát truy cập nghiêm ngặt. Phiên bản hiện tại sử dụng liên kết công khai theo đường dẫn.</span>
        </div>

        {!writeEnabled && <WriteLockedNotice what="Thao tác với tài liệu (thêm bộ, thêm tài liệu, xoá, xuất bản)" />}

        {state.kind === "waiting" || state.kind === "error" ? (
          <FetchStateNotice state={state} waitingText={LESSON_MATERIALS_WAITING_TEXT} onRetry={props.onRetry} testId="lm-notice" />
        ) : (
          <div className="row g-3">
            <div className="col-lg-4">
              <section className={styles.panel} aria-label="Danh sách bộ tài liệu" data-testid="lm-group-list">
                <Table
                  className={styles.table}
                  rowKey="id"
                  columns={groupColumns}
                  dataSource={filteredGroups.slice(groupOffset, groupOffset + groupSize)}
                  onRow={group => ({
                    className: selection?.id === group.id ? "lesson-material-management__selected-group" : undefined,
                    "data-testid": "lm-group-row",
                  })}
                  pagination={false}
                  loading={loading}
                  locale={{ emptyText: loading ? null : <span data-testid="lm-empty">{search.trim() ? "Không tìm thấy bộ tài liệu" : "Chưa có bộ tài liệu"}</span> }}
                />
                <CatalogPagination page={groupPage} size={groupSize} total={filteredGroups.length} onChange={(page, size) => setGroupPagination({ page, size })} showQuickJumper={false} />
              </section>
            </div>

            <div className="col-lg-8">
              {selection === null ? (
                <div className="lesson-material-management__pane-placeholder" data-testid="lm-placeholder">
                  <i className="isax isax-document-text" aria-hidden="true" />
                  <p className="mb-0">Chọn một bộ tài liệu ở cột bên trái để xem và quản lý tài liệu trong bộ.</p>
                </div>
              ) : (
                <>
                  <div className="lesson-material-management__detail-header">
                    <div className="lesson-material-management__detail-title">
                      <h5>{selectedGroup?.name ?? ""}</h5>
                      {selectedGroup?.description && <p>{selectedGroup.description}</p>}
                    </div>
                    {props.detailActions}
                  </div>

                  {props.topicUi && <FlatTopicPanel ui={props.topicUi} canWrite={writeEnabled} busy={busy} />}

                  {detailState.kind === "loading" ? (
                    <div className="lesson-material-management__loading" data-testid="lm-detail-loading">
                      <span className="spinner-border text-danger" role="status" />
                      <span>Đang tải tài liệu...</span>
                    </div>
                  ) : detailState.kind !== "ok" ? (
                    <FetchStateNotice state={detailState} waitingText={LESSON_MATERIALS_WAITING_TEXT} onRetry={props.onRetryDetail} testId="lm-detail-notice" />
                  ) : detailState.data.length === 0 ? (
                    <div className="lesson-material-management__empty" data-testid="lm-detail-empty">
                      <i className="isax isax-folder-open" aria-hidden="true" />
                      <h5>Chưa có tài liệu trong bộ này</h5>
                      <p>Nhấn &quot;Thêm tài liệu&quot; để thêm vào bộ.</p>
                    </div>
                  ) : (
                    <MaterialsTable key={`${selection.id}:${props.sessionNo}`} materials={detailState.data} topicUi={props.topicUi} writeEnabled={writeEnabled} busy={busy} onRemove={props.onRemoveMaterial} />
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </ManagementPageFrame>
  );
}
