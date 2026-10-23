// Sao chép từ frontend/ (cùng hợp đồng backend); sửa ở một nơi thì sửa nơi kia.
import type { AssessmentAnswerGradingStatus, ResultQuestionContent } from "@/lib/api/assessment-attempt-client";
import { optionLabel } from "@/lib/assessment/answer-codec";

// Chữ hiển thị cho học sinh. Học sinh không biết hệ thống có chấm AI: mọi câu đang chờ máy chấm đều hiện
// "Đang chấm điểm", điểm AI hiện như điểm chính thức (không nhãn, không ghi nguồn chấm).
export type QuestionScoreState = "scored" | "grading" | "waitingTeacher";

export function scoreStateOf(status: AssessmentAnswerGradingStatus, hasScore: boolean): QuestionScoreState {
  if (hasScore) return "scored";
  return status === "MANUAL_PENDING" ? "waitingTeacher" : "grading";
}

interface StudentAnswerJson {
  selectedOptionIndex?: number;
  selectedOptionIndexes?: number[];
  /** Câu nối: dòng -> optionIndex học viên chọn. */
  matchingAnswers?: Record<string, number>;
  blankAnswers?: Record<string, string>;
  chunkOrder?: number[];
  text?: string;
  files?: { fileId: string; fileName?: string }[];
  audio?: { fileId: string; durationSeconds?: number } | null;
}

function parse(answerJson: string | null): StudentAnswerJson | null {
  if (!answerJson) return null;
  try {
    return JSON.parse(answerJson) as StudentAnswerJson;
  } catch {
    return null;
  }
}

// Câu trả lời của học sinh dưới dạng dòng chữ dễ đọc, theo từng loại câu.
export function formatStudentAnswer(q: ResultQuestionContent, answerJson: string | null): string[] {
  const a = parse(answerJson);
  if (!a) return [];
  switch (q.questionType) {
    case "MULTIPLE_CHOICE": {
      const option = q.options?.find((o) => o.optionIndex === a.selectedOptionIndex);
      return option ? [option.content] : [];
    }
    case "MULTIPLE_SELECT": {
      const chosen = a.selectedOptionIndexes ?? [];
      return (q.options ?? []).filter((o) => chosen.includes(o.optionIndex)).map((o) => o.content);
    }
    case "MATCHING":
      return (q.matchingPairs ?? [])
        .map((p) => ({ p, given: a.matchingAnswers?.[p.pairIndex] }))
        .filter(({ given }) => Number.isInteger(given))
        .map(({ p, given }) => `${p.prompt} → ${optionLabel(q.options, given)}`);
    case "FILL_IN_BLANK":
      return (q.blanks ?? [])
        .map((b) => ({ b, given: a.blankAnswers?.[b.blankIndex] }))
        .filter(({ given }) => given)
        .map(({ b, given }) => `${b.blankIndex + 1}. ${given}`);
    case "SENTENCE_BUILDER": {
      const order: number[] = Array.isArray(a.chunkOrder) ? a.chunkOrder : [];
      const text = order.map((i) => q.sentenceChunks?.[i]?.content).filter(Boolean).join(" ");
      return text ? [text] : [];
    }
    case "FILE_UPLOAD":
      return (a.files ?? []).map((f) => f.fileName || f.fileId);
    case "AUDIO_RESPONSE":
      return a.audio?.fileId ? [a.audio.durationSeconds ? `Bản ghi âm (${Math.round(a.audio.durationSeconds)} giây)` : "Bản ghi âm"] : [];
    default:
      return a.text ? [String(a.text)] : [];
  }
}

// Đáp án đúng; chỉ có dữ liệu khi câu đã có điểm (server mới trả đáp án đúng).
export function formatCorrectAnswer(q: ResultQuestionContent): string[] {
  switch (q.questionType) {
    case "MULTIPLE_CHOICE":
    case "MULTIPLE_SELECT":
      return (q.options ?? []).filter((o) => o.correct).map((o) => o.content);
    case "MATCHING":
      return (q.matchingPairs ?? []).filter((p) => Number.isInteger(p.answerOptionIndex)).map((p) => `${p.prompt} → ${optionLabel(q.options, p.answerOptionIndex)}`);
    case "FILL_IN_BLANK":
      return (q.blanks ?? []).filter((b) => b.correctAnswer).map((b) => `${b.blankIndex + 1}. ${b.correctAnswer}`);
    case "SENTENCE_BUILDER": {
      const ordered = (q.sentenceChunks ?? [])
        .filter((c) => !c.distractor)
        .sort((x, y) => (x.correctPosition ?? 0) - (y.correctPosition ?? 0))
        .map((c) => c.content)
        .join(" ");
      return ordered ? [ordered] : [];
    }
    default:
      return [];
  }
}

export function formatPoints(value: number | null | undefined): string {
  if (value == null) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}
