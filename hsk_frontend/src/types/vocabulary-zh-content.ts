// Nội dung học liệu VOCABULARY loại phụ ZH (VocabularyZhContent ở backend): chữ Hán → nhiều cách đọc (pinyin) → nhiều nghĩa.
// Độc lập với nội dung EN (IELTS): không dùng chung kiểu; mọi tên trường khớp đúng với lớp backend.

/** Một câu ví dụ của một nghĩa (VocabularyZhContent.DictionaryExampleItem ở backend). */
export interface VocabularyZhExample {
  zh?: string;
  pinyin?: string;
  vi?: string;
  en?: string;
  zhHtml?: string;
  pinyinHtml?: string;
  viHtml?: string;
}

export interface VocabularyZhMeaning {
  meaningVi?: string;
  meaningEn?: string;
  meaningZh?: string;
  meaningViHtml?: string;
  meaningZhHtml?: string;
  /** Loại từ của nghĩa này. */
  exampleWordType?: string;
  /** Các câu ví dụ minh họa nghĩa này. */
  examples?: VocabularyZhExample[];
}

export interface VocabularyZhPinyin {
  pinyin?: string;
  audioUrl?: string;
  sinoVietnamese?: string;
  /** Từ loại, phân cách bằng dấu phẩy: "Động từ,Danh từ". */
  wordTypes?: string;
  isPrimary?: boolean;
  measureWord?: string;
  compounds?: string;
  synonyms?: string;
  antonyms?: string;
  notes?: string;
  meanings?: VocabularyZhMeaning[];
}

export interface VocabularyZhContent {
  /** Chữ Hán. */
  word: string;
  imageUrl?: string;
  hskLevel?: number;
  etymologyStory?: string;
  etymologyStoryHtml?: string;
  radical?: string;
  isSingleVocab?: boolean;
  notes?: string;
  notesHtml?: string;
  pinyins?: VocabularyZhPinyin[];
}
