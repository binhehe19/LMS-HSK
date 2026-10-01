"use client";

// Học liệu của một buổi gom theo chủ đề: mỗi chủ đề là một khối (kể cả khi trống) có tiêu đề "Chủ đề: tên" kèm nút lên/xuống, đổi tên, xóa; học liệu chưa
// phân chủ đề nằm ở khối "Không chủ đề" cuối cùng (chỉ hiện khi còn mục). Kéo thẻ học liệu thả vào một khối để chuyển chủ đề (thả vào "Không chủ đề" để bỏ
// khỏi chủ đề). Thẻ học liệu do nơi gọi vẽ qua `renderCard`; component chỉ cấp thuộc tính kéo.
import { useState, type DragEvent, type HTMLAttributes, type ReactNode } from "react";
import styles from "./package-workspace.module.css";
import { TopicTitleModal } from "@/components/management/syllabus/topic-title-modal";
import { confirmAction } from "@/components/shared/confirm-action";
import type { FlatTopic, FlatTopicUi } from "@/types/content";

const DRAG_TYPE = "application/x-flat-item";
const NO_TOPIC = "no-topic";

interface Props<TItem extends { id: string }> {
  items: TItem[];
  ui: FlatTopicUi;
  canWrite: boolean;
  busy: boolean;
  /** Danh từ số ít của học liệu (đã chữ thường), dùng trong dòng "Chưa có … nào trong chủ đề này". */
  noun: string;
  renderCard: (item: TItem, dragProps: HTMLAttributes<HTMLLIElement>) => ReactNode;
}

export function FlatTopicBlocks<TItem extends { id: string }>({ items, ui, canWrite, busy, noun, renderCard }: Props<TItem>) {
  const [renaming, setRenaming] = useState<FlatTopic | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const draggable = canWrite && !busy;

  const known = new Set(ui.topics.map((t) => t.id));
  const blocks: { topic: FlatTopic | null; items: TItem[] }[] = ui.topics.map((topic) => ({ topic, items: items.filter((i) => ui.topicOf(i.id) === topic.id) }));
  // Mục thuộc chủ đề không còn trong danh sách coi như chưa phân chủ đề để không biến mất khỏi màn hình.
  const rest = items.filter((i) => !known.has(ui.topicOf(i.id) ?? ""));
  if (rest.length > 0) blocks.push({ topic: null, items: rest });

  const remove = async (topic: FlatTopic) => {
    const ok = await confirmAction({
      title: "Xóa chủ đề",
      content: `Xóa chủ đề "${topic.title}"? ${topic.itemCount > 0 ? `${topic.itemCount} mục trong chủ đề vẫn được giữ và chuyển về "Không chủ đề".` : "Chủ đề này chưa có mục nào."}`,
      okText: "Xóa",
      danger: true,
    });
    if (ok) ui.onDelete(topic);
  };

  const dropHandlers = (topic: FlatTopic | null) => {
    const key = topic?.id ?? NO_TOPIC;
    const accepts = (event: DragEvent) => draggable && event.dataTransfer.types.includes(DRAG_TYPE);
    return {
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (!accepts(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (dragOver !== key) setDragOver(key);
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        // Rời sang phần tử con vẫn nằm trong khối thì không tắt viền.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver((current) => (current === key ? null : current));
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (!accepts(event)) return;
        event.preventDefault();
        setDragOver(null);
        const itemId = event.dataTransfer.getData(DRAG_TYPE);
        if (items.some((i) => i.id === itemId) && (ui.topicOf(itemId) ?? null) !== (topic?.id ?? null)) ui.onAssign(itemId, topic?.id ?? null);
      },
    };
  };

  const dragProps = (item: TItem): HTMLAttributes<HTMLLIElement> => ({
    draggable,
    className: draggable ? styles.draggableCard : undefined,
    onDragStart: (event) => {
      event.dataTransfer.setData(DRAG_TYPE, item.id);
      event.dataTransfer.effectAllowed = "move";
    },
  });

  return (
    <div className={styles.topicBlocks}>
      {blocks.map(({ topic, items: blockItems }) => {
        const index = topic ? ui.topics.findIndex((t) => t.id === topic.id) : -1;
        return (
          <section key={topic?.id ?? NO_TOPIC} className={`${styles.topicBlock} ${dragOver === (topic?.id ?? NO_TOPIC) ? styles.topicDropActive : ""}`} aria-label={topic ? `Chủ đề ${topic.title}` : "Không chủ đề"} {...dropHandlers(topic)}>
            <div className={styles.topicBlockHeader}>
              <h6 className={styles.topicBlockTitle}>
                {topic ? <><span className={styles.topicBlockLabel}>Chủ đề: </span>{topic.title}</> : <span className={styles.topicBlockLabel}>Không chủ đề</span>}
              </h6>
              <span className={styles.count}>{blockItems.length}</span>
              {topic && canWrite && (
                <div className={styles.topicBlockActions}>
                  <button type="button" className={styles.itemAction} onClick={() => ui.onMove(topic, -1)} disabled={busy || index === 0} title="Đưa chủ đề lên" aria-label={`Đưa chủ đề ${topic.title} lên`}>
                    <i className="isax isax-arrow-up-2" aria-hidden="true" />
                  </button>
                  <button type="button" className={styles.itemAction} onClick={() => ui.onMove(topic, 1)} disabled={busy || index === ui.topics.length - 1} title="Đưa chủ đề xuống" aria-label={`Đưa chủ đề ${topic.title} xuống`}>
                    <i className="isax isax-arrow-down-1" aria-hidden="true" />
                  </button>
                  <button type="button" className={styles.itemAction} onClick={() => setRenaming(topic)} disabled={busy} title="Đổi tên chủ đề" aria-label={`Đổi tên chủ đề ${topic.title}`}>
                    <i className="isax isax-edit text-primary" aria-hidden="true" />
                  </button>
                  <button type="button" className={styles.itemAction} onClick={() => void remove(topic)} disabled={busy} title="Xóa chủ đề" aria-label={`Xóa chủ đề ${topic.title}`}>
                    <i className="isax isax-trash text-danger" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
            {blockItems.length === 0 ? (
              <div className={styles.emptyResources}>
                <i className={`isax isax-document-text ${styles.emptyIcon}`} aria-hidden="true" />
                <h5 className="fw-800 text-dark mb-0">Chưa có {noun} nào trong chủ đề này</h5>
                {canWrite && <p className="text-muted mb-0">Kéo {noun} từ chủ đề khác thả vào đây.</p>}
              </div>
            ) : (
              <ul className={styles.itemCards} aria-label={topic ? `Học liệu trong chủ đề ${topic.title}` : "Học liệu không thuộc chủ đề"}>
                {blockItems.map((item) => renderCard(item, dragProps(item)))}
              </ul>
            )}
          </section>
        );
      })}
      {renaming && (
        <TopicTitleModal
          key={renaming.id}
          open
          initial={renaming.title}
          busy={busy}
          onCancel={() => setRenaming(null)}
          onSubmit={async (title) => {
            const saved = await ui.onRename(renaming, title);
            if (saved) setRenaming(null);
            return saved;
          }}
        />
      )}
    </div>
  );
}
