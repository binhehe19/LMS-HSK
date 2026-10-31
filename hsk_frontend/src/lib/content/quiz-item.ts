// Hàm thuần của module Bài tập — cấp QUIZ (mục của bộ đề): form quiz, kiểm tra, chuẩn hoá; bộ kỹ năng QUIZ_SKILL_OPTIONS và nhãn độ khó của bản cũ
// (manage-quiz.tsx, create-quiz-modal.tsx, quiz-list.tsx).
import type { ContentSkillOption } from "@/types/content";
import type { QuizDifficulty, QuizItem, QuizItemInput } from "@/types/content-quiz";

/** QUIZ_SKILL_OPTIONS của manage-quiz.tsx cũ, nguyên thứ tự và nhãn. */
export const QUIZ_SKILLS: ContentSkillOption[] = [
  { value: "PRACTICE", label: "Ôn tập" },
  { value: "LISTENING", label: "Nghe" },
  { value: "READING", label: "Đọc" },
  { value: "WRITING", label: "Viết" },
  { value: "SPEAKING", label: "Nói" },
  { value: "PHONETICS", label: "Ngữ âm" },
  { value: "TRANSLATION", label: "Dịch" },
  { value: "GRAMMAR_3_0", label: "Ngữ pháp 3.0" },
];

export const QUIZ_DIFFICULTIES: { value: QuizDifficulty; label: string; className: string }[] = [
  { value: "EASY", label: "Dễ", className: "easy" },
  { value: "MEDIUM", label: "Trung bình", className: "medium" },
  { value: "HARD", label: "Khó", className: "hard" },
];

export const DEFAULT_PASSING_SCORE = 80;

export function quizSkillLabel(value: string | undefined | null): string {
  return QUIZ_SKILLS.find((s) => s.value === value)?.label ?? (value ? String(value) : "—");
}

/** Nhãn + class CSS `.difficulty-badge.{easy|medium|hard}` của quiz-list.tsx cũ (thiếu/lạ => Trung bình như bản cũ). */
export function quizDifficultyMeta(value: string | undefined | null): { label: string; className: string } {
  return QUIZ_DIFFICULTIES.find((d) => d.value === value) ?? QUIZ_DIFFICULTIES[1];
}

export function emptyQuizInput(): QuizItemInput {
  return { title: "", description: "", instruction: "", skill: "", difficulty: "MEDIUM", durationMinutes: 0, passingScore: DEFAULT_PASSING_SCORE, shuffleQuestions: false, audioFileId: undefined, passageText: "", passageImageFileId: undefined };
}

export function quizToInput(quiz: QuizItem): QuizItemInput {
  return {
    title: quiz.title,
    description: quiz.description ?? "",
    instruction: quiz.instruction ?? "",
    skill: quiz.skill ?? "",
    difficulty: quiz.difficulty ?? "MEDIUM",
    durationMinutes: quiz.durationMinutes ?? 0,
    passingScore: typeof quiz.passingScore === "number" ? quiz.passingScore : DEFAULT_PASSING_SCORE,
    shuffleQuestions: quiz.shuffleQuestions ?? false,
    audioFileId: quiz.audioFileId || undefined,
    passageText: quiz.passageText ?? "",
    passageImageFileId: quiz.passageImageFileId || undefined,
    index: quiz.index,
  };
}

const isWholeNumber = (n: number | undefined) => n === undefined || (Number.isFinite(n) && Number.isInteger(n) && n >= 0);

export function validateQuizInput(input: QuizItemInput): string | null {
  if (!input.title.trim()) return "Vui lòng nhập tiêu đề bài tập";
  if (!input.skill?.trim()) return "Vui lòng chọn kỹ năng của bài tập";
  if (!isWholeNumber(input.durationMinutes)) return "Thời gian làm bài phải là số phút nguyên không âm (0 = không giới hạn)";
  if (input.passingScore !== undefined && !(Number.isFinite(input.passingScore) && input.passingScore >= 0 && input.passingScore <= 100)) return "Điểm đạt phải nằm trong khoảng 0–100 (%)";
  return null;
}

const clean = (value: string | undefined): string | undefined => {
  const v = value?.trim();
  return v ? v : undefined;
};

/** Cắt khoảng trắng, bỏ trường rỗng; thời gian 0 => không gửi (không giới hạn) như bản cũ (`timeLimitSeconds: undefined`). */
export function normalizeQuizInput(input: QuizItemInput): QuizItemInput {
  return {
    title: input.title.trim(),
    description: clean(input.description),
    instruction: clean(input.instruction),
    skill: clean(input.skill),
    difficulty: input.difficulty ?? "MEDIUM",
    durationMinutes: input.durationMinutes && input.durationMinutes > 0 ? Math.floor(input.durationMinutes) : undefined,
    passingScore: input.passingScore ?? DEFAULT_PASSING_SCORE,
    shuffleQuestions: input.shuffleQuestions ?? false,
    audioFileId: clean(input.audioFileId),
    passageText: clean(input.passageText),
    passageImageFileId: clean(input.passageImageFileId),
    index: input.index,
  };
}

/** Cảnh báo (không chặn lưu) khi nội dung bài tập chưa khớp kỹ năng đã chọn; kỹ năng và loại câu hỏi không ràng buộc nhau ở máy chủ. */
export function quizSkillWarnings(quiz: Pick<QuizItem, "skill" | "audioFileId">, questions: readonly { type: string; audioFileId?: string }[]): string[] {
  if (quiz.skill === "LISTENING" && !quiz.audioFileId && !questions.some((q) => q.audioFileId)) return ["Bài Nghe chưa có audio: thêm audio bài nghe cho bài tập hoặc cho câu hỏi."];
  if (quiz.skill === "SPEAKING" && !questions.some((q) => q.type === "AUDIO_RESPONSE")) return ["Bài Nói chưa có câu hỏi Ghi âm nào."];
  return [];
}

export function quizSummary(quiz: QuizItem): string {
  return quiz.title;
}
