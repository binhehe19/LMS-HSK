import { Suspense } from "react";
import { FlashcardManagePageContent } from "@/components/management/content-flashcard/flashcard-manage-page-content";

// Bí danh của /flashcard/package (HSK cũ: cùng component ManageFlashcard).
export default function FlashcardManageLearningPathPage() {
  return (
    <Suspense fallback={null}>
      <FlashcardManagePageContent />
    </Suspense>
  );
}
