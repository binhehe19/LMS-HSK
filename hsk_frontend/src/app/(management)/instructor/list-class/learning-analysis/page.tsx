import { Suspense } from "react";
import { InstructorLearningAnalysisPageContent } from "@/components/management/instructor-learning-analysis/instructor-learning-analysis-page-content";

// useSearchParams (classId/courseId/scheduleId/title) cần ranh giới Suspense trong App Router.
export default function InstructorLearningAnalysisPage() {
  return (
    <Suspense fallback={null}>
      <InstructorLearningAnalysisPageContent />
    </Suspense>
  );
}
