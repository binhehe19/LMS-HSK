import { Suspense } from "react";
import { InstructorLessonDetailPageContent } from "@/components/management/instructor-lesson-detail/instructor-lesson-detail-page-content";

// useSearchParams (classId/courseId/scheduleId/title) cần ranh giới Suspense trong App Router.
export default function InstructorLessonDetailPage() {
  return (
    <Suspense fallback={null}>
      <InstructorLessonDetailPageContent />
    </Suspense>
  );
}
