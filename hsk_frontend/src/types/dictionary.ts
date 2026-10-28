// DTO của TỪ ĐIỂN (dịch vụ /dictionary/vocabularies của HSK cũ — core/types/vocabulary.type.ts, "matches backend DTOs exactly"). Giữ nguyên tên trường
// vì backend từ điển đã tồn tại (LMS_Backend); backend chung LMS_IELTS chưa có nên vẫn là hợp đồng ĐỀ XUẤT: docs/api-requirements/dictionary.md.
// Rút gọn có chủ đích: bỏ các trường "legacy flat" (pinyin/wordTypes/meanings ở cấp từ) và componentVocabs — màn quản lý mới chỉ dùng mô hình pinyins[].

export interface VocabularyMeaning {
  id?: number;
  meaning: string;
  exampleSentenceCn?: string;
  exampleSentenceVi?: string;
  exampleSentenceEn?: string;
  exampleSentencePinyin?: string;
  /** Từ loại áp cho riêng ví dụ này. */
  exampleWordType?: string;
  definitionCn?: string;
}

export interface VocabularyPinyin {
  id?: number;
  pinyin: string;
  sinoVietnamese?: string;
  /** Từ loại, phân cách bằng dấu phẩy: "Động từ,Danh từ". */
  wordTypes?: string;
  isPrimary?: boolean;
  /** Lượng từ, vd "个 [gè], 本 [běn]". */
  measureWord?: string;
  /** JSON: [{hanzi, sinoVietnamese?}]. */
  compounds?: string;
  /** JSON: [{hanzi, pinyin?}]. */
  synonyms?: string;
  /** JSON: [{hanzi, pinyin?}]. */
  antonyms?: string;
  notes?: string;
  meanings: VocabularyMeaning[];
}

export type VocabularyStatus = "draft" | "published";

export interface Vocabulary {
  id: number;
  hanzi: string;
  hskLevel?: number;
  audioUrl?: string;
  imageUrl?: string;
  strokeAnimationUrl?: string;
  etymologyStory?: string;
  etymologyImage?: string;
  radical?: string;
  strokeCount?: number;
  /** Tên các nét, vd "横、竖、横". */
  strokes?: string;
  isSingleVocab: boolean;
  notes?: string;
  status?: VocabularyStatus | string;
  pinyins?: VocabularyPinyin[];
  createdAt?: string;
  updatedAt?: string;
}

/** Thân POST/PUT (CreateVocabularyRequest = UpdateVocabularyRequest của bản cũ). */
export interface VocabularyInput {
  hanzi: string;
  hskLevel?: number;
  audioUrl?: string;
  imageUrl?: string;
  strokeAnimationUrl?: string;
  etymologyStory?: string;
  etymologyImage?: string;
  radical?: string;
  strokeCount?: number;
  strokes?: string;
  isSingleVocab: boolean;
  notes?: string;
  status?: VocabularyStatus | string;
  pinyins: VocabularyPinyin[];
}

export interface VocabularyPage {
  items: Vocabulary[];
  totalElements: number;
  totalPages: number;
  /** Từ 0 (PagedResult kiểu Spring). */
  page: number;
  size: number;
}

/** Tham số tìm kiếm phía máy chủ (VocabularySearchParams của bản cũ); `page` từ 0. */
export interface VocabularySearchParams {
  keySearch: string;
  hskLevel?: number;
  isSingleVocab?: boolean;
  wordType?: string;
  radical?: string;
  page: number;
  size: number;
}
