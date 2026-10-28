import { Suspense } from "react";
import { VocabSetManagePageContent } from "@/components/management/content-flashcard/vocab-set-manage-page-content";

// Mục menu "Bộ từ vựng" (HSK cũ: ManageVocabularySet). useSearchParams cần ranh giới Suspense trong App Router.
export default function VocabSetManagePage() {
  return (
    <Suspense fallback={null}>
      <VocabSetManagePageContent />
    </Suspense>
  );
}
