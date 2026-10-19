import dayjs from "dayjs";

// Shared view model for live syllabus/class-session data. Unknown progress stays null.
export interface TimetableModule { attemptId?: string; id: string; title: string; icon: string; kind: "material" | "practice"; progress: number | null; description: string; url?: string; content?: unknown; resourceType?: string; resourceId?: string; subType?: string; skill?: string; packageVersionId?: string; group?: string; publication?: "DRAFT" | "PUBLISHED"; topicTitle?: string; topicOrder?: number; }
export interface TimetableSession {
 id: string; classId: string; classCode: string; courseName: string; teacher: string;
 homeworkProgress?: number | null; personalProgress?: number | null; classPersonalProgress?: number | null; classHomeworkDiligence?: number | null; classAverageScore?: number | null;
 syllabusId?: string; scheduleItemId?: string; content?: string; studentTasks?: string; teacherTasks?: string;
 sessionNo: number; title: string; topic: string; date: string; startTime: string; endTime: string;
 status: "done" | "upcoming" | "cancelled"; access: "full" | "materials-only" | "locked";
 isExam?: boolean; meetingUrl?: string; examUrl?: string; score?: { earned: number; total: number }; pendingGrading?: boolean;
 attendance?: "present" | "absent"; modules: TimetableModule[];
}
export function sessionProgress(session: TimetableSession): number | null {
 if (session.homeworkProgress !== undefined) return session.homeworkProgress;
 const modules=session.modules.filter(module=>module.kind === "practice");
 if (!modules.length || modules.every(module=>module.progress === null)) return null;
 return Math.round(modules.reduce((sum,module)=>sum+(module.progress ?? 0),0)/modules.length);
}
export function getSessionState(session: TimetableSession): "today" | "done" | "upcoming" | "cancelled" | "unscheduled" {
 if (!session.date || !dayjs(session.date).isValid()) return "unscheduled";
 if (session.status === "cancelled") return "cancelled";
 if (dayjs(session.date).isSame(dayjs(),"day")) return "today";
 return session.status === "done" || dayjs(session.date).isBefore(dayjs(),"day") ? "done" : "upcoming";
}

export interface TimetableAttempt { attemptId:string; moduleId:string; title:string; status:string; gradingStatus:string; submittedAt?:string; earnedPoints:number|null; totalPoints:number|null; }
