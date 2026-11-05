import { Suspense } from "react";
import { FlashcardManagePageContent } from "@/components/management/content-flashcard/flashcard-manage-page-content";

// Mục menu "Thẻ ghi nhớ" (HSK cũ: ManageFlashcard). useSearchParams (packageId/folderId/studySetId/view) cần ranh giới Suspense trong App Router.
export default function FlashcardPackagePage() {
  return (
    <Suspense fallback={null}>
      <FlashcardManagePageContent />
    </Suspense>
  );
}
