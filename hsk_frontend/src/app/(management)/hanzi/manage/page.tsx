import { Suspense } from "react";
import { HanziManagePageContent } from "@/components/management/content-hanzi/hanzi-manage-page-content";

// Mục menu "Quản lý Luyện viết (Hán tự)" (HSK cũ: ManageHanzi). useSearchParams (packageId/folderId/studySetId) cần ranh giới Suspense trong App Router.
export default function HanziManagePage() {
  return (
    <Suspense fallback={null}>
      <HanziManagePageContent />
    </Suspense>
  );
}
