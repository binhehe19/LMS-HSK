// Mục nội dung của module Thẻ ghi nhớ / Từ vựng (`/flashcard/cards`). Tên trường theo hợp đồng đề xuất M5 (term/pinyin/meaning/example +
// imageFileId/audioFileId của repo-storage) — khác HSK cũ (definition/exampleSentence/imageOrigin URL) có chủ đích: ảnh/âm thanh là id tệp của kho
// lưu trữ backend chung, không phải URL tự do. Đối chiếu: docs/api-requirements/content-tree.md mục "Thẻ ghi nhớ".
import type { ContentItemBase, ContentItemInput } from "@/types/content";

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
  /** Dịch câu ví dụ. */
  exampleMeaning?: string;
  imageFileId?: string;
  audioFileId?: string;
}

export type FlashcardCardInput = ContentItemInput<FlashcardCard>;
