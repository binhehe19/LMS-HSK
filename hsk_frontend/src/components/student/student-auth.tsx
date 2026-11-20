"use client";
import type { ReactNode } from "react";
import { ConfigProvider } from "antd";
import { desktopTheme } from "@/theme/brand-tokens";
import { AuthInitializer } from "@/components/auth/auth-initializer";
import { RequireAuth } from "@/components/auth/require-auth";
import { StudentDataProvider } from "./student-data";
import { useStudentDesktop } from "./use-student-desktop";
export default function StudentAuth({ children }: { children: ReactNode }) {
 const desktop = useStudentDesktop();
 return <AuthInitializer><RequireAuth><ConfigProvider theme={desktop ? desktopTheme : undefined}><StudentDataProvider>{children}</StudentDataProvider></ConfigProvider></RequireAuth></AuthInitializer>;
}
