"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { useContentAccess } from "@/hooks/use-content-access";
import { useWriteGate } from "@/hooks/use-write-gate";
import { getQuizResource, saveQuizQuestions } from "@/lib/api/lms-quiz-client";
import { writeErrorMessage } from "@/lib/content/content-tree-validate";
import { normalizeQuestionInput, questionSummary, validateQuestionInput, type QuizQuestionInput } from "@/lib/content/quiz-question";
import type { QuizItem, QuizQuestion } from "@/types/content-quiz";

/**
 * Logic trình soạn CÂU HỎI của một bài tập (QuizItem) trên nền phẳng: câu hỏi nằm trong content của resource
 * (QuizContent.questions), không có endpoint riêng cho từng câu hỏi — mọi thao tác Thêm/Sửa/Xoá đọc lại toàn bộ
 * nội dung quiz (metadata + mảng câu hỏi) rồi PUT lại cả mảng qua saveQuizQuestions (đã xác nhận với người phụ trách).
 * Cùng quy ước: quyền theo ticket QUIZ + công tắc ghi "content"; lỗi tải là trạng thái; sau khi ghi tải lại từ máy chủ;
 * khoá chống bấm đúp.
 */
export function useQuizQuestions(packageId: string, quizId: string) {
  const access = useContentAccess("QUIZ");
  const { enabled: writeEnabled, demo } = useWriteGate("content");
  const canWrite = access.canManage && writeEnabled;

  const resource = useKeyedFetch(`quiz-resource:${packageId}:${quizId}`, () => getQuizResource(packageId, quizId));

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

  const quiz: QuizItem | null = resource.state.kind === "ok" ? resource.state.data.item : (resource.lastData?.item ?? null);
  const questions: QuizQuestion[] = resource.state.kind === "ok" ? resource.state.data.questions : (resource.lastData?.questions ?? []);
  const packageName = resource.state.kind === "ok" ? resource.state.data.packageName : (resource.lastData?.packageName ?? null);

  const saveQuestion = async (input: QuizQuestionInput, editing: QuizQuestion | null): Promise<boolean> => {
    const invalid = validateQuestionInput(input);
    if (invalid) {
      toast.error(invalid);
      return false;
    }
    if (!quiz) return false;
    const body = normalizeQuestionInput(input);
    const next: QuizQuestion = editing
      ? { ...editing, ...body, id: editing.id, quizId, index: editing.index }
      : { ...body, id: crypto.randomUUID(), quizId, index: questions.length };
    const list = editing ? questions.map((q) => (q.id === editing.id ? next : q)) : [...questions, next];
    const result = await run(editing ? "Cập nhật câu hỏi thất bại" : "Không thể thêm câu hỏi", () => saveQuizQuestions(packageId, quizId, quiz, list, demo));
    if (!result) return false;
    toast.success(editing ? "Đã cập nhật!" : "Đã thêm!");
    resource.reload();
    return true;
  };

  const removeQuestion = async (question: QuizQuestion): Promise<boolean> => {
    if (!quiz) return false;
    const list = questions.filter((q) => q.id !== question.id);
    const result = await run("Xóa câu hỏi thất bại", () => saveQuizQuestions(packageId, quizId, quiz, list, demo));
    if (result === null) return false;
    toast.success(`Đã xóa câu hỏi "${questionSummary(question)}"`);
    resource.reload();
    return true;
  };

  return {
    access,
    writeEnabled,
    canWrite,
    busy,
    state: resource.state,
    quiz,
    questions,
    packageName,
    reload: resource.reload,
    saveQuestion,
    removeQuestion,
  };
}
