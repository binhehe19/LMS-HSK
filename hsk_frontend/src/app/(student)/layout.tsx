import type { ReactNode } from "react";
import StudentAuth from "@/components/student/student-auth";
export default function StudentLayout({ children }: { children: ReactNode }) { return <StudentAuth>{children}</StudentAuth>; }
