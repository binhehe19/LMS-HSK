import type { StudentClass, StudentSession } from "@/lib/api/student-client";
export function safeMeetingUrl(value?: string | null): string | null {
 if (!value) return null;
 try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function upcomingSession(classes: StudentClass[], now = Date.now()): (StudentSession & { class_name: string }) | null {
 return classes.flatMap(course => (course.sessions ?? []).filter(session => session.status !== "CANCELLED" && session.status !== "DONE" && !!session.startAt && Date.parse(session.startAt) > now).map(session => ({ ...session, meetingLink: session.meetingLink || course.meetingLink, class_name: course.code || course.syllabusName || "Lớp học" })))
 .sort((a,b) => Date.parse(a.startAt!) - Date.parse(b.startAt!))[0] ?? null;
}
export function courseStats(course?: StudentClass) {
 const total = course?.totalSessions ?? 0;
 const completed = course?.completedSessions ?? 0;
 return { total, completed, percent: total > 0 ? Math.min(100, Math.round(completed / total * 1000) / 10) : 0 };
}
