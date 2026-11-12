import { Suspense } from "react";
import type { Metadata } from "next";
import LessonWorkspace from "@/components/student/timetable/lesson-workspace";
export const metadata: Metadata = { title: "Bài học | Học Bá" };
export default function Page() { return <Suspense fallback={<p role="status">Đang tải bài học…</p>}><LessonWorkspace /></Suspense>; }
