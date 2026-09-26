import type { Metadata } from "next";
import StudentPage from "@/components/student/student-profile";
export const metadata: Metadata = { title: "Hồ sơ của tôi | Học Bá" };
export default function Page() { return <StudentPage />; }
