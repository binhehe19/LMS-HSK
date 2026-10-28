"use client";

import { useSearchParams } from "next/navigation";
import { QUIZ_CONFIG, QUIZ_ID_PARAM } from "@/components/management/content-quiz/quiz-config";
import { QuizQuestionEditorPageContent } from "@/components/management/content-quiz/quiz-question-editor-page-content";
import { ContentTreeManager } from "@/components/management/content-tree/content-tree-manager";
import { readId, readTreeLocation } from "@/lib/content/content-tree-params";

/**
 * Màn "Quản lý Bài tập" (/quiz/manage, ManageQuiz của HSK cũ): 4 cấp đầu dùng nền content-tree với QUIZ_CONFIG; khi URL có `quizId` hợp lệ
 * thì hiện trình soạn câu hỏi (cấp 5 của bản cũ) ở cùng đường dẫn, nên reload/back vẫn giữ đúng chỗ (bản cũ giữ cấp trong useState).
 */
export function QuizManagePageContent() {
  const params = useSearchParams();
  const quizId = readId(params.get(QUIZ_ID_PARAM));
  if (quizId) return <QuizQuestionEditorPageContent quizId={quizId} location={readTreeLocation(params)} />;
  return <ContentTreeManager config={QUIZ_CONFIG} />;
}
