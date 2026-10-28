"use client";

// Danh sách dạng "explorer card" dùng chung cho ba mức Gói / Thư mục / Bộ học (storage-package-list.tsx, storage-folder-list.tsx,
// storage-studyset-list.tsx của HSK cũ gộp thành một component vì cùng DOM `.view-header` + `.items-grid` + `.explorer-card`).
// Khác bản cũ có chủ đích: react-bootstrap Dropdown => antd Dropdown; lỗi/chưa cấu hình => FetchStateNotice; nút tạo/sửa/xoá ẨN khi không có quyền
// theo ticket và KHOÁ khi công tắc ghi đóng (bản cũ chỉ ẩn theo canCUD).
import { Dropdown } from "antd";
import type { ReactNode } from "react";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";

export interface ExplorerMenuItem {
  key: string;
  label: ReactNode;
  danger?: boolean;
  onClick: () => void;
}

export interface StorageExplorerListProps<T extends { id: string }> {
  state: FetchState<T[]>;
  items: T[];
  header: { icon: string; title: string; count: string };
  createLabel: string;
  empty: { icon: string; title: string; text: string; cta: string };
  /** Quyền theo ticket: false => không render nút ghi (bản cũ). */
  canManage: boolean;
  /** Công tắc ghi: false => nút ghi disabled. */
  writeEnabled: boolean;
  waitingText: string;
  itemName: (item: T) => string;
  itemDescription: (item: T) => string;
  cardIcon: string;
  renderBadge?: (item: T) => ReactNode;
  renderFooter: (item: T) => ReactNode;
  /** Mục menu thêm (vd Publish) đặt trước Sửa/Xoá. */
  extraMenu?: (item: T) => ExplorerMenuItem[];
  onSelect: (item: T) => void;
  onCreate: () => void;
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
  onRetry: () => void;
  testId: string;
}

export function StorageExplorerList<T extends { id: string }>(props: StorageExplorerListProps<T>) {
  const { state, items, header, empty, canManage, writeEnabled } = props;
  const loading = state.kind === "loading" && items.length === 0;
  const showCreate = canManage;

  return (
    <div className="storage-view-container" data-testid={props.testId}>
      <div className="view-header">
        <div className="view-info">
          <i className={`isax ${header.icon}`} />
          <div>
            <h2 className="view-title">{header.title}</h2>
            <span className="view-count">{header.count}</span>
          </div>
        </div>
        <div className="view-actions">
          {showCreate && (
            <button type="button" className="btn btn-primary btn-pill" onClick={props.onCreate} disabled={!writeEnabled}>
              <i className="isax isax-add-circle me-1" />
              {props.createLabel}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-overlay" data-testid={`${props.testId}-loading`}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : state.kind === "waiting" || state.kind === "error" ? (
        <FetchStateNotice state={state} waitingText={props.waitingText} onRetry={props.onRetry} testId={`${props.testId}-notice`} />
      ) : items.length === 0 ? (
        <div className="empty-view" data-testid={`${props.testId}-empty`}>
          <div className="empty-icon">
            <i className={`isax ${empty.icon}`} />
          </div>
          <h3>{empty.title}</h3>
          <p>{empty.text}</p>
          {showCreate && (
            <button type="button" className="btn btn-primary btn-pill" onClick={props.onCreate} disabled={!writeEnabled}>
              {empty.cta}
            </button>
          )}
        </div>
      ) : (
        <div className="items-grid">
          {items.map((item) => {
            const name = props.itemName(item);
            const menu: ExplorerMenuItem[] = [
              ...(props.extraMenu?.(item) ?? []),
              ...(canManage
                ? [
                    { key: "edit", label: <span><i className="isax isax-edit-2 me-2" /> Sửa</span>, onClick: () => props.onEdit(item) },
                    { key: "delete", label: <span><i className="isax isax-trash me-2" /> Xóa</span>, danger: true, onClick: () => props.onDelete(item) },
                  ]
                : []),
            ];
            return (
              <div key={item.id} className="explorer-card" role="button" tabIndex={0} onClick={() => props.onSelect(item)} onKeyDown={(e) => e.key === "Enter" && props.onSelect(item)} data-testid={`${props.testId}-card`}>
                <div className="card-top">
                  <div className="icon-box">
                    <i className={`isax ${props.cardIcon}`} />
                  </div>
                  {menu.length > 0 && (
                    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
                      <Dropdown
                        trigger={["click"]}
                        disabled={!writeEnabled}
                        menu={{
                          items: menu.map((m) => ({ key: m.key, label: m.label, danger: m.danger })),
                          onClick: ({ key }) => menu.find((m) => m.key === key)?.onClick(),
                        }}
                      >
                        <button type="button" className="btn btn-link p-0 text-muted" aria-label={`Thao tác với ${name}`} disabled={!writeEnabled}>
                          <i className="isax isax-more" />
                        </button>
                      </Dropdown>
                    </div>
                  )}
                </div>
                <div className="card-body-content">
                  <h4 className="item-name" title={name}>
                    {name}
                  </h4>
                  {props.renderBadge?.(item)}
                  <p className="item-description">{props.itemDescription(item)}</p>
                </div>
                <div className="card-footer">
                  <div className="stat-group">{props.renderFooter(item)}</div>
                  <i className="isax isax-arrow-right-3 card-arrow" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
