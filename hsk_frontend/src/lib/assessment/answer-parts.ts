// Đáp án của học viên thành từng dòng có dấu đúng/sai theo `parts[]` của backend (đúng/sai từng dòng của câu nối và từng chỗ trống của câu điền,
// tính ở backend theo đáp án hệ thống). Không có `parts` (câu loại khác, hoặc câu chưa có điểm) thì trả các dòng chữ như `formatStudentAnswer`, không dấu.
import type { ResultQuestionContent } from "@/lib/api/assessment-attempt-client";
import { answerHtml, optionLabel } from "@/lib/assessment/answer-codec";
import { formatStudentAnswer } from "@/lib/assessment/result-format";

export interface AnswerPart {
  /** `pairIndex` của dòng nối hoặc `blankIndex` của chỗ trống (khoá backend dùng khi chấm). */
  index: number;
  correct: boolean;
}

export interface AnswerLine {
  text: string;
  html?: string;
  /** Có dấu đúng/sai khi backend trả `parts`; không thì undefined. */
  correct?: boolean;
}

function parse(answerJson: string | null): { matchingAnswers?: Record<string, number>; blankAnswers?: Record<string, string> } {
  try {
    return (answerJson ? JSON.parse(answerJson) : null) ?? {};
  } catch {
    return {};
  }
}

const EMPTY = "(bỏ trống)";

export function answerLines(q: ResultQuestionContent, answerJson: string | null, parts?: readonly AnswerPart[] | null): AnswerLine[] {
  if (q.questionType === "ESSAY") {
    const html = answerHtml(answerJson);
    return formatStudentAnswer(q, answerJson).map((text) => html ? { text, html } : { text });
  }
  if (!parts?.length || !answerJson) return formatStudentAnswer(q, answerJson).map((text) => ({ text }));
  const answer = parse(answerJson);
  const markOf = (index: number) => parts.find((part) => part.index === index)?.correct;
  if (q.questionType === "MATCHING") {
    return (q.matchingPairs ?? []).map((pair) => ({ text: `${pair.prompt} → ${optionLabel(q.options, answer.matchingAnswers?.[pair.pairIndex]) || EMPTY}`, correct: markOf(pair.pairIndex) }));
  }
  if (q.questionType === "FILL_IN_BLANK") {
    return (q.blanks ?? []).map((blank) => ({ text: `${blank.blankIndex + 1}. ${answer.blankAnswers?.[blank.blankIndex] || EMPTY}`, correct: markOf(blank.blankIndex) }));
  }
  return formatStudentAnswer(q, answerJson).map((text) => ({ text }));
}
