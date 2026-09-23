import type { Metadata } from "next";
import StudentPage from "@/components/student/student-wishlist";
export const metadata: Metadata = { title: "Danh sách yêu thích | Học Bá" };
export default function Page() { return <StudentPage />; }
