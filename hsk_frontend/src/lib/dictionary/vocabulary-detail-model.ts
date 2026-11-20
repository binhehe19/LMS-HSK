// Hàm thuần của trang Chi tiết từ vựng học viên (/vocabulary/:id) — tách từ vocabulary-detail.tsx của HSK cũ để test được.
// Khác bản cũ: mô hình mới không còn trường "legacy flat" (pinyin/wordTypes ở cấp từ) và componentVocabs, nên pinyin/từ loại
// chỉ lấy từ pinyins[], chữ thành phần lấy từ `components` do backend tra sẵn.
import type { VocabularyComponent, VocabularyExample, VocabularyMeaning, VocabularyPinyin } from "@/types/dictionary";
import { RADICAL_MAP } from "@/lib/dictionary/radical-data";

/** Pinyin chính: mục `isPrimary`, không có thì mục đầu tiên (bản cũ bỏ bộ chọn pinyin — bám thiết kế). */
export function selectPrimaryPinyin(pinyins: VocabularyPinyin[] | undefined): VocabularyPinyin | undefined {
  const list = pinyins ?? [];
  return list.find((p) => p.isPrimary) ?? list[0];
}

/** Tất cả từ loại của pinyin chính ("Động từ,Danh từ" → ["Động từ", "Danh từ"]). */
export function splitWordTypes(pinyin: VocabularyPinyin | undefined): string[] {
  return (pinyin?.wordTypes ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** Mọi câu ví dụ tiếng Trung của các nghĩa, theo thứ tự nghĩa — mỗi câu là một ví dụ / một lượt hội thoại. */
export function selectExamples(meanings: VocabularyMeaning[] | undefined): VocabularyExample[] {
  return (meanings ?? []).flatMap((m) => m.examples ?? []).filter((e) => Boolean(e.zh));
}

/**
 * Ký tự bộ thủ từ trường `radical`. Dữ liệu nhập ở màn quản lý có thể là "NHẤT 一" (tên + ký tự) hoặc chỉ "一":
 * lấy phần sau khoảng trắng cuối cùng.
 */
export function radicalCharacter(radical: string | undefined): string {
  const text = (radical ?? "").trim();
  if (!text) return "";
  const parts = text.split(/\s+/);
  return parts[parts.length - 1];
}

/** Một ô trong khối "Phân tích thành phần" (cột phải của sơ đồ). `id` khác null = chữ có trong từ điển, bấm được. */
export interface AnalysisNode {
  key: string;
  id: string | null;
  hanzi: string;
  title: string;
  desc: string;
}

/**
 * Chữ thành phần do backend trả về; không có thì rơi về ô bộ thủ (tra RADICAL_MAP theo KÝ TỰ bộ thủ) như bản cũ.
 * Bỏ ô trùng nguyên từ (backend có thể trả chính chữ đó cho từ đơn) để từ đơn vẫn hiện bộ thủ như bản cũ.
 */
export function buildAnalysisNodes(hanzi: string, components: VocabularyComponent[] | undefined, radical: string | undefined): AnalysisNode[] {
  const parts = (components ?? []).filter((c) => c.hanzi && c.hanzi !== hanzi);
  if (parts.length > 0) {
    return parts.map((c, i) => ({ key: `${c.hanzi}-${i}`, id: c.id, hanzi: c.hanzi, title: c.pinyin ?? "", desc: c.meaning ?? "" }));
  }
  const char = radicalCharacter(radical);
  const info = char ? RADICAL_MAP[char] : undefined;
  if (!info) return [];
  return [{ key: `radical-${char}`, id: null, hanzi: char, title: `Bộ ${info.nameVi}`, desc: `${info.strokeCount} nét` }];
}

/** Cắt câu thành các đoạn để tô đỏ chữ đang tra (giống Highlight của bản cũ: so khớp chính xác, phân biệt hoa thường). */
export function splitHighlight(text: string, needle: string): { text: string; hit: boolean }[] {
  if (!needle || !text.includes(needle)) return [{ text, hit: false }];
  const pieces = text.split(needle);
  return pieces.flatMap((piece, i) => (i < pieces.length - 1 ? [{ text: piece, hit: false }, { text: needle, hit: true }] : [{ text: piece, hit: false }]));
}

const CJK = /[一-鿿]/;

/** Ghép mỗi chữ Hán với một âm tiết pinyin; dấu câu không nhận pinyin (popup Luyện phát âm). */
export function alignPinyin(cn: string, pinyin: string | undefined): { char: string; pinyin: string }[] {
  const syllables = (pinyin ?? "").trim().split(/\s+/).filter(Boolean);
  let i = 0;
  return Array.from(cn).map((char) => ({ char, pinyin: CJK.test(char) ? (syllables[i++] ?? "") : "" }));
}
