import { Suspense } from "react";
import { HanziCreatePackagePageContent } from "@/components/management/content-hanzi/hanzi-create-package-page-content";

// Tạo gói luyện viết (HSK cũ: HanziCreatePackage). useSearchParams (?type=) cần ranh giới Suspense trong App Router.
export default function HanziCreatePackagePage() {
  return (
    <Suspense fallback={null}>
      <HanziCreatePackagePageContent />
    </Suspense>
  );
}
