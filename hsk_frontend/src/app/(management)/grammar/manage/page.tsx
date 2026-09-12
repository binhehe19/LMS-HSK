import { Suspense } from "react";
import { GrammarManagePageContent } from "@/components/management/content-grammar/grammar-manage-page-content";

// /grammar/manage của HSK cũ (ManageGrammar): cây Gói → Thư mục → Cấu trúc ngữ pháp → Điểm ngữ pháp.
export default function GrammarManagePage() {
  return (
    <Suspense fallback={null}>
      <GrammarManagePageContent />
    </Suspense>
  );
}
