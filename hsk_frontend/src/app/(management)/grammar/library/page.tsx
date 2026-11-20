import { Suspense } from "react";
import { GrammarLibraryPageContent } from "@/components/management/content-grammar/grammar-library-page-content";

export default function GrammarLibraryPage() {
  return (
    <Suspense fallback={null}>
      <GrammarLibraryPageContent />
    </Suspense>
  );
}
