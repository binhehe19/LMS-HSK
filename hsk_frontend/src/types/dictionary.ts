// Dữ liệu hiển thị từ vựng tiếng Trung, chuyển từ API VOCABULARY trong lms-dictionary-client.

/** Một câu ví dụ của một nghĩa. */
export interface VocabularyExample {
  zh?: string;
  pinyin?: string;
  vi?: string;
  en?: string;
  zhHtml?: string;
  pinyinHtml?: string;
  viHtml?: string;
}

export interface VocabularyMeaning {
  id?: string;
  meaning: string;
  meaningEn?: string;
  meaningZh?: string;
  meaningViHtml?: string;
  meaningZhHtml?: string;
  /** Loại từ của nghĩa này. */
  exampleWordType?: string;
  /** Các câu ví dụ của nghĩa này (một nghĩa có thể có nhiều ví dụ). */
  examples?: VocabularyExample[];
  definitionCn?: string;
}

export interface VocabularyPinyin {
  id?: string;
  pinyin: string;
  audioUrl?: string;
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
  imageUrl?: string;
  etymologyStory?: string;
  etymologyStoryHtml?: string;
  radical?: string;
  isSingleVocab: boolean;
  notes?: string;
  notesHtml?: string;
  status?: VocabularyStatus | string;
  pinyins?: VocabularyPinyin[];
  createdAt?: string;
  updatedAt?: string;
}

/** Thân POST/PUT (CreateVocabularyRequest = UpdateVocabularyRequest của bản cũ). */
export interface VocabularyInput {
  hanzi: string;
  hskLevel?: number;
  imageUrl?: string;
  etymologyStory?: string;
  etymologyStoryHtml?: string;
  radical?: string;
  isSingleVocab: boolean;
  notes?: string;
  notesHtml?: string;
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
