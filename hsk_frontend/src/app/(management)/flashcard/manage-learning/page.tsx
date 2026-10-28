import { Suspense } from "react";
import { FlashcardManagePageContent } from "@/components/management/content-flashcard/flashcard-manage-page-content";

// Bí danh của /flashcard/create-package (HSK cũ: cùng component ManageFlashcard).
export default function FlashcardManageLearningPage() {
  return (
    <Suspense fallback={null}>
      <FlashcardManagePageContent />
    </Suspense>
  );
}
