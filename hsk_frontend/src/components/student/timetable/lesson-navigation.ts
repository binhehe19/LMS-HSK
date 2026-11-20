export const LESSON_ACTIVITIES = [
 { key: "slides", label: "Tài liệu học tập - Slides", shortLabel: "Tài liệu học tập", chinese: "", icon: "tailieu", type: "SLIDES" },
 { key: "listening", label: "Phần Nghe", shortLabel: "Nghe", chinese: "听力", icon: "nghe", type: "LISTENING" },
 { key: "reading", label: "Phần Đọc", shortLabel: "Đọc", chinese: "阅读", icon: "doc", type: "READING" },
 { key: "writing", label: "Phần Viết", shortLabel: "Viết", chinese: "写作", icon: "viet", type: "WRITING" },
 { key: "speaking", label: "Phần Nói", shortLabel: "Nói", chinese: "口语", icon: "noi", type: "SPEAKING" },
] as const;
export type LessonActivity = typeof LESSON_ACTIVITIES[number]["key"];
type LessonMaterialTab = "grammar" | "vocabulary" | "flashcards" | "handwriting";
export function lessonActivity(value: string | null): typeof LESSON_ACTIVITIES[number] {
 return LESSON_ACTIVITIES.find(item=>item.key === value || item.type === value) ?? LESSON_ACTIVITIES[0];
}
export function lessonHref(input: { scheduleId: string; classId: string; sessionId: string }, tab: LessonActivity | LessonMaterialTab): string {
 const query=new URLSearchParams({classId:input.classId,sessionId:input.sessionId,tab});
 return `/learning-path/online-course/homework/${encodeURIComponent(input.scheduleId)}?${query}`;
}
export function safeTimetableReturn(value: string | null, classId?: string): string {
 const fallback = classId ? `/student/student-timetable?${new URLSearchParams({ classId })}` : "/student/student-timetable";
 if(!value || value.includes("\\") || value.includes("\r") || value.includes("\n"))return fallback;
 try{const url=new URL(value,"http://localhost");return value.startsWith("/") && url.origin === "http://localhost" && url.pathname === "/student/student-timetable" ? url.pathname+url.search : fallback;}catch{return fallback;}
}
