// Logic thuần của màn chấm bài (HSK cũ: grading-workspace-page.tsx + classGradingApi.getStudentModules): dựng danh sách bài làm từ tóm tắt, trải phẳng
// câu hỏi theo nhóm module, bản nháp điểm/nhận xét, kế hoạch gửi kết quả. Không React, không API.
import { areAllQuestionsReturned, computeAttemptScoreFromQuestions, getDefaultQuestionScore, isQuestionReadyToSend, isQuestionReturnedToStudent } from "@/lib/grading/grading-helpers";
import type { GradingAttemptDetailResponse, GradingAttemptQuestion, GradingAttemptSummaryResponse, GradingStudentModuleResponse } from "@/types/grading";

export type GradeDraft = { score: string; comment: string };

export interface FlatQuestionItem {
  key: string;
  module: GradingStudentModuleResponse;
  detail: GradingAttemptDetailResponse;
  question: GradingAttemptQuestion;
  globalIndex: number;
  isFirstInAttempt: boolean;
}

export interface QuestionGroup {
  key: string;
  name: string;
  order: number;
  items: FlatQuestionItem[];
}

export interface IncompleteAttempt {
  attemptId: string;
  label: string;
  missingQuestionNumbers: number[];
}

export interface SendPlan {
  readyAttempts: GradingStudentModuleResponse[];
  incompleteAttempts: IncompleteAttempt[];
}

/** "#1 Quiz - A. Nghe" => "A. Nghe". */
export const formatSectionName = (name: string): string => name.replace(/^#\d+\s+Quiz\s*-\s*/i, "").trim() || name;

/** Trạng thái hiển thị (chữ thường như HSK cũ) từ trạng thái chấm của backend. */
export const toModuleStatus = (gradingStatus?: string): "returned" | "graded" | "submitted" =>
  gradingStatus === "RETURNED" ? "returned" : gradingStatus === "GRADED" ? "graded" : "submitted";

/**
 * Mỗi bài làm (tóm tắt) thành một "module" của màn chấm (classGradingApi.getStudentModules của HSK cũ). Điểm: tính từ câu hỏi của chi tiết bài làm
 * khi đã có (cùng công thức với lúc lưu điểm — bản cũ gọi thêm getGradingAttempt chỉ để làm việc này), ngược lại finalScore ?? autoScore.
 */
export function modulesFromSummaries(summaries: readonly GradingAttemptSummaryResponse[], details: Readonly<Record<string, GradingAttemptDetailResponse>>): GradingStudentModuleResponse[] {
  return summaries.map((attempt) => {
    const detail = details[attempt.attemptId];
    return {
      moduleId: attempt.attemptId,
      label: attempt.quizTitle || String(attempt.skillType || "Bài làm"),
      submitted: true,
      status: toModuleStatus(attempt.gradingStatus),
      score: detail?.questions?.length ? computeAttemptScoreFromQuestions(detail.questions) : (attempt.finalScore ?? attempt.autoScore ?? 0),
      maxScore: attempt.totalPoints,
      attemptId: attempt.attemptId,
      quizId: attempt.quizId,
      skillType: String(attempt.skillType || ""),
      groupId: attempt.groupId,
      groupName: attempt.groupName,
      groupOrder: attempt.groupOrder,
      quizOrder: attempt.quizOrder,
    };
  });
}

/** Sắp theo thứ tự module rồi thứ tự bài trong module (thiếu groupOrder => cuối). Không đổi mảng gốc. */
export const sortModules = (mods: readonly GradingStudentModuleResponse[]): GradingStudentModuleResponse[] =>
  [...mods].sort((a, b) => {
    const groupOrder = (a.groupOrder ?? Number.MAX_SAFE_INTEGER) - (b.groupOrder ?? Number.MAX_SAFE_INTEGER);
    if (groupOrder !== 0) return groupOrder;
    return (a.quizOrder ?? 0) - (b.quizOrder ?? 0);
  });

/** Trải phẳng mọi câu hỏi của các bài đã nộp (có chi tiết) theo thứ tự module; đánh số liên tục toàn buổi. */
export function flattenQuestions(modules: readonly GradingStudentModuleResponse[], details: Readonly<Record<string, GradingAttemptDetailResponse>>): FlatQuestionItem[] {
  const items: FlatQuestionItem[] = [];
  let globalIndex = 0;
  let lastAttemptId = "";
  sortModules(modules.filter((m) => m.submitted && m.attemptId)).forEach((module) => {
    const attemptId = module.attemptId as string;
    const detail = details[attemptId];
    if (!detail) return;
    (detail.questions || []).forEach((question, qi) => {
      items.push({ key: question.answerId || `${attemptId}-${qi}`, module, detail, question, globalIndex: globalIndex++, isFirstInAttempt: attemptId !== lastAttemptId });
      lastAttemptId = attemptId;
    });
  });
  return items;
}

/** Gom câu theo module (groupId, rơi về skillType, rồi "other"); sắp theo groupOrder. */
export function groupFlatQuestions(items: readonly FlatQuestionItem[]): QuestionGroup[] {
  const groups = new Map<string, QuestionGroup>();
  items.forEach((item) => {
    const key = item.module.groupId || item.module.skillType || "other";
    let group = groups.get(key);
    if (!group) {
      group = { key, name: item.module.groupName || item.module.skillType || "Khác", order: item.module.groupOrder ?? Number.MAX_SAFE_INTEGER, items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  });
  return Array.from(groups.values()).sort((a, b) => a.order - b.order);
}

/** Khoá bản nháp của một câu: answerId nếu đã có bản ghi trả lời, ngược lại `${attemptId}:${questionId}` (câu học viên bỏ trống). */
export const draftKeyOf = (question: Pick<GradingAttemptQuestion, "answerId" | "questionId">, attemptId: string): string => question.answerId || `${attemptId}:${question.questionId}`;

/** Bản nháp ban đầu của một câu (buildDrafts của HSK cũ). */
export const defaultDraft = (question: GradingAttemptQuestion): GradeDraft => ({ score: getDefaultQuestionScore(question), comment: question.teacherComment || "" });

/** Bản nháp khác với điểm/nhận xét đã lưu trên bản ghi trả lời. */
export const draftDiffersFromSaved = (question: GradingAttemptQuestion, draft?: GradeDraft): boolean => {
  if (!draft) return false;
  const savedScore = question.teacherScore?.toString() ?? "";
  const savedComment = question.teacherComment || "";
  return draft.score !== savedScore || draft.comment !== savedComment;
};

export const SCORE_RANGE_ERROR = "Điểm không hợp lệ (0 đến điểm tối đa)";

/** Điểm từ ô nhập: rỗng => null (xoá điểm GV); phải là số trong [0, maxScore]. */
export function parseDraftScore(question: Pick<GradingAttemptQuestion, "maxScore">, draft: Pick<GradeDraft, "score">): { ok: true; value: number | null } | { ok: false; message: string } {
  const maxScore = question.maxScore ?? 0;
  const parsed = draft.score === "" ? null : Number(draft.score);
  if (parsed !== null && (Number.isNaN(parsed) || parsed < 0 || parsed > maxScore)) return { ok: false, message: SCORE_RANGE_ERROR };
  return { ok: true, value: parsed };
}

/** Điểm số đang hiển thị của một câu: ưu tiên bản nháp, rồi điểm mặc định. */
export const resolveDraftScoreNumber = (question: GradingAttemptQuestion, draft?: GradeDraft): number => {
  const raw = draft?.score ?? getDefaultQuestionScore(question);
  if (raw === "") return 0;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const computeAttemptMaxScore = (detail: Pick<GradingAttemptDetailResponse, "questions">): number => (detail.questions || []).reduce((sum, q) => sum + (q.maxScore ?? 0), 0);

/** Tổng điểm tối đa của buổi: totalPoints của từng bài, thiếu thì cộng maxScore các câu. */
export const totalMaxScoreOf = (details: Readonly<Record<string, GradingAttemptDetailResponse>>): number =>
  Object.values(details).reduce((sum, detail) => sum + (detail.totalPoints ?? computeAttemptMaxScore(detail)), 0);

/**
 * Kế hoạch gửi kết quả: bài có câu chưa gửi mà TẤT CẢ đều sẵn sàng (có điểm GV/bản nháp/máy chấm) => gửi; bài còn câu thiếu điểm => cảnh báo kèm số câu.
 * `getDraft(question, attemptId)` trả bản nháp hiện tại của câu.
 */
export function buildSendPlan(
  modules: readonly GradingStudentModuleResponse[],
  details: Readonly<Record<string, GradingAttemptDetailResponse>>,
  getDraft: (question: GradingAttemptQuestion, attemptId: string) => GradeDraft | undefined,
): SendPlan {
  const readyAttempts: GradingStudentModuleResponse[] = [];
  const incompleteAttempts: IncompleteAttempt[] = [];

  sortModules(modules.filter((module) => module.submitted && module.attemptId)).forEach((module) => {
    const attemptId = module.attemptId as string;
    const detail = details[attemptId];
    if (!detail?.questions?.length) return;

    const missingQuestionNumbers: number[] = [];
    let hasNewGradedQuestion = false;
    detail.questions.forEach((question, index) => {
      if (isQuestionReturnedToStudent(question, module, detail.questions)) return;
      if (isQuestionReadyToSend(question, question.answerId ? getDraft(question, attemptId) : undefined)) hasNewGradedQuestion = true;
      else missingQuestionNumbers.push(index + 1);
    });

    if (missingQuestionNumbers.length) {
      incompleteAttempts.push({ attemptId, label: `${formatSectionName(module.groupName || module.skillType || "Bài tập")} — ${module.label}`, missingQuestionNumbers });
    } else if (hasNewGradedQuestion) {
      readyAttempts.push(module);
    }
  });

  return { readyAttempts, incompleteAttempts };
}

/** Module sau khi bài làm được cập nhật (lưu điểm): điểm tính lại từ câu hỏi, "submitted" => "graded". */
export function moduleAfterGrading(module: GradingStudentModuleResponse, detail: GradingAttemptDetailResponse): GradingStudentModuleResponse {
  return {
    ...module,
    score: computeAttemptScoreFromQuestions(detail.questions || []),
    maxScore: detail.totalPoints ?? module.maxScore,
    status: module.status === "submitted" ? "graded" : module.status,
  };
}

/** Module sau khi gửi kết quả: "returned" nếu mọi câu đã có returnedAt, ngược lại "graded". */
export function moduleAfterSending(module: GradingStudentModuleResponse, detail: GradingAttemptDetailResponse): GradingStudentModuleResponse {
  return { ...module, status: areAllQuestionsReturned(detail.questions || []) ? "returned" : "graded", score: computeAttemptScoreFromQuestions(detail.questions || []) };
}
