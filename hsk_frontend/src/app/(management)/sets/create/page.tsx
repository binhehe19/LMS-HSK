import { Suspense } from "react";
import { FlashcardSetEditorPageContent } from "@/components/management/content-flashcard/flashcard-set-editor-page-content";

// Tạo bộ thẻ kèm thẻ (HSK cũ: CreateSetPage). useSearchParams (packageId/folderId/returnUrl) cần ranh giới Suspense trong App Router.
export default function CreateSetPage() {
  return (
    <Suspense fallback={null}>
      <FlashcardSetEditorPageContent />
    </Suspense>
  );
}
