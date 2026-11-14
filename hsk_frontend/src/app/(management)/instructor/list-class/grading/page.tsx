import { Suspense } from "react";
import { GradingPageEntry } from "@/components/management/instructor-grading/grading-page-entry";

// useSearchParams (scheduleId/userId/classId/courseId/title/view/studentName) cần ranh giới Suspense trong App Router.
export default function InstructorGradingPage() {
  return (
    <Suspense fallback={null}>
      <GradingPageEntry />
    </Suspense>
  );
}
