import { Suspense } from "react";
import { InstructorLearningAnalysisDetailPageContent } from "@/components/management/instructor-learning-analysis/instructor-learning-analysis-detail-page-content";

// useSearchParams (classId/courseId/scheduleId/title/userId/studentName) cần ranh giới Suspense trong App Router.
export default function InstructorLearningAnalysisDetailPage() {
  return (
    <Suspense fallback={null}>
      <InstructorLearningAnalysisDetailPageContent />
    </Suspense>
  );
}
