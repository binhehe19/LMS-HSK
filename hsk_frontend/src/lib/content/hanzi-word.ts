// Hàm thuần của module Luyện viết (Hán tự): form chữ, kiểm tra, chuẩn hoá, nhập nhanh từ văn bản. Không import React/Next.
// Quy tắc bắt buộc giữ của create-set-page.tsx cũ: một chữ "đầy đủ thông tin" phải có chữ Hán + phiên âm + nghĩa (bản cũ lặng lẽ BỎ dòng thiếu;
// ở đây báo lỗi để người dùng sửa — khác bản cũ có chủ đích).
import type { HanziWord, HanziWordInput } from "@/types/content-writing";

export const STROKE_COUNT_MIN = 1;
export const STROKE_COUNT_MAX = 64;

export function emptyHanziInput(): HanziWordInput {
  return { hanzi: "", pinyin: "", meaning: "", strokeCount: undefined, radical: "", sinoVn: "", example: "", exampleMeaning: "" };
}

export function hanziToInput(word: HanziWord): HanziWordInput {
  return {
    hanzi: word.hanzi,
    pinyin: word.pinyin ?? "",
    meaning: word.meaning ?? "",
    strokeCount: typeof word.strokeCount === "number" ? word.strokeCount : undefined,
    radical: word.radical ?? "",
    sinoVn: word.sinoVn ?? "",
    example: word.example ?? "",
    exampleMeaning: word.exampleMeaning ?? "",
    index: word.index,
  };
}

/** Ô "Số nét" là input text/number: rỗng => không gửi; chỉ nhận số nguyên dương. Chuỗi không phải số giữ nguyên là NaN để validate báo lỗi. */
export function parseStrokeCount(raw: string): number | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  return /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

export function validateHanziInput(input: HanziWordInput): string | null {
  if (!input.hanzi.trim()) return "Vui lòng nhập chữ Hán";
  if (!input.pinyin?.trim()) return "Vui lòng nhập phiên âm (pinyin)";
  if (!input.meaning?.trim()) return "Vui lòng nhập nghĩa";
  if (input.strokeCount !== undefined && (!Number.isInteger(input.strokeCount) || input.strokeCount < STROKE_COUNT_MIN || input.strokeCount > STROKE_COUNT_MAX)) {
    return `Số nét phải là số nguyên từ ${STROKE_COUNT_MIN} đến ${STROKE_COUNT_MAX}`;
  }
  return null;
}

const clean = (value: string | undefined): string | undefined => {
  const v = value?.trim();
  return v ? v : undefined;
};

export function normalizeHanziInput(input: HanziWordInput): HanziWordInput {
  return {
    hanzi: input.hanzi.trim(),
    pinyin: clean(input.pinyin),
    meaning: clean(input.meaning),
    strokeCount: typeof input.strokeCount === "number" && Number.isInteger(input.strokeCount) ? input.strokeCount : undefined,
    radical: clean(input.radical),
    sinoVn: clean(input.sinoVn),
    example: clean(input.example),
    exampleMeaning: clean(input.exampleMeaning),
    index: input.index,
  };
}

export function hanziSummary(word: HanziWord): string {
  return word.hanzi;
}

const SEPARATORS = ["\t", ",", ";", ":", "|"];

/**
 * Mỗi dòng một chữ: `chữ Hán <sep> nghĩa <sep> pinyin [<sep> số nét [<sep> bộ thủ [<sep> Hán Việt]]]` — ba cột đầu theo đúng thứ tự của ô "Nhập nhanh"
 * dùng chung (ContentSetEditor: chữ Hán, nghĩa, pinyin); sep là dấu đầu tiên có trong dòng (tab, phẩy, chấm phẩy, hai chấm, gạch dọc). Dòng thiếu chữ hoặc
 * nghĩa bị bỏ qua; thiếu pinyin vẫn thêm để người dùng điền (validate báo khi lưu). Số nét không hợp lệ => bỏ trống.
 */
export function parseBulkHanzi(text: string): HanziWordInput[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): HanziWordInput | null => {
      const sep = SEPARATORS.find((s) => line.includes(s));
      if (!sep) return null;
      const [hanzi, meaning, pinyin, strokes, radical, sinoVn] = line.split(sep).map((p) => p.trim());
      if (!hanzi || !meaning) return null;
      const strokeCount = strokes ? parseStrokeCount(strokes) : undefined;
      return { ...emptyHanziInput(), hanzi, meaning, pinyin: pinyin ?? "", strokeCount: strokeCount !== undefined && Number.isInteger(strokeCount) ? strokeCount : undefined, radical: radical ?? "", sinoVn: sinoVn ?? "" };
    })
    .filter((word): word is HanziWordInput => word !== null);
}
