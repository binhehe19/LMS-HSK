"use client";
import type { ReactNode } from "react";
import { AuthInitializer } from "@/components/auth/auth-initializer";
import { RequireAuth } from "@/components/auth/require-auth";
import { StudentDataProvider } from "./student-data";
export default function StudentAuth({ children }: { children: ReactNode }) {
 return <AuthInitializer><RequireAuth><StudentDataProvider>{children}</StudentDataProvider></RequireAuth></AuthInitializer>;
}
