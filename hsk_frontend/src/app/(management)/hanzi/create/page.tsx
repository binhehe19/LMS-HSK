import { Suspense } from "react";
import { HanziSetEditorPageContent } from "@/components/management/content-hanzi/hanzi-set-editor-page-content";

// Tạo bộ học kèm danh sách chữ (HSK cũ: HanziCreateSetPage). useSearchParams (packageId/folderId/returnUrl) cần ranh giới Suspense trong App Router.
export default function HanziCreateSetPage() {
  return (
    <Suspense fallback={null}>
      <HanziSetEditorPageContent />
    </Suspense>
  );
}
