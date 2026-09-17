"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { QuizQuestionEditorView } from "@/components/management/content-quiz/quiz-question-editor-view";
import { QuizQuestionModal } from "@/components/management/content-quiz/quiz-question-modal";
import { useQuizQuestions } from "@/components/management/content-quiz/use-quiz-questions";
import { confirmAction } from "@/components/shared/confirm-action";
import { emptyQuestionInput, questionSummary, questionToInput } from "@/lib/content/quiz-question";
import { FLAT_ROOT_LOCATION, flatHref, flatPackageLocation } from "@/lib/content/flat-content-params";
import type { QuizQuestion } from "@/types/content-quiz";

interface QuestionModalState {
  editing: QuizQuestion | null;
  key: number;
}

/** Container trình soạn câu hỏi: URL `/quiz/manage?packageId=&quizId=`; "Quay lại" bỏ `quizId` để về cấp Bài tập của gói. */
export function QuizQuestionEditorPageContent({ packageId, quizId }: { packageId: string; quizId: string }) {
  const pathname = usePathname();
  const editor = useQuizQuestions(packageId, quizId);
  const [modal, setModal] = useState<QuestionModalState | null>(null);

  const remove = async (question: QuizQuestion) => {
    const ok = await confirmAction({ title: "Xóa câu hỏi", content: `Bạn có chắc chắn muốn xóa câu hỏi "${questionSummary(question)}"?`, okText: "Xóa", danger: true });
    if (ok) await editor.removeQuestion(question);
  };

  return (
    <>
      <QuizQuestionEditorView
        state={editor.state}
        quiz={editor.quiz}
        questions={editor.questions}
        packageName={editor.packageName}
        access={editor.access}
        writeEnabled={editor.writeEnabled}
        canWrite={editor.canWrite}
        busy={editor.busy}
        rootHref={flatHref(pathname, FLAT_ROOT_LOCATION)}
        backHref={flatHref(pathname, flatPackageLocation(packageId))}
        onAdd={() => setModal((prev) => ({ editing: null, key: (prev?.key ?? 0) + 1 }))}
        onEdit={(q) => setModal((prev) => ({ editing: q, key: (prev?.key ?? 0) + 1 }))}
        onDelete={(q) => void remove(q)}
        onRetry={editor.reload}
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
