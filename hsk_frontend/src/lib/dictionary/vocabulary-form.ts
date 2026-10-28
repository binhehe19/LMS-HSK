// Giá trị form Thêm/Sửa từ vựng (vocabulary-form-modal.tsx cũ): mỗi pinyin có từ loại, nghĩa, lượng từ, từ ghép, đồng/trái nghĩa riêng.
// Kiểm tra giữ nguyên thông điệp bản cũ; chuẩn hoá thành VocabularyInput (JSON cho compounds/synonyms/antonyms, "a,b" cho wordTypes).
import { formatRelatedWords, parseRelatedWords, splitWordTypes, type RelatedWord } from "@/lib/dictionary/vocabulary-model";
import type { Vocabulary, VocabularyInput, VocabularyStatus } from "@/types/dictionary";

export interface MeaningFormItem {
  meaning: string;
  exampleSentenceCn: string;
  exampleSentencePinyin: string;
  exampleSentenceVi: string;
  exampleSentenceEn: string;
  exampleWordType: string;
}

export interface PinyinFormItem {
  pinyin: string;
  sinoVietnamese: string;
  wordTypes: string[];
  isPrimary: boolean;
  /** Chuỗi "个 [gè], 本 [běn]" như máy chủ lưu. */
  measureWord: string;
  compounds: RelatedWord[];
  synonyms: RelatedWord[];
  antonyms: RelatedWord[];
  notes: string;
  meanings: MeaningFormItem[];
}

export interface VocabularyFormValues {
  hanzi: string;
  status: VocabularyStatus;
  hskLevel: number;
  radical: string;
  /** Giữ dạng chuỗi để ô nhập số được để trống. */
  strokeCount: string;
  strokes: string;
  isSingleVocab: boolean;
  notes: string;
  imageUrl: string;
  strokeAnimationUrl: string;
  etymologyStory: string;
  etymologyImage: string;
  pinyins: PinyinFormItem[];
}

export type VocabularyFormTab = "info" | "meaning" | "compounds" | "related" | "details";

export function emptyMeaning(): MeaningFormItem {
  return { meaning: "", exampleSentenceCn: "", exampleSentencePinyin: "", exampleSentenceVi: "", exampleSentenceEn: "", exampleWordType: "" };
}

export function emptyPinyin(isPrimary = false): PinyinFormItem {
  return { pinyin: "", sinoVietnamese: "", wordTypes: [], isPrimary, measureWord: "", compounds: [], synonyms: [], antonyms: [], notes: "", meanings: [emptyMeaning()] };
}

export function emptyVocabularyForm(): VocabularyFormValues {
  return { hanzi: "", status: "draft", hskLevel: 1, radical: "", strokeCount: "", strokes: "", isSingleVocab: true, notes: "", imageUrl: "", strokeAnimationUrl: "", etymologyStory: "", etymologyImage: "", pinyins: [emptyPinyin(true)] };
}

const asStatus = (value: string | undefined): VocabularyStatus => (value?.toLowerCase() === "published" ? "published" : "draft");

export function vocabularyToForm(vocab: Vocabulary): VocabularyFormValues {
  const pinyins = (vocab.pinyins ?? []).map(
    (p): PinyinFormItem => ({
      pinyin: p.pinyin ?? "",
      sinoVietnamese: p.sinoVietnamese ?? "",
      wordTypes: splitWordTypes(p.wordTypes),
      isPrimary: p.isPrimary ?? false,
      measureWord: p.measureWord ?? "",
      compounds: parseRelatedWords(p.compounds, "sinoVietnamese"),
      synonyms: parseRelatedWords(p.synonyms, "pinyin"),
      antonyms: parseRelatedWords(p.antonyms, "pinyin"),
      notes: p.notes ?? "",
      meanings:
        p.meanings && p.meanings.length > 0
          ? p.meanings.map((m) => ({ meaning: m.meaning ?? "", exampleSentenceCn: m.exampleSentenceCn ?? "", exampleSentencePinyin: m.exampleSentencePinyin ?? "", exampleSentenceVi: m.exampleSentenceVi ?? "", exampleSentenceEn: m.exampleSentenceEn ?? "", exampleWordType: m.exampleWordType ?? "" }))
          : [emptyMeaning()],
    }),
  );
  if (pinyins.length > 0 && !pinyins.some((p) => p.isPrimary)) pinyins[0].isPrimary = true;
  return {
    hanzi: vocab.hanzi ?? "",
    status: asStatus(vocab.status),
    hskLevel: vocab.hskLevel ?? 1,
    radical: vocab.radical ?? "",
    strokeCount: vocab.strokeCount ? String(vocab.strokeCount) : "",
    strokes: vocab.strokes ?? "",
    isSingleVocab: vocab.isSingleVocab ?? true,
    notes: vocab.notes ?? "",
    imageUrl: vocab.imageUrl ?? "",
    strokeAnimationUrl: vocab.strokeAnimationUrl ?? "",
    etymologyStory: vocab.etymologyStory ?? "",
    etymologyImage: vocab.etymologyImage ?? "",
    pinyins: pinyins.length > 0 ? pinyins : [emptyPinyin(true)],
  };
}

export interface VocabularyFormError {
  message: string;
  /** Tab cần mở để sửa lỗi (bản cũ chuyển tab khi báo lỗi). */
  tab: VocabularyFormTab;
}

/** Thông điệp giữ nguyên bản cũ; thêm kiểm tra Hán tự bắt buộc (bản cũ dựa vào máy chủ). */
export function validateVocabularyForm(values: VocabularyFormValues): VocabularyFormError | null {
  if (!values.hanzi.trim()) return { message: "Vui lòng nhập Hán tự!", tab: "info" };
  if (!values.pinyins.some((p) => p.isPrimary)) return { message: "Phải có ít nhất một pinyin được đặt làm chính!", tab: "info" };
  if (values.pinyins.some((p) => !p.pinyin.trim())) return { message: "Vui lòng nhập đầy đủ phiên âm cho tất cả pinyin!", tab: "info" };
  if (values.pinyins.some((p) => p.meanings.length === 0 || p.meanings.some((m) => !m.meaning.trim()))) return { message: "Vui lòng nhập đầy đủ các nghĩa!", tab: "meaning" };
  if (values.strokeCount.trim() !== "" && !(Number.isInteger(Number(values.strokeCount)) && Number(values.strokeCount) > 0)) return { message: "Số nét phải lớn hơn 0!", tab: "info" };
  return null;
}

const clean = (value: string): string | undefined => {
  const v = value.trim();
  return v ? v : undefined;
};

/** Thân gửi máy chủ theo đúng cách bản cũ dựng payload (trường rỗng => bỏ; JSON cho danh sách; không gửi mảng rỗng). */
export function buildVocabularyPayload(values: VocabularyFormValues): VocabularyInput {
  return {
    hanzi: values.hanzi.trim(),
    hskLevel: values.hskLevel,
    imageUrl: clean(values.imageUrl),
    strokeAnimationUrl: clean(values.strokeAnimationUrl),
    etymologyStory: clean(values.etymologyStory),
    etymologyImage: clean(values.etymologyImage),
    radical: clean(values.radical),
    strokeCount: values.strokeCount.trim() ? Number(values.strokeCount) : undefined,
    strokes: clean(values.strokes),
    isSingleVocab: values.isSingleVocab,
    notes: clean(values.notes),
    status: values.status,
    pinyins: values.pinyins.map((p) => ({
      pinyin: p.pinyin.trim(),
      sinoVietnamese: clean(p.sinoVietnamese),
      wordTypes: p.wordTypes.length > 0 ? p.wordTypes.join(",") : undefined,
      isPrimary: p.isPrimary,
      measureWord: clean(p.measureWord),
      compounds: formatRelatedWords(p.compounds, "sinoVietnamese"),
      synonyms: formatRelatedWords(p.synonyms, "pinyin"),
      antonyms: formatRelatedWords(p.antonyms, "pinyin"),
      notes: clean(p.notes),
      meanings: p.meanings.map((m) => ({
        meaning: m.meaning.trim(),
        exampleSentenceCn: clean(m.exampleSentenceCn),
        exampleSentencePinyin: clean(m.exampleSentencePinyin),
        exampleSentenceVi: clean(m.exampleSentenceVi),
        exampleSentenceEn: clean(m.exampleSentenceEn),
        exampleWordType: clean(m.exampleWordType),
      })),
    })),
  };
}

/** Đặt pinyin `index` làm chính (chỉ một pinyin chính). */
export function setPrimaryPinyin(pinyins: readonly PinyinFormItem[], index: number): PinyinFormItem[] {
  return pinyins.map((p, i) => ({ ...p, isPrimary: i === index }));
}

/** Xoá pinyin; luôn giữ ≥ 1 và luôn có một pinyin chính (bản cũ chuyển "chính" sang phần tử đầu). */
export function removePinyin(pinyins: readonly PinyinFormItem[], index: number): PinyinFormItem[] {
  if (pinyins.length <= 1) return [...pinyins];
  const next = pinyins.filter((_, i) => i !== index);
  if (!next.some((p) => p.isPrimary)) next[0] = { ...next[0], isPrimary: true };
  return next;
}
