import { Suspense } from "react";
import { InstructorGradingPageContent } from "@/components/management/instructor-grading/instructor-grading-page-content";

// useSearchParams (scheduleId/userId/classId/courseId/title/view/studentName) cần ranh giới Suspense trong App Router.
export default function InstructorGradingPage() {
  return (
    <Suspense fallback={null}>
      <InstructorGradingPageContent />
    </Suspense>
  );
}
