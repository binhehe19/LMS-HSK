// Hàm thuần của màn Từ điển học viên (/vocabulary): trạng thái lọc/trang đọc-ghi qua URL (nguồn sự thật duy nhất), cửa sổ phân trang, tóm tắt thẻ từ.
// Giữ nguyên hợp đồng query của HSK cũ: keySearch, hskLevel, radical (ký tự bộ thủ), strokeFilter, page (từ 0).
import { RADICAL_MAP } from "@/lib/dictionary/radical-data";
import type { Vocabulary, VocabularyPinyin } from "@/types/dictionary";

/** Số từ mỗi trang như bản cũ (size: 10). */
export const VOCABULARY_PAGE_SIZE = 10;
const MAX_KEYWORD = 100;

export interface VocabularyListState {
  keySearch: string;
  hskLevel?: number;
  radical?: string;
  /** Lọc nhanh theo số nét của bộ thủ (chỉ thu hẹp lưới bộ thủ, không gọi API). */
  strokeFilter: number | null;
  page: number;
}

const intIn = (raw: string | null, min: number, max: number): number | undefined => {
  if (raw === null || !/^\d+$/.test(raw.trim())) return undefined;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : undefined;
};

/** Đọc trạng thái từ URL; giá trị lạ bị bỏ qua (không gửi lên API). Thiếu strokeFilter thì suy từ bộ thủ đang chọn như bản cũ. */
export function readVocabularyListState(params: URLSearchParams): VocabularyListState {
  const keySearch = (params.get("keySearch") ?? "").slice(0, MAX_KEYWORD);
  const rawRadical = params.get("radical") ?? "";
  const radical = RADICAL_MAP[rawRadical] ? rawRadical : undefined;
  const fromUrl = intIn(params.get("strokeFilter"), 1, 30);
  const strokeFilter = fromUrl ?? (radical ? RADICAL_MAP[radical].strokeCount : null);
  return { keySearch, hskLevel: intIn(params.get("hskLevel"), 1, 9), radical, strokeFilter, page: intIn(params.get("page"), 0, 1_000_000) ?? 0 };
}

/** Ghi trạng thái ra query string (luôn có page như bản cũ). */
export function vocabularyListQuery(state: VocabularyListState): string {
  const q = new URLSearchParams();
  if (state.keySearch) q.set("keySearch", state.keySearch);
  if (state.radical) q.set("radical", state.radical);
  if (state.strokeFilter !== null) q.set("strokeFilter", String(state.strokeFilter));
  if (state.hskLevel !== undefined) q.set("hskLevel", String(state.hskLevel));
  q.set("page", String(state.page));
  return `?${q.toString()}`;
}

/** Khoá tải dữ liệu: chỉ các trường gửi lên API (strokeFilter không đổi kết quả nên không tải lại). */
export function vocabularyListKey(state: VocabularyListState): string {
  return JSON.stringify([state.keySearch.trim(), state.hskLevel ?? null, state.radical ?? null, state.page]);
}

export type PageSlot = { kind: "page"; index: number } | { kind: "gap"; key: string };

/** Các ô phân trang như bản cũ: trang đầu, trang cuối, trang hiện tại ±1; "…" ở ±2 (chỉ số từ 0). */
export function paginationSlots(current: number, totalPages: number): PageSlot[] {
  const slots: PageSlot[] = [];
  for (let i = 0; i < totalPages; i++) {
    if (i === 0 || i === totalPages - 1 || (i >= current - 1 && i <= current + 1)) slots.push({ kind: "page", index: i });
    else if (i === current - 2 || i === current + 2) slots.push({ kind: "gap", key: `gap-${i}` });
    // Nhảy qua các trang bị ẩn thay vì duyệt từng trang (từ điển ~13 nghìn trang).
    else if (i < current - 2) i = current - 3;
    else if (i > current + 2) i = totalPages - 2;
  }
  return slots;
}

/** Phiên âm hiển thị trên thẻ: phiên âm đầu như bản cũ (thẻ danh sách không chọn theo isPrimary). */
function firstPinyin(v: Vocabulary): VocabularyPinyin | undefined {
  return v.pinyins?.[0];
}

export interface VocabularyCardSummary {
  pinyin: string;
  wordTypes: string[];
  meaning: string;
}

export function vocabularyCardSummary(v: Vocabulary): VocabularyCardSummary {
  const p = firstPinyin(v);
  return {
    pinyin: p?.pinyin ?? "",
    wordTypes: (p?.wordTypes ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    meaning: (p?.meanings ?? []).map((m) => m.meaning).filter(Boolean).join("; "),
  };
}

/** 214 bộ thủ nhóm theo số nét, tính một lần. */
export const RADICALS_BY_STROKE: Readonly<Record<number, string[]>> = Object.entries(RADICAL_MAP).reduce<Record<number, string[]>>((acc, [char, info]) => {
  (acc[info.strokeCount] ??= []).push(char);
  return acc;
}, {});

export const STROKE_GROUPS: readonly number[] = Object.keys(RADICALS_BY_STROKE)
  .map(Number)
  .sort((a, b) => a - b);
