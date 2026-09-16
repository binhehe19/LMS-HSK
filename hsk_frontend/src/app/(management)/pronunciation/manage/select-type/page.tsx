import { PronunciationSelectTypePageContent } from "@/components/management/content-pronunciation/pronunciation-select-type-page-content";

// HSK cũ: PronunciationSelectTypePage = <Navigate to="/pronunciation/manage" replace />. Giữ URL cũ, chuyển hướng về màn quản lý.
export default function PronunciationSelectTypePage() {
  return <PronunciationSelectTypePageContent />;
}
