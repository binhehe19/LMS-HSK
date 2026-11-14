// Hàm thuần của trình soạn CÂU HỎI (create-question-modal.tsx + question-list.tsx của HSK cũ): bảng loại câu hỏi, giá trị form, kiểm tra theo loại
// (thông điệp giữ nguyên bản cũ), chuẩn hoá thành thân gửi máy chủ (chỉ giữ trường của loại đang chọn). Không import React.
import type { QuizDifficulty, QuizFillBlankMode, QuizQuestion, QuizQuestionBody, QuizQuestionType } from "@/types/content-quiz";

export interface QuizQuestionTypeMeta {
  value: QuizQuestionType;
  label: string;
  /** Mô tả ngắn trong lưới chọn loại (qqm-type-desc của bản cũ). */
  description: string;
  icon: string;
  /** Class huy hiệu `.question-type-badge.{mc|fb|mp|sb}` của question-list.tsx cũ. */
  badgeClass: string;
  /** false = có trong bản cũ nhưng form soạn chưa chuyển (SENTENCE_BUILDER). */
  supported: boolean;
}

export const QUIZ_QUESTION_TYPES: QuizQuestionTypeMeta[] = [
  { value: "MULTIPLE_CHOICE", label: "Trắc nghiệm", description: "1 đáp án đúng", icon: "isax-tick-square", badgeClass: "mc", supported: true },
  { value: "TRUE_FALSE", label: "Đúng / Sai", description: "Chọn Đúng hoặc Sai", icon: "isax-like-dislike", badgeClass: "mc", supported: true },
  { value: "FILL_IN_BLANK", label: "Điền chỗ trống", description: "Nhập hoặc chọn đáp án", icon: "isax-edit", badgeClass: "fb", supported: true },
  { value: "MATCHING_PAIRS", label: "Nối cặp", description: "Ghép cặp tương ứng", icon: "isax-link-21", badgeClass: "mp", supported: true },
  { value: "SHORT_ANSWER", label: "Tự luận", description: "Giáo viên chấm tay", icon: "isax-document-text", badgeClass: "fb", supported: true },
  { value: "AUDIO_RESPONSE", label: "Ghi âm", description: "Trả lời bằng audio", icon: "isax-microphone", badgeClass: "mp", supported: true },
  { value: "SENTENCE_BUILDER", label: "Xây dựng câu", description: "Chưa chuyển sang bản mới", icon: "isax-text-block", badgeClass: "sb", supported: false },
  { value: "MULTIPLE_SELECT", label: "Chọn nhiều đáp án", description: "Soạn ở trình soạn IELTS", icon: "isax-tick-square", badgeClass: "mc", supported: false },
  { value: "FILE_UPLOAD", label: "Nộp tệp", description: "Soạn ở trình soạn IELTS", icon: "isax-document-upload", badgeClass: "fb", supported: false },
];

export function questionTypeMeta(type: string | undefined | null): QuizQuestionTypeMeta {
  return QUIZ_QUESTION_TYPES.find((t) => t.value === type) ?? { value: "MULTIPLE_CHOICE", label: String(type ?? "?"), description: "", icon: "isax-message-question", badgeClass: "mc", supported: false };
}

export interface QuizOptionInput {
  text: string;
  isCorrect: boolean;
}
export interface QuizBlankInput {
  answer: string;
  /** Đáp án chấp nhận khác, phân cách bằng dấu phẩy (như ô nhập của bản cũ). */
  acceptable: string;
}
export interface QuizPairInput {
  left: string;
  right: string;
}

/** Giá trị form soạn câu hỏi: giữ mọi phần theo loại để đổi loại qua lại không mất dữ liệu đã gõ. */
export interface QuizQuestionInput {
  type: QuizQuestionType;
  prompt: string;
  points: number;
  difficulty: QuizDifficulty;
  explanation: string;
  imageFileId?: string;
  audioFileId?: string;
  options: QuizOptionInput[];
  correctAnswer: boolean | null;
  fillBlankMode: QuizFillBlankMode;
  blanks: QuizBlankInput[];
  choices: string[];
  pairs: QuizPairInput[];
  referenceAnswer: string;
  index?: number;
}

export const DEFAULT_QUESTION_POINTS = 10;

export function emptyQuestionInput(type: QuizQuestionType = "MULTIPLE_CHOICE"): QuizQuestionInput {
  return {
    type,
    prompt: "",
    points: DEFAULT_QUESTION_POINTS,
    difficulty: "MEDIUM",
    explanation: "",
    imageFileId: undefined,
    audioFileId: undefined,
    options: [emptyOption(), emptyOption(), emptyOption(), emptyOption()],
    correctAnswer: null,
    fillBlankMode: "TYPE",
    blanks: [{ answer: "", acceptable: "" }],
    choices: ["", ""],
    pairs: [{ left: "", right: "" }, { left: "", right: "" }],
    referenceAnswer: "",
  };
}

const emptyOption = (): QuizOptionInput => ({ text: "", isCorrect: false });

/** Câu mẫu của bản cũ nhận cả `___`; chuẩn về `{blank}`. */
export function normalizeBlankTemplate(template: string): string {
  return template.replace(/___+/g, "{blank}");
}

export function countBlanks(template: string): number {
  return (normalizeBlankTemplate(template).match(/\{blank\}/g) ?? []).length;
}

/** "a, b ,c" => ["a","b","c"] (bỏ rỗng, bỏ trùng). */
export function parseAcceptable(text: string): string[] {
  return [...new Set(text.split(",").map((s) => s.trim()).filter(Boolean))];
}

export function questionToInput(q: QuizQuestion): QuizQuestionInput {
  const base = emptyQuestionInput(q.type);
  return {
    ...base,
    prompt: q.prompt ?? "",
    points: typeof q.points === "number" && q.points > 0 ? q.points : DEFAULT_QUESTION_POINTS,
    difficulty: q.difficulty ?? "MEDIUM",
    explanation: q.explanation ?? "",
    imageFileId: q.imageFileId || undefined,
    audioFileId: q.audioFileId || undefined,
    options: q.options && q.options.length > 0 ? q.options.map((o) => ({ text: o.text ?? "", isCorrect: Boolean(o.isCorrect) })) : base.options,
    correctAnswer: typeof q.correctAnswer === "boolean" ? q.correctAnswer : null,
    fillBlankMode: q.fillBlankMode ?? "TYPE",
    blanks: q.blanks && q.blanks.length > 0 ? [...q.blanks].sort((a, b) => a.index - b.index).map((b) => ({ answer: b.answer ?? "", acceptable: (b.acceptable ?? []).join(", ") })) : base.blanks,
    choices: q.choices && q.choices.length > 0 ? [...q.choices] : base.choices,
    pairs: q.pairs && q.pairs.length > 0 ? q.pairs.map((p) => ({ left: p.left ?? "", right: p.right ?? "" })) : base.pairs,
    referenceAnswer: q.referenceAnswer ?? "",
    index: q.index,
  };
}

const filledOptions = (v: QuizQuestionInput) => v.options.filter((o) => o.text.trim());
const filledBlanks = (v: QuizQuestionInput) => v.blanks.filter((b) => b.answer.trim());
const filledChoices = (v: QuizQuestionInput) => v.choices.map((c) => c.trim()).filter(Boolean);
const filledPairs = (v: QuizQuestionInput) => v.pairs.filter((p) => p.left.trim() && p.right.trim());

/** Thông điệp lỗi (nguyên văn bản cũ khi có) hoặc null khi hợp lệ. */
export function validateQuestionInput(v: QuizQuestionInput): string | null {
  const meta = questionTypeMeta(v.type);
  if (!meta.supported) return `Loại câu hỏi "${meta.label}" chưa được hỗ trợ soạn trên bản mới.`;
  if (!(Number.isFinite(v.points) && v.points > 0)) return "Điểm của câu hỏi phải lớn hơn 0.";
  switch (v.type) {
    case "MULTIPLE_CHOICE": {
      if (!v.prompt.trim()) return "Vui lòng nhập nội dung câu hỏi.";
      const options = filledOptions(v);
      if (options.length < 2) return "Trắc nghiệm cần ít nhất 2 lựa chọn.";
      if (options.filter((o) => o.isCorrect).length !== 1) return "Trắc nghiệm chỉ được có 1 đáp án đúng.";
      return null;
    }
    case "TRUE_FALSE":
      if (!v.prompt.trim()) return "Vui lòng nhập mệnh đề Đúng/Sai.";
      if (v.correctAnswer === null) return "Vui lòng chọn đáp án Đúng hoặc Sai.";
      return null;
    case "FILL_IN_BLANK": {
      const template = normalizeBlankTemplate(v.prompt.trim());
      if (!template) return "Vui lòng nhập câu mẫu.";
      const blankCount = countBlanks(template);
      if (blankCount === 0) return "Câu mẫu phải có ít nhất 1 chỗ trống (dùng {blank} hoặc ___).";
      const blanks = filledBlanks(v);
      if (blankCount !== blanks.length) return `Số lượng chỗ trống trong câu mẫu (${blankCount}) không khớp với số lượng đáp án bạn đã nhập (${blanks.length}).`;
      if (v.fillBlankMode === "SELECT" && filledChoices(v).length < 2) return "Chế độ chọn đáp án cần ít nhất 2 lựa chọn.";
      return null;
    }
    case "MATCHING_PAIRS":
      if (filledPairs(v).length < 2) return "Câu hỏi nối cặp cần ít nhất 2 cặp vế.";
      return null;
    case "SHORT_ANSWER":
      if (!v.prompt.trim()) return "Vui lòng nhập đề bài tự luận.";
      return null;
    case "AUDIO_RESPONSE":
      if (!v.prompt.trim()) return "Vui lòng nhập đề bài ghi âm.";
      return null;
    default:
      return "Loại câu hỏi không hợp lệ.";
  }
}

const clean = (value: string | undefined): string | undefined => {
  const t = value?.trim();
  return t ? t : undefined;
};

/** Thân gửi máy chủ: chỉ trường chung + trường của loại đang chọn (bản cũ gửi từng nhánh switch tương tự). */
export function normalizeQuestionInput(v: QuizQuestionInput): QuizQuestionBody {
  const body: QuizQuestionBody = {
    type: v.type,
    prompt: v.type === "FILL_IN_BLANK" ? normalizeBlankTemplate(v.prompt.trim()) : v.prompt.trim(),
    points: v.points,
    difficulty: v.difficulty,
    explanation: clean(v.explanation),
    imageFileId: clean(v.imageFileId),
    audioFileId: clean(v.audioFileId),
    index: v.index,
  };
  switch (v.type) {
    case "MULTIPLE_CHOICE":
      body.options = filledOptions(v).map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect }));
      break;
    case "TRUE_FALSE":
      body.correctAnswer = v.correctAnswer === true;
      break;
    case "FILL_IN_BLANK":
      body.fillBlankMode = v.fillBlankMode;
      body.blanks = filledBlanks(v).map((b, index) => ({ index, answer: b.answer.trim(), acceptable: parseAcceptable(b.acceptable) }));
      if (v.fillBlankMode === "SELECT") body.choices = filledChoices(v);
      break;
    case "MATCHING_PAIRS":
      body.pairs = filledPairs(v).map((p) => ({ left: p.left.trim(), right: p.right.trim() }));
      break;
    case "SHORT_ANSWER":
      body.gradingMode = "MANUAL";
      body.referenceAnswer = clean(v.referenceAnswer);
      break;
    case "AUDIO_RESPONSE":
      body.gradingMode = "MANUAL";
      break;
    default:
      break;
  }
  return body;
}

/** Dòng tóm tắt một câu hỏi (hộp xác nhận xoá, toast); câu quá dài bị cắt. */
export function questionSummary(q: Pick<QuizQuestion, "prompt" | "type">): string {
  const text = (q.prompt ?? "").trim() || `(${questionTypeMeta(q.type).label})`;
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

export function sortQuestions<T extends { index: number }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => a.index - b.index);
}
