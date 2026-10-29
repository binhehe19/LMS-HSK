// Hàm thuần của màn Từ điển (manage-vocabulary.tsx cũ): tham số URL ↔ tham số tìm kiếm máy chủ, trích pinyin/nghĩa/từ loại để hiển thị, huy hiệu,
// lượng từ và từ liên quan (chuỗi "个 [gè], 本 [běn]" / JSON [{hanzi, pinyin}]). Không import React/Next.
import type { Vocabulary, VocabularyMeaning, VocabularyPinyin, VocabularySearchParams } from "@/types/dictionary";
import { CATALOG_PAGE_SIZES, DEFAULT_CATALOG_PAGE_SIZE } from "@/lib/content/catalog-page-sizes";

export const HSK_LEVELS = [1, 2, 3, 4, 5, 6];

/** Danh sách loại từ của bộ lọc màn cũ (18 mục, bao gồm 13 mục của form). */
export const WORD_TYPES = ["Danh từ", "Động từ", "Tính từ", "Trạng từ", "Phó từ", "Đại từ", "Giới từ", "Liên từ", "Thán từ", "Thành ngữ", "Cụm từ", "Trợ từ", "Trợ động từ", "Lượng từ", "Số từ", "Từ tượng thanh", "Tiền tố", "Hậu tố", "Hình dung từ"];

/** Bộ lọc màn hình nằm trong URL (`?keySearch=&hskLevel=&isSingleVocab=&wordType=&page=`); `page` 1-based (API dùng 0-based). */
export interface DictionaryFilters {
  keySearch: string;
  hskLevel?: number;
  isSingleVocab?: boolean;
  wordType?: string;
  page: number;
  size?: number;
}

export const DEFAULT_DICTIONARY_FILTERS: DictionaryFilters = { keySearch: "", page: 1 };

interface ParamsLike {
  get(name: string): string | null;
}

const MAX_TEXT = 100;
const trimText = (raw: string | null): string => (raw ?? "").trim().slice(0, MAX_TEXT);

/** Đọc bộ lọc từ query; giá trị lạ bị bỏ (hskLevel ngoài 1–6, isSingleVocab không phải true/false, page không phải số nguyên ≥ 1 => 1). */
export function readDictionaryFilters(params: ParamsLike): DictionaryFilters {
  const level = Number(params.get("hskLevel"));
  const single = params.get("isSingleVocab");
  const wordType = trimText(params.get("wordType"));
  const page = Number(params.get("page"));
  const size = Number(params.get("size"));
  return {
    keySearch: trimText(params.get("keySearch")) || trimText(params.get("radical")),
    hskLevel: HSK_LEVELS.includes(level) ? level : undefined,
    isSingleVocab: single === "true" ? true : single === "false" ? false : undefined,
    wordType: WORD_TYPES.includes(wordType) ? wordType : undefined,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    ...(CATALOG_PAGE_SIZES.includes(size) && size !== DEFAULT_CATALOG_PAGE_SIZE ? { size } : {}),
  };
}

/** Chuỗi query (có `?`) hoặc "" khi mọi bộ lọc ở mặc định; thứ tự cố định để URL ổn định. */
export function dictionaryQuery(filters: DictionaryFilters): string {
  const q = new URLSearchParams();
  if (filters.keySearch) q.set("keySearch", filters.keySearch);
  if (filters.hskLevel !== undefined) q.set("hskLevel", String(filters.hskLevel));
  if (filters.isSingleVocab !== undefined) q.set("isSingleVocab", String(filters.isSingleVocab));
  if (filters.wordType) q.set("wordType", filters.wordType);
  if (filters.page > 1) q.set("page", String(filters.page));
  if (filters.size && filters.size !== DEFAULT_CATALOG_PAGE_SIZE) q.set("size", String(filters.size));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function dictionaryHref(pathname: string, filters: DictionaryFilters): string {
  return `${pathname}${dictionaryQuery(filters)}`;
}

/** Tham số gửi máy chủ (`page` về 0-based). */
export function toSearchParams(filters: DictionaryFilters, size = filters.size ?? DEFAULT_CATALOG_PAGE_SIZE): VocabularySearchParams {
  return { keySearch: filters.keySearch, hskLevel: filters.hskLevel, isSingleVocab: filters.isSingleVocab, wordType: filters.wordType, page: Math.max(0, filters.page - 1), size };
}

/** Chuỗi query của `GET /dictionary/vocabularies/search` — chỉ gửi tham số có giá trị; `keySearch` luôn gửi (bản cũ gửi cả khi rỗng). */
export function buildSearchQuery(params: VocabularySearchParams): string {
  const q = new URLSearchParams();
  q.set("keySearch", params.keySearch ?? "");
  if (params.isSingleVocab !== undefined) q.set("isSingleVocab", String(params.isSingleVocab));
  q.set("page", String(params.page));
  q.set("size", String(params.size));
  if (params.hskLevel !== undefined) q.set("hskLevel", String(params.hskLevel));
  if (params.wordType) q.set("wordType", params.wordType);
  if (params.radical) q.set("radical", params.radical);
  return `?${q.toString()}`;
}

// ---- hiển thị ----

export function primaryPinyin(vocab: Pick<Vocabulary, "pinyins">): VocabularyPinyin | undefined {
  const list = vocab.pinyins ?? [];
  return list.find((p) => p.isPrimary) ?? list[0];
}

export function allMeanings(vocab: Pick<Vocabulary, "pinyins">): VocabularyMeaning[] {
  return (vocab.pinyins ?? []).flatMap((p) => p.meanings ?? []);
}

/** Từ loại là của từng pinyin (chuỗi phẩy); gộp mọi pinyin, bỏ trùng, giữ thứ tự. */
export function wordTypesOf(vocab: Pick<Vocabulary, "pinyins">): string[] {
  return [...new Set((vocab.pinyins ?? []).flatMap((p) => splitWordTypes(p.wordTypes)))];
}

export function splitWordTypes(value: string | undefined | null): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Nghĩa chính gộp bằng "; " (ô "Nghĩa chính" của bảng cũ); rỗng => "---". */
export function meaningsSummary(vocab: Pick<Vocabulary, "pinyins">): string {
  return allMeanings(vocab).map((m) => m.meaning || m.meaningEn || m.meaningZh).filter(Boolean).join("; ") || "---";
}

const HSK_BADGE_STYLES: Record<number, { backgroundColor: string; color: string }> = {
  1: { backgroundColor: "#dceefb", color: "#175586" },
  2: { backgroundColor: "#dcf3ef", color: "#17645a" },
  3: { backgroundColor: "#e8f2d9", color: "#416222" },
  4: { backgroundColor: "#faedce", color: "#735117" },
  5: { backgroundColor: "#e3e6fa", color: "#414b85" },
  6: { backgroundColor: "#eee3fa", color: "#654091" },
};

export function hskBadgeStyle(level: number) {
  return HSK_BADGE_STYLES[level] ?? { backgroundColor: "#eef0f3", color: "#475467" };
}

export interface BadgeStyle {
  bg: string;
  color: string;
  border: string;
}

const WORD_TYPE_STYLES: Record<string, BadgeStyle> = {
  "Danh từ": { bg: "#e3f2fd", color: "#1565c0", border: "1px solid #bbdefb" },
  "Động từ": { bg: "#e8f5e9", color: "#2e7d32", border: "1px solid #c8e6c9" },
  "Tính từ": { bg: "#f3e5f5", color: "#7b1fa2", border: "1px solid #e1bee7" },
  "Trạng từ": { bg: "#fff3e0", color: "#e65100", border: "1px solid #ffe0b2" },
  "Phó từ": { bg: "#fff3e0", color: "#e65100", border: "1px solid #ffe0b2" },
  "Đại từ": { bg: "#e8eaf6", color: "#283593", border: "1px solid #c5cae9" },
  "Giới từ": { bg: "#fbe9e7", color: "#d84315", border: "1px solid #ffccbc" },
  "Liên từ": { bg: "#e0f7fa", color: "#00838f", border: "1px solid #b2ebf2" },
  "Thán từ": { bg: "#fff8e1", color: "#f57f17", border: "1px solid #ffecb3" },
  "Thành ngữ": { bg: "#e0f2f1", color: "#00695c", border: "1px solid #b2dfdb" },
  "Cụm từ": { bg: "#eceff1", color: "#37474f", border: "1px solid #cfd8dc" },
  "Trợ từ": { bg: "#f5f5f5", color: "#616161", border: "1px solid #e0e0e0" },
  "Trợ động từ": { bg: "#f1f8e9", color: "#33691e", border: "1px solid #dcedc8" },
  "Lượng từ": { bg: "#e0f2f1", color: "#00796b", border: "1px solid #b2dfdb" },
  "Số từ": { bg: "#fce4ec", color: "#c2185b", border: "1px solid #f8bbd0" },
  "Từ tượng thanh": { bg: "#f9fbe7", color: "#827717", border: "1px solid #dce775" },
  "Tiền tố": { bg: "#efebe9", color: "#5d4037", border: "1px solid #d7ccc8" },
  "Hậu tố": { bg: "#efebe9", color: "#5d4037", border: "1px solid #d7ccc8" },
  "Hình dung từ": { bg: "#ede7f6", color: "#4527a0", border: "1px solid #d1c4e9" },
};

/** Bảng màu huy hiệu từ loại (core/utils/vocabulary-utils.ts cũ, nguyên văn); loại lạ => xám. */
export function wordTypeBadgeStyle(type: string): BadgeStyle {
  return WORD_TYPE_STYLES[type] ?? { bg: "#f5f5f5", color: "#616161", border: "1px solid #eeeeee" };
}

// ---- lượng từ "个 [gè], 本 [běn]" ----

export interface MeasureWord {
  hanzi: string;
  pinyin: string;
}

export function parseMeasureWords(value: string | undefined | null): MeasureWord[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => {
      const m = item.trim().match(/^(.+?)\s*\[(.+?)\]$/);
      return m ? { hanzi: m[1].trim(), pinyin: m[2].trim() } : { hanzi: item.trim(), pinyin: "" };
    })
    .filter((w) => w.hanzi);
}

export function formatMeasureWords(words: readonly MeasureWord[]): string {
  return words
    .filter((w) => w.hanzi.trim())
    .map((w) => (w.pinyin.trim() ? `${w.hanzi.trim()} [${w.pinyin.trim()}]` : w.hanzi.trim()))
    .join(", ");
}

// ---- từ ghép / đồng nghĩa / trái nghĩa: JSON [{hanzi, pinyin?|sinoVietnamese?}] ----

export interface RelatedWord {
  hanzi: string;
  /** Pinyin (đồng/trái nghĩa) hoặc Hán Việt (từ ghép) — cùng một ô phụ trên giao diện. */
  extra: string;
}

/** JSON hỏng/không phải mảng => [] (bản cũ try/catch về []). */
export function parseRelatedWords(value: string | undefined | null, extraKey: "pinyin" | "sinoVietnamese"): RelatedWord[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): RelatedWord | null => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        const hanzi = typeof record.hanzi === "string" ? record.hanzi.trim() : "";
        const extra = typeof record[extraKey] === "string" ? (record[extraKey] as string).trim() : "";
        return hanzi ? { hanzi, extra } : null;
      })
      .filter((w): w is RelatedWord => w !== null);
  } catch {
    return [];
  }
}

/** Chuỗi JSON cho máy chủ; rỗng => undefined (bản cũ không gửi mảng rỗng). */
export function formatRelatedWords(words: readonly RelatedWord[], extraKey: "pinyin" | "sinoVietnamese"): string | undefined {
  const valid = words.filter((w) => w.hanzi.trim()).map((w) => ({ hanzi: w.hanzi.trim(), [extraKey]: w.extra.trim() || null }));
  return valid.length > 0 ? JSON.stringify(valid) : undefined;
}
