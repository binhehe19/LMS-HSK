// Mục nội dung của module Thẻ ghi nhớ / Từ vựng (`/flashcard/cards`). Tên trường theo hợp đồng đề xuất M5 (term/pinyin/meaning/example +
// imageFileId/audioFileId của repo-storage) — khác HSK cũ (definition/exampleSentence/imageOrigin URL) có chủ đích: ảnh/âm thanh là id tệp của kho
// lưu trữ backend chung, không phải URL tự do. Đối chiếu: docs/api-requirements/content-tree.md mục "Thẻ ghi nhớ".
import type { ContentItemBase, ContentItemInput } from "@/types/content";

/** Một dòng trong "Trường bổ sung" (hiển thị ở mặt sau thẻ) — vd "Từ đồng nghĩa", "Từ trái nghĩa". */
export interface FlashcardCustomField {
  label: string;
  value: string;
}

export interface FlashcardCard extends ContentItemBase {
  /** Chữ Hán (mặt trước). */
  term: string;
  pinyin?: string;
  /** Từ loại (danh từ, động từ...). */
  wordType?: string;
  /** Nghĩa tiếng Việt (mặt sau). */
  meaning: string;
  /** Câu ví dụ (tiếng Trung). */
  example?: string;
  /** Pinyin của câu ví dụ. */
  examplePinyin?: string;
  /** Dịch câu ví dụ. */
  exampleMeaning?: string;
  imageFileId?: string;
  audioFileId?: string;
  /** Trường tự do thêm vào (nhãn + giá trị), hiển thị ở mặt sau thẻ. */
  customFields?: FlashcardCustomField[];
}

export type FlashcardCardInput = ContentItemInput<FlashcardCard>;
