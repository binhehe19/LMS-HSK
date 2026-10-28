// So khớp danh sách mục đang sửa với mục hiện có trên máy chủ (trang sửa bộ): giữ id mục cũ để không mất tiến độ học viên — logic
// handleSubmitStudySet/update-set-page.tsx của HSK cũ, viết generic cho mọi module.
import type { ContentItemBase, ContentItemInput } from "@/types/content";

export interface EditableContentItem<TItem extends ContentItemBase> {
  /** Khoá cục bộ ổn định cho React (mục mới chưa có id máy chủ). */
  localId: string;
  /** Có khi mục đã tồn tại trên máy chủ. */
  id?: string;
  input: ContentItemInput<TItem>;
}

interface ContentItemDiff<TItem extends ContentItemBase> {
  toCreate: ContentItemInput<TItem>[];
  toUpdate: { id: string; input: ContentItemInput<TItem> }[];
  toDeleteIds: string[];
}

interface ContentItemDiffAdapters<TItem extends ContentItemBase> {
  itemToInput: (item: TItem) => ContentItemInput<TItem>;
  normalizeItemInput: (input: ContentItemInput<TItem>) => ContentItemInput<TItem>;
}

/**
 * Mục có id còn trong danh sách => cập nhật nếu nội dung hoặc thứ tự đổi; không id => tạo; id cũ không còn => xoá. `index` = vị trí mới trong danh sách.
 * So sánh trên dạng đã chuẩn hoá (bỏ khoảng trắng/trường rỗng) để không tạo PUT vô ích.
 */
export function diffContentItems<TItem extends ContentItemBase>(existing: readonly TItem[], edited: readonly EditableContentItem<TItem>[], adapters: ContentItemDiffAdapters<TItem>): ContentItemDiff<TItem> {
  const byId = new Map(existing.map((item) => [item.id, item]));
  const remaining = new Set(byId.keys());
  const diff: ContentItemDiff<TItem> = { toCreate: [], toUpdate: [], toDeleteIds: [] };
  const key = (input: ContentItemInput<TItem>) => JSON.stringify({ ...adapters.normalizeItemInput(input), index: undefined });

  edited.forEach((entry, index) => {
    const input = { ...adapters.normalizeItemInput(entry.input), index };
    const current = entry.id ? byId.get(entry.id) : undefined;
    if (current && entry.id) {
      remaining.delete(entry.id);
      const changed = key(adapters.itemToInput(current)) !== key(input) || (current.index ?? index) !== index;
      if (changed) diff.toUpdate.push({ id: entry.id, input });
    } else {
      diff.toCreate.push(input);
    }
  });
  diff.toDeleteIds = [...remaining];
  return diff;
}
