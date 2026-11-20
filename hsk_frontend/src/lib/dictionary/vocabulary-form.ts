// Giá trị form Thêm/Sửa từ vựng (vocabulary-form-modal.tsx cũ): mỗi pinyin có từ loại, nghĩa, lượng từ, từ ghép, đồng/trái nghĩa riêng.
// Kiểm tra giữ nguyên thông điệp bản cũ; chuẩn hoá thành VocabularyInput (JSON cho compounds/synonyms/antonyms, "a,b" cho wordTypes).
import { formatRelatedWords, parseRelatedWords, splitWordTypes, type RelatedWord } from "@/lib/dictionary/vocabulary-model";
import type { Vocabulary, VocabularyExample, VocabularyInput, VocabularyStatus } from "@/types/dictionary";

/** Một câu ví dụ trong form; ô trống được bỏ khi gửi. */
export interface ExampleFormItem extends Pick<VocabularyExample, "zhHtml" | "pinyinHtml" | "viHtml"> {
  zh: string;
  pinyin: string;
  vi: string;
  en: string;
}

export interface MeaningFormItem {
  meaning: string;
  meaningEn: string;
  meaningZh: string;
  meaningViHtml?: string;
  meaningZhHtml?: string;
  /** Loại từ của nghĩa này. */
  exampleWordType: string;
  /** Các câu ví dụ của nghĩa này. */
  examples: ExampleFormItem[];
}

export interface PinyinFormItem {
  pinyin: string;
  audioUrl?: string;
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
  isSingleVocab: boolean;
  notes: string;
  notesHtml?: string;
  imageUrl: string;
  etymologyStory: string;
  etymologyStoryHtml?: string;
  pinyins: PinyinFormItem[];
}

export type VocabularyFormTab = "info" | "meaning" | "compounds" | "related" | "details";

export function emptyExample(): ExampleFormItem {
  return { zh: "", pinyin: "", vi: "", en: "" };
}

export function emptyMeaning(): MeaningFormItem {
  return { meaning: "", meaningEn: "", meaningZh: "", exampleWordType: "", examples: [emptyExample()] };
}

/** Ví dụ của máy chủ → ô nhập; nghĩa chưa có ví dụ vẫn hiện một dòng trống để nhập. */
function examplesToForm(examples: VocabularyExample[] | undefined): ExampleFormItem[] {
  const list = (examples ?? []).map(e => ({ ...e, zh: e.zh ?? "", pinyin: e.pinyin ?? "", vi: e.vi ?? "", en: e.en ?? "" }));
  return list.length > 0 ? list : [emptyExample()];
}

export function emptyPinyin(isPrimary = false): PinyinFormItem {
  return { pinyin: "", sinoVietnamese: "", wordTypes: [], isPrimary, measureWord: "", compounds: [], synonyms: [], antonyms: [], notes: "", meanings: [emptyMeaning()] };
}

export function emptyVocabularyForm(): VocabularyFormValues {
  return { hanzi: "", status: "draft", hskLevel: 1, radical: "", isSingleVocab: true, notes: "", imageUrl: "", etymologyStory: "", pinyins: [emptyPinyin(true)] };
}

const asStatus = (value: string | undefined): VocabularyStatus => (value?.toLowerCase() === "published" ? "published" : "draft");

export function vocabularyToForm(vocab: Vocabulary): VocabularyFormValues {
  const pinyins = (vocab.pinyins ?? []).map(
    (p): PinyinFormItem => ({
      pinyin: p.pinyin ?? "",
      audioUrl: p.audioUrl ?? "",
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
          ? p.meanings.map(m => ({
            meaning: m.meaning ?? "",
            meaningEn: m.meaningEn ?? "",
            meaningZh: m.meaningZh ?? "",
            meaningViHtml: m.meaningViHtml,
            meaningZhHtml: m.meaningZhHtml,
            exampleWordType: m.exampleWordType ?? "",
            examples: examplesToForm(m.examples),
          }))
          : [emptyMeaning()],
    }),
  );
  if (pinyins.length > 0 && !pinyins.some((p) => p.isPrimary)) pinyins[0].isPrimary = true;
  return {
    hanzi: vocab.hanzi ?? "",
    status: asStatus(vocab.status),
    hskLevel: vocab.hskLevel ?? 1,
    radical: vocab.radical ?? "",
    isSingleVocab: vocab.isSingleVocab ?? true,
    notes: vocab.notes ?? "",
    notesHtml: vocab.notesHtml,
    imageUrl: vocab.imageUrl ?? "",
    etymologyStory: vocab.etymologyStory ?? "",
    etymologyStoryHtml: vocab.etymologyStoryHtml,
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
  if (values.pinyins.some((p) => p.meanings.length === 0 || p.meanings.some((m) => !m.meaning.trim() && !m.meaningEn.trim() && !m.meaningZh.trim()))) return { message: "Vui lòng nhập đầy đủ các nghĩa!", tab: "meaning" };
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
    etymologyStory: clean(values.etymologyStory),
    etymologyStoryHtml: values.etymologyStoryHtml,
    radical: clean(values.radical),
    isSingleVocab: values.isSingleVocab,
    notes: clean(values.notes),
    notesHtml: values.notesHtml,
    status: values.status,
    pinyins: values.pinyins.map((p) => ({
      pinyin: p.pinyin.trim(),
      audioUrl: clean(p.audioUrl ?? ""),
      sinoVietnamese: clean(p.sinoVietnamese),
      wordTypes: p.wordTypes.length > 0 ? p.wordTypes.join(",") : undefined,
      isPrimary: p.isPrimary,
      measureWord: clean(p.measureWord),
      compounds: formatRelatedWords(p.compounds, "sinoVietnamese"),
      synonyms: formatRelatedWords(p.synonyms, "pinyin"),
      antonyms: formatRelatedWords(p.antonyms, "pinyin"),
      notes: clean(p.notes),
      meanings: p.meanings.map((m) => {
        // Dòng ví dụ trống hoàn toàn bị bỏ; không còn ví dụ nào thì không gửi khóa examples.
        const examples = m.examples
          .map(e => ({ ...e, zh: clean(e.zh), pinyin: clean(e.pinyin), vi: clean(e.vi), en: clean(e.en) }))
          .filter((e) => e.zh || e.pinyin || e.vi || e.en);
        return {
          meaning: m.meaning.trim(),
          meaningEn: clean(m.meaningEn),
          meaningZh: clean(m.meaningZh),
          meaningViHtml: m.meaningViHtml,
          meaningZhHtml: m.meaningZhHtml,
          exampleWordType: clean(m.exampleWordType),
          examples: examples.length > 0 ? examples : undefined,
        };
      }),
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
