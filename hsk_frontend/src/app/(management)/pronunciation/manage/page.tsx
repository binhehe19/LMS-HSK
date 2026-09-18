import { Suspense } from "react";
import { PronunciationManagePageContent } from "@/components/management/content-pronunciation/pronunciation-manage-page-content";

// Mục menu "Quản lý Luyện Phát âm" (HSK cũ: ManagePronunciation). useSearchParams (packageId/folderId/studySetId) cần ranh giới Suspense trong App Router.
export default function PronunciationManagePage() {
  return (
    <Suspense fallback={null}>
      <PronunciationManagePageContent />
    </Suspense>
  );
}
