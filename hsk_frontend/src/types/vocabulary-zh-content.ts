// Nội dung học liệu VOCABULARY loại phụ ZH (VocabularyZhContent ở backend): chữ Hán → nhiều cách đọc (pinyin) → nhiều nghĩa.
// Độc lập với nội dung EN (IELTS): không dùng chung kiểu; mọi tên trường khớp đúng với lớp backend.

export interface VocabularyZhMeaning {
  meaningVi?: string;
  meaningEn?: string;
  meaningZh?: string;
  exampleSentenceZh?: string;
  exampleSentencePinyin?: string;
  exampleSentenceVi?: string;
  exampleSentenceEn?: string;
  exampleWordType?: string;
}

export interface VocabularyZhPinyin {
  pinyin?: string;
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
  note?: string;
  sortOrder?: number;
  hskLevel?: number;
  audioUrl?: string;
  strokeAnimationUrl?: string;
  etymologyStory?: string;
  etymologyImage?: string;
  radical?: string;
  strokeCount?: number;
  strokes?: string;
  isSingleVocab?: boolean;
  notes?: string;
  pinyins?: VocabularyZhPinyin[];
}
