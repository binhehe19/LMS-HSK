"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { QuizQuestionEditorView } from "@/components/management/content-quiz/quiz-question-editor-view";
import { QuizQuestionModal } from "@/components/management/content-quiz/quiz-question-modal";
import { useQuizQuestions } from "@/components/management/content-quiz/use-quiz-questions";
import { confirmAction } from "@/components/shared/confirm-action";
import { emptyQuestionInput, questionSummary, questionToInput } from "@/lib/content/quiz-question";
import { type ContentTreeLocation, ROOT_LOCATION, treeHref } from "@/lib/content/content-tree-params";
import type { QuizQuestion } from "@/types/content-quiz";

interface QuestionModalState {
  editing: QuizQuestion | null;
  key: number;
}

/** Container trình soạn câu hỏi: URL `/quiz/manage?packageId=&folderId=&studySetId=&quizId=`; "Quay lại" bỏ `quizId` để về đúng cấp của cây. */
export function QuizQuestionEditorPageContent({ quizId, location }: { quizId: string; location: ContentTreeLocation }) {
  const pathname = usePathname();
  const editor = useQuizQuestions(quizId, location.studySetId);
  const [modal, setModal] = useState<QuestionModalState | null>(null);

  const remove = async (question: QuizQuestion) => {
    const ok = await confirmAction({ title: "Xóa câu hỏi", content: `Bạn có chắc chắn muốn xóa câu hỏi "${questionSummary(question)}"?`, okText: "Xóa", danger: true });
    if (ok) await editor.removeQuestion(question);
  };

  return (
    <>
      <QuizQuestionEditorView
        quizState={editor.quizState}
        quiz={editor.quiz}
        questionsState={editor.questionsState}
        questions={editor.questions}
        studySetTitle={editor.studySetTitle}
        access={editor.access}
        writeEnabled={editor.writeEnabled}
        canWrite={editor.canWrite}
        busy={editor.busy}
        rootHref={treeHref(pathname, ROOT_LOCATION)}
        backHref={treeHref(pathname, location)}
        onAdd={() => setModal((prev) => ({ editing: null, key: (prev?.key ?? 0) + 1 }))}
        onEdit={(q) => setModal((prev) => ({ editing: q, key: (prev?.key ?? 0) + 1 }))}
        onDelete={(q) => void remove(q)}
        onRetryQuiz={editor.reloadQuiz}
        onRetryQuestions={editor.reloadQuestions}
      />
      {modal && (
        <QuizQuestionModal
          key={modal.key}
          mode={modal.editing ? "edit" : "create"}
          initialValue={modal.editing ? questionToInput(modal.editing) : emptyQuestionInput()}
          submitting={editor.busy}
          onCancel={() => setModal(null)}
          onSubmit={(input) => void editor.saveQuestion(input, modal.editing).then((ok) => ok && setModal(null))}
        />
      )}
    </>
  );
}
