"use client";

import { Suspense, use } from "react";
import { HanziSetEditorPageContent } from "@/components/management/content-hanzi/hanzi-set-editor-page-content";

// Sửa bộ học chữ Hán (HSK cũ: HanziCreateSetPage với :id, /hanzi/edit/:id). `params` là Promise trong Next 16 => đọc bằng `use(params)`; useSearchParams
// (returnUrl) cần Suspense.
export default function HanziEditSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <HanziSetEditorPageContent studySetId={id} />
    </Suspense>
  );
}
