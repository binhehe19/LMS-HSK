// Hàm thuần của module Thẻ ghi nhớ: form thẻ, kiểm tra, nhập nhanh từ văn bản (bulk của CreateStudySetWithCardsModal cũ). So khớp thẻ khi sửa bộ dùng
// hàm generic lib/content/content-item-diff.ts.
import type { FlashcardCard, FlashcardCardInput } from "@/types/content-flashcard";

export function emptyFlashcardInput(): FlashcardCardInput {
  return { term: "", pinyin: "", wordType: "", meaning: "", example: "", examplePinyin: "", exampleMeaning: "", imageFileId: undefined, audioFileId: undefined, customFields: [] };
}

export function flashcardToInput(card: FlashcardCard): FlashcardCardInput {
  return {
    term: card.term,
    pinyin: card.pinyin ?? "",
    wordType: card.wordType ?? "",
    meaning: card.meaning,
    example: card.example ?? "",
    examplePinyin: card.examplePinyin ?? "",
    exampleMeaning: card.exampleMeaning ?? "",
    imageFileId: card.imageFileId || undefined,
    audioFileId: card.audioFileId || undefined,
    customFields: card.customFields ? card.customFields.map((f) => ({ ...f })) : [],
    index: card.index,
  };
}

/** Thông điệp của bản cũ: cả chữ Hán và nghĩa đều bắt buộc. */
export function validateFlashcardInput(input: FlashcardCardInput): string | null {
  if (!input.term.trim()) return "Vui lòng nhập chữ Hán";
  if (!input.meaning.trim()) return "Vui lòng nhập nghĩa tiếng Việt";
  return null;
}

const clean = (value: string | undefined): string | undefined => {
  const v = value?.trim();
  return v ? v : undefined;
};

export function normalizeFlashcardInput(input: FlashcardCardInput): FlashcardCardInput {
  const customFields = (input.customFields ?? []).map((f) => ({ label: f.label.trim(), value: f.value.trim() })).filter((f) => f.label || f.value);
  return {
    term: input.term.trim(),
    meaning: input.meaning.trim(),
    pinyin: clean(input.pinyin),
    wordType: clean(input.wordType),
    example: clean(input.example),
    examplePinyin: clean(input.examplePinyin),
    exampleMeaning: clean(input.exampleMeaning),
    imageFileId: clean(input.imageFileId),
    audioFileId: clean(input.audioFileId),
    customFields: customFields.length > 0 ? customFields : undefined,
    index: input.index,
  };
}

export function flashcardSummary(card: FlashcardCard): string {
  return card.term;
}

const SEPARATORS = ["\t", ",", ";", ":", "|"];

/**
 * Mỗi dòng một thẻ: `chữ Hán <sep> nghĩa [<sep> pinyin]`, sep là dấu đầu tiên có trong dòng (tab, phẩy, chấm phẩy, hai chấm, gạch dọc) như bulk
 * import cũ; dòng thiếu nghĩa bị bỏ qua.
 */
export function parseBulkCards(text: string): FlashcardCardInput[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): FlashcardCardInput | null => {
      const sep = SEPARATORS.find((s) => line.includes(s));
      if (!sep) return null;
      const [term, meaning, pinyin] = line.split(sep).map((p) => p.trim());
      if (!term || !meaning) return null;
      return { ...emptyFlashcardInput(), term, meaning, pinyin: pinyin ?? "" };
    })
    .filter((card): card is FlashcardCardInput => card !== null);
}
