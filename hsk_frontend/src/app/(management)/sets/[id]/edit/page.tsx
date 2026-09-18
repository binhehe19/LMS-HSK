"use client";

import { Suspense, use } from "react";
import { FlashcardSetEditorPageContent } from "@/components/management/content-flashcard/flashcard-set-editor-page-content";

// Sửa bộ thẻ (HSK cũ: UpdateSetPage, /sets/:id/edit). `params` là Promise trong Next 16 => đọc bằng `use(params)`; useSearchParams (returnUrl) cần Suspense.
export default function EditSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <FlashcardSetEditorPageContent studySetId={id} />
    </Suspense>
  );
}
