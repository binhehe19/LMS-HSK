import { Suspense } from "react";
import type { Metadata } from "next";
import StudentTimetable from "@/components/student/timetable/student-timetable";
export const metadata: Metadata = { title: "Thời khóa biểu | Học Bá" };
export default function Page() { return <Suspense fallback={<p role="status">Đang tải thời khóa biểu…</p>}><StudentTimetable /></Suspense>; }
