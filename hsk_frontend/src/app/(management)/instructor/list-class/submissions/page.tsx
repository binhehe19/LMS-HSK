import { Suspense } from "react";
import { InstructorSubmissionsPageContent } from "@/components/management/instructor-submissions/instructor-submissions-page-content";

// useSearchParams (classId/courseId/scheduleId/title) cần ranh giới Suspense trong App Router.
export default function InstructorSubmissionsPage() {
  return (
    <Suspense fallback={null}>
      <InstructorSubmissionsPageContent />
    </Suspense>
  );
}
