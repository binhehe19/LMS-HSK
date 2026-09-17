import { Suspense } from "react";
import { QuizManagePageContent } from "@/components/management/content-quiz/quiz-manage-page-content";

// /quiz/manage của HSK cũ (ManageQuiz): cây Gói → Thư mục → Bộ đề → Bài tập (+ trình soạn câu hỏi khi có ?quizId=).
export default function QuizManagePage() {
  return (
    <Suspense fallback={null}>
      <QuizManagePageContent />
    </Suspense>
  );
}
