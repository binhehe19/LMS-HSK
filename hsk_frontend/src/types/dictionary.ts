// DTO của TỪ ĐIỂN (dịch vụ /dictionary/vocabularies của HSK cũ — core/types/vocabulary.type.ts, "matches backend DTOs exactly").
// Đã nối vào repo-lms thật qua lms-dictionary-client.ts: LearningResourceType.DICTIONARY, content dùng chung class
// VocabularyContent.java với VOCABULARY (từ điển Anh/IELTS) — tách nhau bằng type, không phải bằng class (tài nguyên
// độc lập trong Kho, id là ULID chuỗi — không phải số tự tăng như backend từ điển cũ).
// Rút gọn có chủ đích: bỏ các trường "legacy flat" (pinyin/wordTypes/meanings ở cấp từ) và componentVocabs — màn quản lý mới chỉ dùng mô hình pinyins[].

export interface VocabularyMeaning {
  id?: string;
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
  id?: string;
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
  id: string;
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

// ---- Màn Từ điển của HỌC VIÊN (/vocabulary, /vocabulary/:id) — chỉ từ ĐÃ XUẤT BẢN, endpoint đọc của repo-lms cho mọi người dùng đã đăng nhập ----

/** Một chữ thành phần của từ ghép (thay `componentVocabs` của bản cũ): backend tra từng chữ của `hanzi` trong từ điển đã xuất bản. */
export interface VocabularyComponent {
  /** Id từ đơn tương ứng trong từ điển; null nếu chữ này chưa có trong từ điển (vẫn hiện chữ, không bấm được). */
  id: string | null;
  hanzi: string;
  pinyin?: string;
  meaning?: string;
}

/** Chi tiết một từ cho học viên = `Vocabulary` + chữ thành phần. */
export interface VocabularyDetail extends Vocabulary {
  components: VocabularyComponent[];
}

/** Tham số tìm kiếm của học viên; `radical` là CHÍNH ký tự bộ thủ (vd "口"), `page` từ 0. */
export interface StudentVocabularySearchParams {
  keySearch?: string;
  hskLevel?: number;
  radical?: string;
  page: number;
  size: number;
}
