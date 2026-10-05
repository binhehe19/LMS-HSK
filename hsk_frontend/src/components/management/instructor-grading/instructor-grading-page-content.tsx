"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { InstructorGradingView } from "@/components/management/instructor-grading/instructor-grading-view";
import { useStudentGrading, type StudentGradingData } from "@/components/management/instructor-grading/use-student-grading";
import { useWriteGate } from "@/hooks/use-write-gate";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getGradingAttempt, gradeAnswer, gradeQuestion, sendAttempt } from "@/lib/api/quiz-grading-client";
import { WriteDisabledError } from "@/lib/api/write-gate";
import { summarizeGradingQuestions } from "@/lib/grading/grading-helpers";
import { checkGradingParams, readText, submissionsHref } from "@/lib/grading/grading-params";
import {
  buildSendPlan,
  defaultDraft,
  draftDiffersFromSaved,
  draftKeyOf,
  flattenQuestions,
  groupFlatQuestions,
  moduleAfterGrading,
  moduleAfterSending,
  parseDraftScore,
  resolveDraftScoreNumber,
  totalMaxScoreOf,
  type GradeDraft,
  type IncompleteAttempt,
} from "@/lib/grading/grading-workspace-model";
import type { GradingAttemptDetailResponse, GradingAttemptQuestion, GradingStudentModuleResponse } from "@/types/grading";

/**
 * Chỉnh sửa cục bộ chồng lên dữ liệu đã tải (`base`): chi tiết bài làm sau khi lưu/gửi, module (điểm/trạng thái), bản nháp điểm+nhận xét.
 * Gắn với đúng đối tượng dữ liệu đã tải: tải lại (khoá đổi hoặc "Thử lại") => bản mới => mọi chỉnh sửa cũ tự hết hiệu lực, không cần effect để reset.
 */
interface LocalEdits {
  base: StudentGradingData | null;
  details: Record<string, GradingAttemptDetailResponse>;
  modules: Record<string, GradingStudentModuleResponse>;
  drafts: Record<string, GradeDraft>;
}

const EMPTY_EDITS = { details: {}, modules: {}, drafts: {} } as const;

const errorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof WriteDisabledError || error instanceof ApiNotConfiguredError) return "Chấm bài chưa được tích hợp với backend (WAITING FOR BACKEND).";
  return (error instanceof ApiError && error.message) || fallback;
};

// Màn chấm bài của một học viên trong buổi (HSK cũ: GradingWorkspacePage). Query giữ nguyên hợp đồng cũ: scheduleId, userId, classId, courseId, title, view=detail,
// studentName (`view` chỉ được chuyển tiếp như bản cũ, không đổi hành vi). Thao tác GHI (lưu điểm, gửi kết quả) đi qua công tắc "quiz-grading".
export function InstructorGradingPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { enabled, demo } = useWriteGate("quiz-grading");

  const check = checkGradingParams({ classId: params.get("classId"), scheduleId: params.get("scheduleId"), userId: params.get("userId") });
  const courseId = readText(params.get("courseId"));
  const sessionTitle = readText(params.get("title"));
  const studentName = readText(params.get("studentName")) || "—"; // DTO chi tiết bài làm không mang tên học viên; màn danh sách nộp bài luôn truyền studentName
  const classId = check.kind === "ok" ? check.classId : readText(params.get("classId"));
  const scheduleId = check.kind === "ok" ? check.scheduleId : readText(params.get("scheduleId"));

  const { state, reload } = useStudentGrading(check.kind === "ok" ? { classId: check.classId, scheduleId: check.scheduleId, userId: check.userId } : null);
  const base = state.kind === "ok" ? state.data : null;

  const [edits, setEdits] = useState<LocalEdits>({ base: null, ...EMPTY_EDITS });
  const local: LocalEdits = edits.base === base ? edits : { base, ...EMPTY_EDITS };
  const patch = (fn: (current: LocalEdits) => Partial<Omit<LocalEdits, "base">>) =>
    setEdits((prev) => {
      const current = prev.base === base ? prev : { base, ...EMPTY_EDITS };
      return { ...current, ...fn(current) };
    });

  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const [incompleteWarning, setIncompleteWarning] = useState<IncompleteAttempt[]>([]);

  const details = useMemo(() => (base ? { ...base.details, ...local.details } : {}), [base, local.details]);
  const modules = useMemo(() => (base ? base.modules.map((m) => (m.attemptId ? (local.modules[m.attemptId] ?? m) : m)) : []), [base, local.modules]);
  const localDrafts = local.drafts;
  const getDraft = useCallback((question: GradingAttemptQuestion, attemptId: string): GradeDraft => localDrafts[draftKeyOf(question, attemptId)] ?? defaultDraft(question), [localDrafts]);
  // Như bản cũ: bản nháp chỉ tham gia tổng điểm/kế hoạch gửi khi câu đã có bản ghi trả lời (answerId); câu bỏ trống chỉ được tính sau khi lưu.
  const draftForTotals = useCallback((question: GradingAttemptQuestion, attemptId: string) => (question.answerId ? getDraft(question, attemptId) : undefined), [getDraft]);

  const flatQuestions = useMemo(() => flattenQuestions(modules, details), [modules, details]);
  const questionGroups = useMemo(() => groupFlatQuestions(flatQuestions), [flatQuestions]);
  const sendPlan = useMemo(() => buildSendPlan(modules, details, draftForTotals), [modules, details, draftForTotals]);
  const summary = useMemo(() => summarizeGradingQuestions(flatQuestions.map((item) => item.question)), [flatQuestions]);
  const totalScore = useMemo(
    () => flatQuestions.reduce((sum, item) => sum + resolveDraftScoreNumber(item.question, draftForTotals(item.question, item.module.attemptId as string)), 0),
    [flatQuestions, draftForTotals],
  );
  const totalMaxScore = useMemo(() => totalMaxScoreOf(details), [details]);

  /** Ghi chi tiết bài làm mới nhận từ backend, cập nhật module tương ứng và (tuỳ chọn) bản nháp. */
  const applyDetail = (detail: GradingAttemptDetailResponse, attemptId: string, after: (m: GradingStudentModuleResponse, d: GradingAttemptDetailResponse) => GradingStudentModuleResponse, draftPatch?: Record<string, GradeDraft>) =>
    patch((current) => {
      const id = detail.attemptId || attemptId;
      const stored = { ...detail, attemptId: id };
      const attemptModule = current.modules[id] ?? base?.modules.find((m) => m.attemptId === id);
      return {
        details: { ...current.details, [id]: stored },
        modules: attemptModule ? { ...current.modules, [id]: after(attemptModule, stored) } : current.modules,
        drafts: draftPatch ? { ...current.drafts, ...draftPatch } : current.drafts,
      };
    });

  const setSavingKey = (key: string, value: boolean) => setSaving((p) => ({ ...p, [key]: value }));

  // attemptId truyền riêng vì câu hỏi không mang attemptId — cần cho câu CHƯA có answerId (học viên bỏ trống, hoặc câu mới tách sau khi đã nộp):
  // nhận xét của giáo viên phải luôn lưu được dù học viên có làm bài hay không (backend tự tạo bản ghi trả lời rỗng).
  const saveQuestion = async (question: GradingAttemptQuestion, scoreValue: string, comment: string, attemptId: string): Promise<boolean> => {
    if (!enabled) return false;
    const parsed = parseDraftScore(question, { score: scoreValue });
    if (!parsed.ok) {
      toast.error(parsed.message);
      return false;
    }
    const savingKey = draftKeyOf(question, attemptId);
    setSavingKey(savingKey, true);
    try {
      const body = { teacherScore: parsed.value, teacherComment: comment };
      const updated = question.answerId ? await gradeAnswer(question.answerId, body, demo) : await gradeQuestion(attemptId, question.questionId, body, demo);
      if (!updated || typeof updated !== "object") throw new ApiError("Phản hồi lưu điểm không đúng định dạng.", 200);
      const savedQuestion = updated.questions?.find((q) => q.questionId === question.questionId);
      applyDetail(updated, attemptId, moduleAfterGrading, savedQuestion?.answerId ? { [savedQuestion.answerId]: { score: scoreValue, comment } } : undefined);
      toast.success("Đã lưu điểm câu hỏi");
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "Không lưu được điểm"));
      return false;
    } finally {
      setSavingKey(savingKey, false);
    }
  };

  /**
   * Lưu mọi bản nháp còn khác với điểm đã lưu của một bài trước khi gửi. Trả chi tiết mới nhất, hoặc null khi có lỗi (đã toast).
   * Khác bản cũ: bỏ qua câu đã gửi (returnedAt) — backend từ chối chấm lại câu đã trả (409) và thẻ câu đó đã khoá.
   */
  const persistDirtyDrafts = async (detail: GradingAttemptDetailResponse): Promise<GradingAttemptDetailResponse | null> => {
    const attemptId = detail.attemptId;
    let latest = detail;
    const dirty = (detail.questions || []).filter((q) => q.answerId && !q.returnedAt && draftDiffersFromSaved(q, getDraft(q, attemptId)));
    const savedDrafts: Record<string, GradeDraft> = {};
    for (const question of dirty) {
      const answerId = question.answerId as string;
      const draft = getDraft(question, attemptId);
      const parsed = parseDraftScore(question, draft);
      if (!parsed.ok) {
        toast.error(parsed.message);
        return null;
      }
      setSavingKey(answerId, true);
      try {
        latest = await gradeAnswer(answerId, { teacherScore: parsed.value, teacherComment: draft.comment }, demo);
      } catch (error) {
        toast.error(errorMessage(error, "Không lưu được điểm"));
        return null;
      } finally {
        setSavingKey(answerId, false);
      }
      const savedQuestion = latest.questions?.find((q) => q.answerId === answerId);
      if (savedQuestion) savedDrafts[answerId] = { score: savedQuestion.teacherScore?.toString() ?? "", comment: savedQuestion.teacherComment || "" };
    }
    if (dirty.length > 0) applyDetail(latest, attemptId, moduleAfterGrading, savedDrafts);
    return latest;
  };

  const sendAllResults = async () => {
    if (!enabled || sending) return;
    if (sendPlan.incompleteAttempts.length) setIncompleteWarning(sendPlan.incompleteAttempts);
    if (!sendPlan.readyAttempts.length) return;

    setSending(true);
    try {
      for (const attemptModule of sendPlan.readyAttempts) {
        const attemptId = attemptModule.attemptId as string;
        const detail = details[attemptId];
        if (!detail) continue;

        const persisted = await persistDirtyDrafts(detail);
        if (!persisted) return;

        let updated: GradingAttemptDetailResponse | undefined;
        try {
          updated = await sendAttempt(attemptId, undefined, demo);
        } catch (error) {
          toast.error(errorMessage(error, `Không gửi được "${attemptModule.label}"`));
          return;
        }
        if (!updated?.questions?.length) {
          // Backend có thể chỉ trả xác nhận: tải lại chi tiết để biết câu nào đã có returnedAt (như bản cũ).
          try {
            updated = await getGradingAttempt(attemptId);
          } catch {
            /* giữ phản hồi gửi; trạng thái sẽ đúng ở lần tải sau */
          }
        }
        if (updated) applyDetail(updated, attemptId, moduleAfterSending);
      }
      toast.success("Đã gửi kết quả các câu mới chấm cho học viên");
    } finally {
      setSending(false);
    }
  };

  const handleBack = () => router.push(submissionsHref({ classId, courseId, scheduleId, title: sessionTitle }));

  return (
    <InstructorGradingView
      state={state}
      paramNotice={check.kind === "notice" ? check.notice : null}
      studentName={studentName}
      sessionTitle={sessionTitle}
      writeEnabled={enabled}
      questionGroups={questionGroups}
      questionCount={flatQuestions.length}
      summary={summary}
      totalScore={totalScore}
      totalMaxScore={totalMaxScore}
      sendPlan={sendPlan}
      saving={saving}
      sending={sending}
      incompleteWarning={incompleteWarning}
      getDraft={getDraft}
      onDraftChange={(key, value) => patch((current) => ({ drafts: { ...current.drafts, [key]: value } }))}
      onSaveQuestion={saveQuestion}
      onSendAll={sendAllResults}
      onCloseWarning={() => setIncompleteWarning([])}
      onBack={handleBack}
      onRetry={reload}
    />
  );
}
