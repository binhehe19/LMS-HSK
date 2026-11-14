"use client";
import { lmsClient } from "./lms-client";
import { ApiError } from "./api-client";

export interface StudentSession {
 id: string; classId: string; sessionNo?: number; topic?: string; content?: string;
 startAt?: string; endAt?: string; status?: string; meetingLink?: string;
 scheduleItemId?: string; teacherName?: string; teacher?: { fullName?: string }; myAttendanceStatus?: string;
}
export interface StudentClass {
 id: string; detailError?: string; code?: string; courseId?: string; syllabusId?: string; syllabusName?: string;
 educationLevelCode?: string; startDate?: string; lifecycleStatus?: string; meetingLink?: string;
 totalSessions?: number; completedSessions?: number; sessions?: StudentSession[];
 teacher?: { fullName?: string };
 schedulePatterns?: { dayOfWeek: string; startTime: string; endTime: string }[];
 myAttendanceSummary?: { totalRecorded: number; attendanceRate: number | null };
}
export interface LearningOrbit {
 vocabulary: { total: number; known: number; learning: number; saved: number; due: number };
 achievement: { earnedPoints: number; completedAttempts: number; submissionDays: number; currentStreak: number };
 band: { skills: { key: string; results: { earned: number; total: number; scoreDisplay: string; submittedAt: string; provisional: boolean }[] }[] };
}
export interface PracticeHistory {
 attemptId: string; resourceId: string; status: string; gradingStatus?: string; startedAt?: string; updatedAt?: string; submittedAt?: string;
 earnedPoints?: number; totalPoints?: number; test: { title?: string; assessmentType?: string };
}
export interface DictionarySession {
 lessonId: string; review: boolean; session: { completed: boolean; startedAt?: string; completedAt?: string; stage: number; ids: string[]; known: string[] };
}
export interface SessionHomeworkProgress {
 sessionId: string; sessionNo: number; homeworkProgress: number | null; personalProgress: number | null;
 grammar?: { percent: number | null }; vocabulary?: { percent: number | null; knownWords?: number; totalWords?: number }; quickTest?: { percent: number | null };
}
export interface TimetableAttemptHistory { attempts: { attemptId: string; status: string; gradingStatus: string; submittedAt?: string; earnedPoints: number | null; totalPoints: number | null }[]; }
export interface HomeworkProgress {
 personalProgress: number | null; homeworkDiligence: number | null; averageScore: number | null;
 sessions: { sessionId: string; sessionNo: number; homeworkProgress: number | null; personalProgress: number | null;
 grammar?: { percent: number | null }; vocabulary?: { percent: number | null; knownWords?: number; totalWords?: number }; quickTest?: { percent: number | null } }[];
}
export function arrayResponse<T>(value: unknown): T[] {
 if (!Array.isArray(value)) throw new ApiError("Dữ liệu học sinh trả về không đúng định dạng.", 200);
 return value as T[];
}
export const studentApi = {
 vocabularyStates: (resourceIds:string[])=>lmsClient.post<{learningResourceId:string;comprehensionLevel:string|null}[]>("/user-learning-resources/states",{resourceIds}),
 saveVocabularyState: (resourceId:string,known:boolean)=>lmsClient.put<{learningResourceId:string;comprehensionLevel:string|null}>(`/user-learning-resources/${encodeURIComponent(resourceId)}/vocabulary-state`,{comprehensionLevel:known?"KNOWN":"LEARNING"}),
 classes: async () => arrayResponse<StudentClass>(await lmsClient.get("/me/classes")),
 classDetail: (id: string) => lmsClient.get<StudentClass>(`/me/classes/${encodeURIComponent(id)}`),
 orbit: () => lmsClient.get<LearningOrbit>("/me/learning-orbit?timezone=Asia%2FHo_Chi_Minh"),
 history: async (type: string) => arrayResponse<PracticeHistory>(await lmsClient.get(`/assessment-practice/history?type=${encodeURIComponent(type)}`)),
 dictionarySessions: async (completed: boolean) => arrayResponse<DictionarySession>(await lmsClient.get(`/dictionary/sessions?completed=${completed}`)),
 progress: (id: string) => lmsClient.get<HomeworkProgress>(`/me/classes/${encodeURIComponent(id)}/homework-progress`),
 sessionProgress: (classId: string, sessionId: string) => lmsClient.get<SessionHomeworkProgress>(`/me/classes/${encodeURIComponent(classId)}/sessions/${encodeURIComponent(sessionId)}/homework-progress`),
 attempts: (resourceId: string, sessionId: string) => lmsClient.get<TimetableAttemptHistory>(`/assessment-attempts?learningResourceId=${encodeURIComponent(resourceId)}&sessionId=${encodeURIComponent(sessionId)}`),
 resources: (syllabusId: string, sessionNo: number) => lmsClient.get<Record<string, unknown>>(`/content-packages/syllabus/${encodeURIComponent(syllabusId)}/session-resources?sessionNo=${sessionNo}`),
 attempt: (id:string) => lmsClient.get<Record<string,unknown>>(`/assessment-attempts/${encodeURIComponent(id)}`),
 startAttempt: (input:{sessionId:string;classId:string;sessionNo:number;contentPackageVersionId:string;learningResourceId:string}) => lmsClient.post<Record<string,unknown>>("/assessment-attempts",input),
 startAdminPractice: (input:{learningResourceId:string;contentPackageVersionId:string;sessionNo:number}) => lmsClient.post<Record<string,unknown>>("/assessment-attempts/admin-practice",input),
 adminAttempts: (resourceId:string,versionId:string,sessionNo:number) => lmsClient.get<TimetableAttemptHistory>(`/assessment-attempts/admin-practice?learningResourceId=${encodeURIComponent(resourceId)}&contentPackageVersionId=${encodeURIComponent(versionId)}&sessionNo=${sessionNo}`),
 lockAttempt: (id:string,sessionToken:string) => lmsClient.post<{acquired:boolean}>(`/assessment-attempts/${encodeURIComponent(id)}/lock`,{sessionToken,force:false}),
 releaseAttemptLock: (id:string,sessionToken:string) => lmsClient.delete(`/assessment-attempts/${encodeURIComponent(id)}/lock?sessionToken=${encodeURIComponent(sessionToken)}`),
 submitAttempt: (id:string,sessionToken:string,answers:{questionId:string;answerJson:string}[]) => lmsClient.post<{attemptId:string;answersIgnored:boolean}>(`/assessment-attempts/${encodeURIComponent(id)}/submit`,{sessionToken,answers}),
 result: (id: string) => lmsClient.get<Record<string, unknown>>(`/assessment-attempts/${encodeURIComponent(id)}/result`),
};
