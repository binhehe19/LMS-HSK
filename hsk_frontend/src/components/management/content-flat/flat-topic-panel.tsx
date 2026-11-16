"use client";

// Chủ đề trong gói của màn Kho phẳng: khối quản lý chủ đề (thêm, đổi tên, xóa, lên/xuống) + cột "Chủ đề" trong bảng mục để chuyển mục sang chủ đề
// khác. Dùng lại hộp nhập tên chủ đề của màn lịch giáo trình. Chủ đề chỉ để gom và sắp thứ tự mục, không phải một cấp chứa riêng.
import { useState } from "react";
import type { TableColumnType } from "antd";
import { TopicTitleModal } from "@/components/management/syllabus/topic-title-modal";
import { confirmAction } from "@/components/shared/confirm-action";
import type { ContentItemBase, FlatTopic, FlatTopicUi } from "@/types/content";

type TitleTarget = { mode: "create" } | { mode: "rename"; topic: FlatTopic };

export function FlatTopicPanel({ ui, canWrite, busy }: { ui: FlatTopicUi; canWrite: boolean; busy: boolean }) {
  const [target, setTarget] = useState<TitleTarget | null>(null);
  const { topics } = ui;

  const remove = async (topic: FlatTopic) => {
    const ok = await confirmAction({
      title: "Xóa chủ đề",
      content: `Xóa chủ đề "${topic.title}"? ${topic.itemCount > 0 ? `${topic.itemCount} mục trong chủ đề vẫn được giữ và chuyển về "Chưa phân chủ đề".` : "Chủ đề này chưa có mục nào."}`,
      okText: "Xóa",
      danger: true,
    });
    if (ok) ui.onDelete(topic);
  };

  const submit = async (title: string): Promise<boolean> => {
    if (!target) return false;
    const saved = target.mode === "create" ? await ui.onCreate(title) : await ui.onRename(target.topic, title);
    if (saved) setTarget(null);
    return saved;
  };

  return (
    <div className="card border-0 shadow-sm rounded-4 mb-4" data-testid="flat-topic-panel">
      <div className="card-header bg-white py-3 border-bottom px-4 d-flex justify-content-between align-items-center">
        <h6 className="fw-800 mb-0 text-uppercase small" style={{ color: "#1e293b", letterSpacing: "0.5px" }}>
          Chủ đề ({topics.length})
        </h6>
        {canWrite && (
          <button type="button" className="btn btn-sm btn-outline-primary rounded-pill px-3" onClick={() => setTarget({ mode: "create" })} disabled={busy} data-testid="flat-topic-add">
            <i className="isax isax-add-circle me-1" />
            Thêm chủ đề
          </button>
        )}
      </div>
      <div className="card-body p-3">
        {topics.length === 0 ? (
          <p className="text-muted small mb-0">Chưa có chủ đề. Thêm chủ đề để gom các mục theo nhóm; mục chưa phân chủ đề vẫn hiện bình thường.</p>
        ) : (
          <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
            {topics.map((topic, index) => (
              <li key={topic.id} className="d-flex align-items-center gap-2 p-2 bg-light rounded-3" data-testid="flat-topic-row">
                <span className="fw-700 flex-grow-1 text-truncate" title={topic.title}>
                  {topic.title}
                </span>
                <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill">{topic.itemCount} mục</span>
                {canWrite && (
                  <div className="d-flex gap-1">
                    <button type="button" className="btn btn-sm btn-light rounded-circle content-row-btn" onClick={() => ui.onMove(topic, -1)} disabled={busy || index === 0} title="Lên" aria-label={`Đưa chủ đề ${topic.title} lên`}>
                      <i className="isax isax-arrow-up-2" />
                    </button>
                    <button type="button" className="btn btn-sm btn-light rounded-circle content-row-btn" onClick={() => ui.onMove(topic, 1)} disabled={busy || index === topics.length - 1} title="Xuống" aria-label={`Đưa chủ đề ${topic.title} xuống`}>
                      <i className="isax isax-arrow-down-1" />
                    </button>
                    <button type="button" className="btn btn-sm btn-light rounded-circle content-row-btn" onClick={() => setTarget({ mode: "rename", topic })} disabled={busy} title="Đổi tên" aria-label={`Đổi tên chủ đề ${topic.title}`}>
                      <i className="isax isax-edit text-primary" />
                    </button>
                    <button type="button" className="btn btn-sm btn-light rounded-circle content-row-btn" onClick={() => void remove(topic)} disabled={busy} title="Xóa" aria-label={`Xóa chủ đề ${topic.title}`}>
                      <i className="isax isax-trash text-danger" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {target && <TopicTitleModal key={target.mode === "rename" ? target.topic.id : "create"} open initial={target.mode === "rename" ? target.topic.title : ""} busy={busy} onCancel={() => setTarget(null)} onSubmit={submit} />}
    </div>
  );
}

/** Ô chọn chủ đề của một mục (chỉ đọc khi không có quyền ghi). Dùng ở bảng antd (topicColumn) và bảng riêng của màn tài liệu học tập. */
export function FlatTopicSelect({ ui, itemId, canWrite, busy }: { ui: FlatTopicUi; itemId: string; canWrite: boolean; busy: boolean }) {
  const current = ui.topicOf(itemId);
  const name = ui.topics.find((t) => t.id === current)?.title;
  if (!canWrite) return <span className="text-muted small">{name ?? "Chưa phân chủ đề"}</span>;
  return (
    <select className="form-select form-select-sm" value={current ?? ""} onChange={(e) => ui.onAssign(itemId, e.target.value || null)} disabled={busy} aria-label="Chủ đề của mục" data-testid="flat-topic-select">
      <option value="">Chưa phân chủ đề</option>
      {ui.topics.map((t) => (
        <option key={t.id} value={t.id}>
          {t.title}
        </option>
      ))}
    </select>
  );
}

/** Cột "Chủ đề" của bảng mục antd; không có chủ đề nào thì không có cột. */
export function topicColumn<TItem extends ContentItemBase>(ui: FlatTopicUi | undefined, canWrite: boolean, busy: boolean): TableColumnType<TItem>[] {
  if (!ui || ui.topics.length === 0) return [];
  return [{ title: "Chủ đề", key: "topic", width: 200, render: (_: unknown, item: TItem) => <FlatTopicSelect ui={ui} itemId={item.id} canWrite={canWrite} busy={busy} /> }];
}
