// Dựng bộ câu hỏi popup "Luyện tập từ vựng" (vocab-practice-modal.tsx của HSK cũ) từ dữ liệu thật của từ: câu nối từ ghép ↔ Hán Việt
// (từ JSON `compounds` của pinyin chính) + câu viết pinyin cho từng câu ví dụ. Giữ nguyên quy tắc của bản cũ (2–3 từ ghép, tối đa 5 câu
// ví dụ, so pinyin bỏ hoa thường/khoảng trắng thừa). Hàm xáo trộn truyền vào được để test ổn định.
import type { VocabularyExample } from "@/types/dictionary";

export interface MatchQuestion {
  kind: "match";
  prompt: string;
  left: { key: string; text: string }[];
  right: { key: string; text: string }[];
}

export interface PinyinQuestion {
  kind: "pinyin";
  prompt: string;
  cn: string;
  answer: string;
}

export type PracticeQuestion = MatchQuestion | PinyinQuestion;

export interface CompoundWord {
  hanzi: string;
  sinoVietnamese?: string;
}

/** JSON `compounds` ([{hanzi, sinoVietnamese?}]); sai định dạng => mảng rỗng (bản cũ cũng bỏ qua câu nối khi JSON hỏng). */
export function parseCompounds(json: string | undefined): CompoundWord[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const { hanzi, sinoVietnamese } = item as Record<string, unknown>;
      if (typeof hanzi !== "string" || !hanzi) return [];
      return [{ hanzi, sinoVietnamese: typeof sinoVietnamese === "string" ? sinoVietnamese : undefined }];
    });
  } catch {
    return [];
  }
}

export function shuffleArray<T>(arr: T[], random: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildPracticeQuestions(
  hanzi: string,
  compounds: string | undefined,
  examples: VocabularyExample[],
  shuffle: <T>(arr: T[]) => T[] = shuffleArray,
): PracticeQuestion[] {
  const list: PracticeQuestion[] = [];

  const usable = parseCompounds(compounds).filter((c) => c.sinoVietnamese).slice(0, 3);
  if (usable.length >= 2) {
    list.push({
      kind: "match",
      prompt: `Nối từ ghép có chữ ${hanzi} ở cột A với nghĩa phù hợp ở cột B.`,
      left: usable.map((c, i) => ({ key: String(i), text: c.hanzi })),
      right: shuffle(usable.map((c, i) => ({ key: String(i), text: c.sinoVietnamese ?? "" }))),
    });
  }

  examples
    .filter((e) => e.zh && e.pinyin)
    .slice(0, 5)
    .forEach((e) => {
      list.push({
        kind: "pinyin",
        prompt: "Viết lại toàn bộ Pinyin (có thanh điệu) cho cả câu.",
        cn: e.zh ?? "",
        answer: e.pinyin ?? "",
      });
    });

  return list;
}

export function normalizePinyinAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Đúng khi mọi ô cột A được nối với ô cột B có cùng khoá gốc (right.key giữ chỉ số gốc trước khi xáo). */
export function isAnswerCorrect(question: PracticeQuestion, pairs: Record<string, string>, typed: string): boolean {
  if (question.kind === "match") return question.left.every((l) => pairs[l.key] === l.key);
  return normalizePinyinAnswer(typed) === normalizePinyinAnswer(question.answer);
}

export type PracticeTier = "great" | "good" | "poor";

/** Xếp loại cuối bài — cùng cách chia với bản cũ. */
export function practiceTier(correct: number, wrong: number, total: number): PracticeTier {
  const ratio = total > 0 ? correct / total : 0;
  if (wrong === 0 && correct > 0) return "great";
  return ratio >= 0.5 ? "good" : "poor";
}
