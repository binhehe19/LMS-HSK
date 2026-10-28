import { HanziSelectTypePageContent } from "@/components/management/content-hanzi/hanzi-select-type-page-content";

// Chọn loại gói luyện viết (HSK cũ: HanziSelectTypePage — chuyển hướng về /hanzi/manage). Không đọc query nên không cần Suspense.
export default function HanziSelectTypePage() {
  return <HanziSelectTypePageContent />;
}
