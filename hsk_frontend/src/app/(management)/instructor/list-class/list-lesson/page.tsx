import { Suspense } from "react";
import { InstructorLessonListPageContent } from "@/components/management/instructor-lesson-list/instructor-lesson-list-page-content";

// useSearchParams (classId/courseId/page) cần ranh giới Suspense trong App Router.
export default function InstructorLessonListPage() {
  return (
    <Suspense fallback={null}>
      <InstructorLessonListPageContent />
    </Suspense>
  );
}
