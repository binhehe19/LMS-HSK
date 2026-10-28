// WAITING FOR BACKEND — cấp CÂU HỎI của module Bài tập theo HỢP ĐỒNG ĐỀ XUẤT kế thừa quiz.service.ts của LMS_Frontend cũ:
//   GET/POST /quiz/questions/{quizId} (bản cũ: GET /quiz/questions/quiz/{quizId} + POST /quiz/questions/{quizId}), PUT/DELETE /quiz/questions/{id};
//   GET /quiz/quizzes/{id} đọc một quiz (tiêu đề/media đoạn đọc cho trình soạn câu hỏi). Cấp gói/thư mục/bộ đề/quiz dùng content-tree-client (generic).
// Mock: scripts/mock/handlers/content-tree.mjs (phần `questions`). Thao tác GHI qua công tắc an toàn "content" (lib/api/write-gate.ts).
"use client";

import { hskClient } from "@/lib/api/hsk-client";
import { assertWriteEnabled } from "@/lib/api/write-gate";
import type { QuizItem, QuizQuestion, QuizQuestionBody } from "@/types/content-quiz";

const PREFIX = "/quiz";
const enc = encodeURIComponent;

export function getQuiz(quizId: string) {
  return hskClient.get<QuizItem>(`${PREFIX}/quizzes/${enc(quizId)}`);
}

/** Câu hỏi của một quiz theo `index` tăng dần. */
export function listQuestions(quizId: string) {
  return hskClient.get<QuizQuestion[]>(`${PREFIX}/questions/${enc(quizId)}`);
}

export function createQuestion(quizId: string, body: QuizQuestionBody, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.post<QuizQuestion>(`${PREFIX}/questions/${enc(quizId)}`, body);
}

/** PUT thay toàn bộ trường nội dung của câu hỏi (trường của loại khác bị bỏ). */
export function updateQuestion(questionId: string, body: QuizQuestionBody, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.put<QuizQuestion>(`${PREFIX}/questions/${enc(questionId)}`, body);
}

export function deleteQuestion(questionId: string, demoActive: boolean) {
  assertWriteEnabled("content", demoActive);
  return hskClient.delete<unknown>(`${PREFIX}/questions/${enc(questionId)}`);
}
