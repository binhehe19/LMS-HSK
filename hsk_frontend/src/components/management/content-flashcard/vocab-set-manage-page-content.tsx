"use client";

import { VOCAB_SET_CONFIG } from "@/components/management/content-flashcard/flashcard-config";
import { ContentTreeManager } from "@/components/management/content-tree/content-tree-manager";

/** Màn "Quản lý Từ vựng" /vocab-set/manage (HSK cũ: ManageVocabularySet — cùng dịch vụ /flashcard, khác nhãn). */
export function VocabSetManagePageContent() {
  return <ContentTreeManager config={VOCAB_SET_CONFIG} />;
}
