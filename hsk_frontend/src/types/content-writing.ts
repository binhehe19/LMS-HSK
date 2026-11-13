// Mục nội dung của module LUYỆN VIẾT (Hán tự) — `/writing/words`. Tên trường theo hợp đồng đề xuất M5 (docs/api-requirements/content-tree.md, bảng
// module WRITING): `hanzi` thay cho `word` của HanziWord cũ (core/types/hanzi.type.ts); `index` thay cho cardIndex/wordIndex. Giữ lại các trường nghiệp vụ
// có trong HanziWord cũ mà màn quản lý cần hiển thị (pinyin, meaning, sinoVn, example, exampleMeaning) và thêm số nét/bộ thủ theo brief W2-E.
// Bỏ có chủ đích: characters (mảng ký tự cho hanzi-writer — backend/học viên tự tách), imageWord/imageOrigin/audio (URL tự do), examplePinyin, hskLevel,
// wordType, status (tiến độ học viên, không thuộc màn quản lý).
import type { ContentItemBase, ContentItemInput } from "@/types/content";

export interface HanziWord extends ContentItemBase {
  /** Chữ Hán (một hoặc nhiều ký tự; HanziWord.word cũ). */
  hanzi: string;
  /** Phiên âm pinyin có dấu thanh. */
  pinyin?: string;
  /** Nghĩa tiếng Việt. */
  meaning?: string;
  /** Tổng số nét của chữ (1–64). */
  strokeCount?: number;
  /** Bộ thủ (vd 女, 日, 亻). */
  radical?: string;
  /** Âm Hán Việt (HanziWord.sinoVn cũ). */
  sinoVn?: string;
  /** Câu/cụm ví dụ tiếng Trung. */
  example?: string;
  /** Nghĩa của ví dụ. */
  exampleMeaning?: string;
}

export type HanziWordInput = ContentItemInput<HanziWord>;
