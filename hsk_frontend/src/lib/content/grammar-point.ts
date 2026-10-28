// Hàm thuần của module Ngữ pháp: form điểm ngữ pháp (GrammarPointModal cũ), kiểm tra, chuẩn hoá, huy hiệu trình độ (manage-grammar.tsx cũ).
import type { GrammarPoint, GrammarPointInput } from "@/types/content-grammar";

/** Màu huy hiệu "HSK n" của manage-grammar.tsx cũ (HSK_LEVEL_COLORS); cấp lạ => xám. */
const HSK_LEVEL_COLORS: Record<number, { bg: string; color: string }> = {
  1: { bg: "#d1fae5", color: "#065f46" },
  2: { bg: "#dbeafe", color: "#1e40af" },
  3: { bg: "#fef3c7", color: "#92400e" },
  4: { bg: "#ede9fe", color: "#5b21b6" },
  5: { bg: "#fde2e2", color: "#991b1b" },
  6: { bg: "#fce7f3", color: "#9d174d" },
};

export function hskLevelStyle(level: string | number | undefined | null): { bg: string; color: string } {
  const n = Number(level);
  return HSK_LEVEL_COLORS[n] ?? { bg: "#f3f4f6", color: "#374151" };
}

export const HSK_LEVEL_OPTIONS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function emptyGrammarPointInput(): GrammarPointInput {
  return { title: "", generalDefinition: "", category: "", hskLevel: "1", structure: "", explanation: "", note: "", exampleSentenceZh: "", exampleSentencePinyin: "", exampleSentenceVi: "", linkedQuizStudySetId: "" };
}

export function grammarPointToInput(point: GrammarPoint): GrammarPointInput {
  return {
    title: point.title,
    generalDefinition: point.generalDefinition ?? "",
    category: point.category ?? "",
    hskLevel: point.hskLevel ? String(point.hskLevel) : "1",
    structure: point.structure ?? "",
    explanation: point.explanation ?? "",
    note: point.note ?? "",
    exampleSentenceZh: point.exampleSentenceZh ?? "",
    exampleSentencePinyin: point.exampleSentencePinyin ?? "",
    exampleSentenceVi: point.exampleSentenceVi ?? "",
    linkedQuizStudySetId: point.linkedQuizStudySetId ?? "",
    index: point.index,
  };
}

/** Các trường `required` của GrammarPointModal cũ: tên, phân loại, cấu trúc, giải thích, cấp HSK 1–9. */
export function validateGrammarPointInput(input: GrammarPointInput): string | null {
  if (!input.title.trim()) return "Vui lòng nhập tên điểm ngữ pháp";
  if (!input.category?.trim()) return "Vui lòng nhập phân loại";
  if (!input.structure?.trim()) return "Vui lòng nhập cấu trúc";
  if (!input.explanation?.trim()) return "Vui lòng nhập giải thích";
  const level = input.hskLevel?.trim();
  if (level && !/^[1-9]$/.test(level)) return "Cấp độ HSK phải từ 1 đến 9";
  return null;
}

const clean = (value: string | undefined): string | undefined => {
  const v = value?.trim();
  return v ? v : undefined;
};

export function normalizeGrammarPointInput(input: GrammarPointInput): GrammarPointInput {
  return {
    title: input.title.trim(),
    generalDefinition: clean(input.generalDefinition),
    category: clean(input.category),
    hskLevel: clean(input.hskLevel),
    structure: clean(input.structure),
    explanation: clean(input.explanation),
    note: clean(input.note),
    exampleSentenceZh: clean(input.exampleSentenceZh),
    exampleSentencePinyin: clean(input.exampleSentencePinyin),
    exampleSentenceVi: clean(input.exampleSentenceVi),
    linkedQuizStudySetId: clean(input.linkedQuizStudySetId),
    index: input.index,
  };
}

export function grammarPointSummary(point: GrammarPoint): string {
  return point.title;
}
