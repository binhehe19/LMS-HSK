import { Suspense } from "react";
import { DictionaryManagePageContent } from "@/components/management/dictionary/dictionary-manage-page-content";

// /vocabulary/manage của HSK cũ (ManageVocabulary — từ điển, không theo cây): tìm kiếm + phân trang phía máy chủ, CRUD từ vựng.
export default function VocabularyManagePage() {
  return (
    <Suspense fallback={null}>
      <DictionaryManagePageContent />
    </Suspense>
  );
}
