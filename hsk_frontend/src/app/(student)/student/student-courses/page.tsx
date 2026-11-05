import type { Metadata } from "next";
import StudentPage from "@/components/student/student-courses";
export const metadata: Metadata = { title: "Khóa học của tôi | Học Bá" };
export default function Page() { return <StudentPage />; }
