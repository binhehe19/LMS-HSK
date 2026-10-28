"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { QUIZ_API_TARGET } from "@/components/management/content-quiz/quiz-config";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { useContentAccess } from "@/hooks/use-content-access";
import { useWriteGate } from "@/hooks/use-write-gate";
import { ApiError } from "@/lib/api/api-client";
import { getStudySet } from "@/lib/api/content-tree-client";
import { createQuestion, deleteQuestion, getQuiz, listQuestions, updateQuestion } from "@/lib/api/quiz-question-client";
import { writeErrorMessage } from "@/lib/content/content-tree-validate";
import { normalizeQuestionInput, questionSummary, type QuizQuestionInput, sortQuestions, validateQuestionInput } from "@/lib/content/quiz-question";
import type { ContentStudySet } from "@/types/content";
import type { QuizItem, QuizQuestion } from "@/types/content-quiz";

/**
 * Logic cấp CÂU HỎI của manage-quiz.tsx cũ (level "questions"): quiz đang soạn, danh sách câu hỏi, bộ đề cha (cho breadcrumb) và các thao tác ghi.
 * Cùng quy ước với useContentTree: quyền theo ticket QUIZ + công tắc ghi "content"; lỗi tải là trạng thái; sau khi ghi tải lại từ máy chủ;
 * khoá chống bấm đúp. Khác bản cũ có chủ đích: câu hỏi đọc bằng GET /quiz/questions/{quizId} (bản cũ đọc kèm trong GET /quizzes/{id}).
 */
export function useQuizQuestions(quizId: string, studySetId: string | null) {
  const access = useContentAccess("QUIZ");
  const { enabled: writeEnabled, demo } = useWriteGate("content");
  const canWrite = access.canManage && writeEnabled;

  const quiz = useKeyedFetch<QuizItem>(`quiz:${quizId}`, () => getQuiz(quizId));
  const questions = useKeyedFetch<QuizQuestion[]>(`quiz-questions:${quizId}`, async () => {
    const data = await listQuestions(quizId);
    if (!Array.isArray(data)) throw new ApiError("Dữ liệu trả về không đúng định dạng danh sách câu hỏi.", 200, "CONTRACT");
    return data;
  });
  const studySet = useKeyedFetch<ContentStudySet>(studySetId ? `quiz-set:${studySetId}` : null, () => getStudySet(QUIZ_API_TARGET, studySetId ?? ""));

  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const run = async <T,>(fallback: string, work: () => Promise<T>): Promise<T | null> => {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    try {
      return await work();
    } catch (error) {
      toast.error(writeErrorMessage(error, fallback));
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const questionList = questions.state.kind === "ok" ? sortQuestions(questions.state.data) : [];

  const saveQuestion = async (input: QuizQuestionInput, editing: QuizQuestion | null): Promise<boolean> => {
    const invalid = validateQuestionInput(input);
    if (invalid) {
      toast.error(invalid);
      return false;
    }
    const body = normalizeQuestionInput(input);
    const result = editing
      ? await run("Cập nhật câu hỏi thất bại", () => updateQuestion(editing.id, { ...body, index: editing.index }, demo))
      : await run("Không thể thêm câu hỏi", () => createQuestion(quizId, { ...body, index: questionList.length }, demo));
    if (!result) return false;
    toast.success(editing ? "Đã cập nhật!" : "Đã thêm!");
    questions.reload();
    quiz.reload(); // questionCount
    return true;
  };

  const removeQuestion = async (question: QuizQuestion): Promise<boolean> => {
    const result = await run("Xóa câu hỏi thất bại", () => deleteQuestion(question.id, demo));
    if (result === null) return false;
    toast.success(`Đã xóa câu hỏi "${questionSummary(question)}"`);
    questions.reload();
    quiz.reload();
    return true;
  };

  return {
    access,
    writeEnabled,
    canWrite,
    busy,
    quizState: quiz.state,
    quiz: quiz.state.kind === "ok" ? quiz.state.data : (quiz.lastData ?? null),
    questionsState: questions.state,
    questions: questionList,
    studySetTitle: studySet.state.kind === "ok" ? studySet.state.data.title : null,
    reloadQuestions: questions.reload,
    reloadQuiz: quiz.reload,
    saveQuestion,
    removeQuestion,
  };
}
