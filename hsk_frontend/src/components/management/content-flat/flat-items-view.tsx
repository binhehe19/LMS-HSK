"use client";

// Cấp MỤC của màn quản lý PHẲNG (Package → mục) — mirror content-items-view.tsx nhưng thẻ bên trái hiện thông tin GÓI thay vì bộ (không có
// Folder/StudySet ở nền này). Cột bảng + xem nhanh vẫn do ContentModuleConfig cung cấp nên dùng được cho module khác theo cùng mẫu.
import { useState } from "react";
import type { TableProps } from "antd";
import { DataTable } from "@/components/shared/data-table";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { FlatTopicPanel, topicColumn } from "@/components/management/content-flat/flat-topic-panel";
import type { ContentItemBase, FlatItemsViewProps } from "@/types/content";

export function FlatItemsView<TItem extends ContentItemBase>({ config, pkg, state, items, canWrite, busy, onCreate, onEdit, onDelete, onBack, onRetry, topicUi }: FlatItemsViewProps<TItem>) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const { labels, ItemPreview } = config;
  const noun = labels.item.toLowerCase();
  const previewItem = ItemPreview ? (items.find((i) => i.id === previewId) ?? items[0] ?? null) : null;
  const notice = state.kind === "waiting" || state.kind === "error";

  const columns: TableProps<TItem>["columns"] = [
    { title: "STT", key: "stt", width: 64, render: (_: unknown, item: TItem) => <span className="fw-700 text-muted">{String((item.index ?? items.indexOf(item)) + 1).padStart(2, "0")}</span> },
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
    <div className="flashcard-viewer-container" data-testid="flat-content-items">
      <div className="row g-4">
        <div className="col-lg-3">
          <div className="card shadow-sm border p-4 flashcard-study-info-card rounded-4">
            <h5 className="fw-800 text-dark mb-3">{pkg?.name ?? "…"}</h5>
            {pkg?.description && <p className="text-secondary mb-4 p-3 bg-light rounded-3 flashcard-study-description small">{pkg.description}</p>}
            <div className="d-flex justify-content-between align-items-center p-3 bg-primary bg-opacity-10 rounded-3 mb-4 flashcard-count-box">
              <span className="text-primary fw-700">Tổng số {noun}:</span>
              <span className="badge bg-primary rounded-pill px-3 py-2 fs-6" data-testid="flat-content-items-count">
                {items.length}
              </span>
            </div>
            {canWrite ? (
              <button type="button" className="btn btn-primary rounded-pill w-100 d-flex align-items-center justify-content-center gap-2 py-2 mb-3 fw-600" onClick={onCreate} disabled={busy || !pkg}>
                <i className="isax isax-add-circle" />
                Thêm {noun}
              </button>
            ) : (
              <button type="button" className="btn btn-primary rounded-pill w-100 d-flex align-items-center justify-content-center gap-2 py-2 mb-3 fw-600" disabled>
                <i className="isax isax-eye" />
                Chế độ xem
              </button>
            )}
            <button type="button" className="btn btn-outline-secondary rounded-pill w-100 d-flex align-items-center justify-content-center gap-2 py-2 fw-600" onClick={onBack}>
              <i className="isax isax-arrow-left" />
              Quay lại
            </button>
          </div>
        </div>

        <div className="col-lg-9">
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
                <div className="card-header bg-white py-3 border-bottom px-4">
                  <h6 className="fw-800 mb-0 text-uppercase small" style={{ color: "#1e293b", letterSpacing: "0.5px" }}>
                    Tất cả các {noun} ({items.length})
                  </h6>
                </div>
                <div className="card-body p-3">
                  <DataTable<TItem> columns={columns} dataSource={items} rowKey="id" search={false} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
