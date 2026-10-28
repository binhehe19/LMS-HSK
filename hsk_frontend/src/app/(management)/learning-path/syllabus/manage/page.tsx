import { Suspense } from "react";
import { SyllabusManagePageContent } from "@/components/management/syllabus/syllabus-manage-page-content";

// useSearchParams (?view=&tab=) cần ranh giới Suspense trong App Router.
export default function SyllabusManagePage() {
  return (
    <Suspense fallback={null}>
      <SyllabusManagePageContent />
    </Suspense>
  );
}
