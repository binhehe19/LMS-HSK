import type { Metadata } from "next";
import StudentPage from "@/components/student/student-study-history";
export const metadata: Metadata = { title: "Lịch sử ôn luyện | Học Bá" };
export default function Page() { return <StudentPage />; }
