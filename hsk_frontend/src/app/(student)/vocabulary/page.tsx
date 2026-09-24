import type { Metadata } from "next";
import { Suspense } from "react";
import { VocabularyHomePageContent } from "@/components/student/vocabulary/vocabulary-home-page-content";

export const metadata: Metadata = { title: "Từ vựng | Học Bá" };

// /vocabulary của HSK cũ (VocabularyHome): bộ lọc/trang nằm trong query nên cần ranh giới Suspense cho useSearchParams.
export default function VocabularyHomePage() {
  return (
    <Suspense fallback={null}>
      <VocabularyHomePageContent />
    </Suspense>
  );
}
