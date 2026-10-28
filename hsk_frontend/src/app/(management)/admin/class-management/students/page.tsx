import { Suspense } from "react";
import { AdminClassStudentsPageContent } from "@/components/management/admin-class-students/admin-class-students-page-content";

// useSearchParams (classId) cần ranh giới Suspense trong App Router.
export default function AdminClassStudentsPage() {
  return (
    <Suspense fallback={null}>
      <AdminClassStudentsPageContent />
    </Suspense>
  );
}
