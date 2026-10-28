"use client";

import { FLASHCARD_CONFIG } from "@/components/management/content-flashcard/flashcard-config";
import { ContentTreeManager } from "@/components/management/content-tree/content-tree-manager";

/** Màn "Quản lý Flashcards" (HSK cũ: ManageFlashcard, dùng chung cho /flashcard/create-package, /flashcard/manage, /flashcard/manage-learning-path, /flashcard/manage-learning). */
export function FlashcardManagePageContent() {
  return <ContentTreeManager config={FLASHCARD_CONFIG} />;
}
