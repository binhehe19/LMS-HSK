import type { Metadata } from "next";
import StudentDashboard from "@/components/student/dashboard/student-dashboard";

export const metadata: Metadata = { title: "Bảng điều khiển học sinh | Học Bá" };

export default function StudentDashboardPage() {
  return <StudentDashboard />;
}
