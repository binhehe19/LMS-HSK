// Mục nội dung của module LUYỆN PHÁT ÂM — `/pronunciation/pronunciation-items`. Tên trường theo hợp đồng đề xuất M5 (docs/api-requirements/content-tree.md,
// bảng module PRONUNCIATION): `text` thay cho `symbol` của PronunciationItemResponse cũ (core/types/pronunciation.type.ts), `tip` thay cho
// `pronunciationGuide`, `audioFileId`/`imageFileId` (tệp của repo-storage backend chung) thay cho `audioUrl`/`mouthImageUrl` (URL tự do), `index` thay cho
// contentIndex. Bỏ có chủ đích (ghi trong báo cáo W2-E để backend cân nhắc giữ): type SHENGMU/YUNMU, hanzi, exampleWord/examplePinyin/exampleMeaning.
import type { ContentItemBase, ContentItemInput } from "@/types/content";

export interface PronunciationItem extends ContentItemBase {
  /** Ký hiệu âm (vd "zh", "ü") hoặc từ/chữ minh hoạ (vd 妈). */
  text: string;
  /** Pinyin có dấu thanh. */
  pinyin?: string;
  /** Hướng dẫn phát âm (khẩu hình, vị trí lưỡi, thanh điệu...). */
  tip?: string;
  /** Tệp âm thanh mẫu trong repo-storage. */
  audioFileId?: string;
  /** Ảnh khẩu hình (hình miệng) trong repo-storage. */
  imageFileId?: string;
}

export type PronunciationItemInput = ContentItemInput<PronunciationItem>;
