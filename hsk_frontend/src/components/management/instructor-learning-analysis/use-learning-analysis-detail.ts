"use client";

import { toast } from "sonner";
import { type FetchState, useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getAttendanceAnalysis, getLatestTeacherNote, getPersonalization } from "@/lib/api/learning-analysis-client";
import { getLessonDetail, listScheduleStudents, listStudentAttempts } from "@/lib/api/quiz-grading-client";
import { buildAssignments, normalizeAttendanceAnalysis, skillScores } from "@/lib/learning-analysis/learning-analysis-model";
import type { LearningAnalysisDetailParams } from "@/lib/learning-analysis/learning-analysis-params";
import type { AttendanceAnalysisResponse, LearningAnalysisAssignment, PersonalizationView, SkillScorePoint, TeacherNoteResponse } from "@/types/learning-analysis";

export interface LearningAnalysisDetailData {
  assignments: FetchState<LearningAnalysisAssignment[]>;
  attendance: FetchState<AttendanceAnalysisResponse>;
  skills: FetchState<SkillScorePoint[]>;
  personalization: FetchState<PersonalizationView>;
  note: FetchState<TeacherNoteResponse | null>;
  reload: { assignments: () => void; attendance: () => void; skills: () => void; personalization: () => void; note: () => void };
}

const contractError = (what: string) => new ApiError(`Dữ liệu trả về không đúng định dạng ${what}.`, 200);

/**
 * Năm nguồn dữ liệu của màn chi tiết, mỗi nguồn một trạng thái riêng (bản cũ gom Promise.all và IM LẶNG bỏ qua lỗi chuyên cần/kỹ năng/AI; ở đây từng
 * khối hiện waiting/error + Thử lại). Khoá theo (classId, scheduleId, userId[, title]) nên đổi học viên => không lẫn dữ liệu. `params = null` => không gọi API.
 * Bài tập của buổi = lesson-detail ⨝ attempts đã nộp (như `getAssignments` cũ, nhưng attempts lỗi cũng là lỗi — bản cũ coi như "chưa nộp gì").
 */
export function useLearningAnalysisDetail(params: LearningAnalysisDetailParams | null): LearningAnalysisDetailData {
  const classId = params?.classId ?? "";
  const scheduleId = params?.scheduleId ?? "";
  const userId = params?.userId ?? "";
  const title = params?.title ?? "";
  const scope = params === null ? null : `${classId}|${scheduleId}|${userId}`;
  const key = (name: string) => (scope === null ? null : `la-${name}:${scope}`);

  const assignments = useKeyedFetch<LearningAnalysisAssignment[]>(scope === null ? null : `${key("assignments")}|${title}`, async () => {
    try {
      const [lesson, attempts] = await Promise.all([getLessonDetail(scheduleId, classId, title), listStudentAttempts(scheduleId, userId, classId)]);
      if (!lesson || typeof lesson !== "object" || !Array.isArray(lesson.modules)) throw contractError("chi tiết bài học");
      if (!Array.isArray(attempts)) throw contractError("danh sách bài làm");
      return buildAssignments(lesson, attempts);
    } catch (error) {
      if (!(error instanceof ApiNotConfiguredError)) toast.error((error instanceof ApiError && error.message) || "Không tải được bài tập của buổi"); // như bản cũ
      throw error;
    }
  });

  const attendance = useKeyedFetch<AttendanceAnalysisResponse>(key("attendance"), async () => {
    const data = normalizeAttendanceAnalysis(await getAttendanceAnalysis(classId, scheduleId, userId));
    if (!data) throw contractError("chuyên cần");
    return data;
  });

  const skills = useKeyedFetch<SkillScorePoint[]>(key("skills"), async () => {
    const students = await listScheduleStudents(scheduleId, classId);
    if (!Array.isArray(students)) throw contractError("danh sách học viên");
    return skillScores(students, userId);
  });

  const personalization = useKeyedFetch<PersonalizationView>(key("personalization"), () => getPersonalization(scheduleId, userId, classId));

  const note = useKeyedFetch<TeacherNoteResponse | null>(key("note"), () => getLatestTeacherNote(classId, scheduleId, userId));

  return {
    assignments: assignments.state,
    attendance: attendance.state,
    skills: skills.state,
    personalization: personalization.state,
    note: note.state,
    reload: { assignments: assignments.reload, attendance: attendance.reload, skills: skills.reload, personalization: personalization.reload, note: note.reload },
  };
}
