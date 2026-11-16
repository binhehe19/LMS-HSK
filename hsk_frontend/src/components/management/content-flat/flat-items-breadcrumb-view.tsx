"use client";

// Biến thể của FlatItemsView (xem đó để biết hành vi chung: loading/lỗi/rỗng/DataTable) không có khung gói bên trái (tên/mô tả/"Tổng số"/
// "Quay lại"), thay bằng breadcrumb "{config.title} › Tên gói" + thanh tiêu đề "{labels.item} — Tên gói" với nút "+ Thêm" ở cấp mục; bảng bỏ
// cột STT. Dùng cho module nào muốn cấp mục không có sidebar (gán `ItemsView` trong ContentModuleConfig) — ban đầu cho Ngữ pháp, Bài tập dùng
// chung vì không có logic riêng theo module.
import { useState } from "react";
import type { TableProps } from "antd";
import { DataTable } from "@/components/shared/data-table";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { FlatTopicPanel, topicColumn } from "@/components/management/content-flat/flat-topic-panel";
import type { FlatItemsViewProps } from "@/types/content";
import type { ContentItemBase } from "@/types/content";

export function FlatItemsBreadcrumbView<TItem extends ContentItemBase>({ config, pkg, state, items, canWrite, busy, onCreate, onEdit, onDelete, onBack, onRetry, topicUi }: FlatItemsViewProps<TItem>) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const { labels, ItemPreview } = config;
  const noun = labels.item.toLowerCase();
  const previewItem = ItemPreview ? (items.find((i) => i.id === previewId) ?? items[0] ?? null) : null;
  const notice = state.kind === "waiting" || state.kind === "error";

  const columns: TableProps<TItem>["columns"] = [
    ...config.itemColumns.map((col) => ({ title: col.title, key: col.key, width: col.width, render: (_: unknown, item: TItem) => col.render(item) })),
    ...topicColumn<TItem>(topicUi, canWrite, busy),
    {
      title: "Thao tác",
      key: "actions",
      width: 150,
      align: "right" as const,
      render: (_: unknown, item: TItem) => (
        <div className="d-flex justify-content-end gap-1">
          {ItemPreview && (
            <button type="button" className="btn btn-sm btn-light rounded-circle content-row-btn" onClick={() => setPreviewId(item.id)} title="Xem" aria-label={`Xem ${config.itemSummary(item)}`}>
              <i className="isax isax-eye text-primary" />
            </button>
          )}
          {canWrite && (
            <>
              <button type="button" className="btn btn-sm btn-light rounded-circle content-row-btn" onClick={() => onEdit(item)} disabled={busy} title="Chỉnh sửa" aria-label={`Chỉnh sửa ${config.itemSummary(item)}`}>
                <i className="isax isax-edit text-primary" />
              </button>
              <button type="button" className="btn btn-sm btn-light rounded-circle content-row-btn" onClick={() => onDelete(item)} disabled={busy} title="Xóa" aria-label={`Xóa ${config.itemSummary(item)}`}>
                <i className="isax isax-trash text-danger" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div data-testid="flat-content-items">
      <nav className="d-flex align-items-center gap-2 small mb-3" aria-label="breadcrumb">
        <button type="button" className="btn btn-link p-0 text-decoration-none text-primary fw-700" onClick={onBack}>
          <i className={`isax ${config.icon.replace(/^isax\s+/, "")} me-1`} />
          {config.title}
        </button>
        <span className="text-muted">›</span>
        <span className="fw-700 text-dark">{pkg?.name ?? "…"}</span>
      </nav>

      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h5 className="fw-800 mb-0 d-flex align-items-center gap-2">
          <i className="isax isax-message-text text-primary" />
          {labels.item} — {pkg?.name ?? "…"}
        </h5>
        {canWrite && (
          <button type="button" className="btn btn-primary rounded-pill px-3 py-2 d-flex align-items-center gap-2 fw-600" onClick={onCreate} disabled={busy || !pkg}>
            <i className="isax isax-add-circle" />
            Thêm {noun}
          </button>
        )}
      </div>

      {topicUi && <FlatTopicPanel ui={topicUi} canWrite={canWrite} busy={busy} />}
      {state.kind === "loading" ? (
        <div className="text-center py-5 bg-white rounded-4 shadow-sm border">
          <div className="spinner-border text-primary" role="status" />
          <p className="text-muted mt-3 mb-0">Đang tải {noun}...</p>
        </div>
      ) : notice ? (
        <FetchStateNotice state={state} waitingText={`Danh sách ${noun} chưa được kết nối API (WAITING FOR BACKEND).`} onRetry={onRetry} testId="flat-content-items-notice" />
      ) : items.length === 0 ? (
        <div className="text-center py-5 bg-white rounded-4 shadow-sm border" data-testid="flat-content-items-empty">
          <i className="isax isax-document-text d-block mb-3 text-muted" style={{ opacity: 0.1, fontSize: "80px" }} />
          <h5 className="fw-800 text-dark mb-2">Chưa có {noun} nào</h5>
          <p className="text-muted mb-0">Hãy bắt đầu thêm {noun} mới cho {labels.package.toLowerCase()} này.</p>
        </div>
      ) : (
        <>
          {ItemPreview && previewItem && (
            <div className="mb-4" data-testid="flat-content-item-preview">
              <ItemPreview item={previewItem} />
            </div>
          )}
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className="card-body p-3">
              <DataTable<TItem> columns={columns} dataSource={items} rowKey="id" search={false} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
