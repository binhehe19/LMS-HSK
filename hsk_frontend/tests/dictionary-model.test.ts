import { describe, expect, it } from "vitest";
import { buildVocabularyPayload, emptyPinyin, emptyVocabularyForm, removePinyin, setPrimaryPinyin, validateVocabularyForm, vocabularyToForm } from "@/lib/dictionary/vocabulary-form";
import { allMeanings, buildSearchQuery, DEFAULT_DICTIONARY_FILTERS, dictionaryHref, dictionaryQuery, formatMeasureWords, formatRelatedWords, hskBadgeClass, meaningsSummary, parseMeasureWords, parseRelatedWords, primaryPinyin, readDictionaryFilters, toSearchParams, WORD_TYPES, wordTypeBadgeStyle, wordTypesOf } from "@/lib/dictionary/vocabulary-model";
import type { Vocabulary } from "@/types/dictionary";

const hao: Vocabulary = {
  id: "2",
  hanzi: "好",
  hskLevel: 1,
  isSingleVocab: true,
  radical: "女",
  strokeCount: 6,
  status: "published",
  pinyins: [
    { id: "21", pinyin: "hǎo", sinoVietnamese: "hảo", wordTypes: "Tính từ, Phó từ", isPrimary: false, measureWord: "", compounds: JSON.stringify([{ hanzi: "好吃", sinoVietnamese: "hảo cật" }]), synonyms: JSON.stringify([{ hanzi: "棒", pinyin: "bàng" }]), antonyms: "không phải json", meanings: [{ id: "1", meaning: "tốt", exampleSentenceCn: "很好。" }, { id: "2", meaning: "khỏe" }] },
    { id: "22", pinyin: "hào", sinoVietnamese: "hiếu", wordTypes: "Động từ", isPrimary: true, meanings: [{ id: "3", meaning: "thích" }] },
  ],
};

describe("vocabulary-model — bộ lọc trong URL và tham số máy chủ", () => {
  it("readDictionaryFilters: mặc định; giá trị hợp lệ; giá trị lạ bị bỏ (hskLevel 9, isSingleVocab x, wordType lạ, page 0/abc)", () => {
    expect(readDictionaryFilters(new URLSearchParams(""))).toEqual(DEFAULT_DICTIONARY_FILTERS);
    expect(readDictionaryFilters(new URLSearchParams("keySearch=%20h%E1%BA%A3o%20&hskLevel=2&isSingleVocab=false&wordType=Danh+t%E1%BB%AB&radical=%E5%8F%A3&page=3"))).toEqual({ keySearch: "hảo", hskLevel: 2, isSingleVocab: false, wordType: "Danh từ", radical: "口", page: 3 });
    expect(readDictionaryFilters(new URLSearchParams("hskLevel=9&isSingleVocab=x&wordType=Khac&page=0"))).toEqual({ keySearch: "", hskLevel: undefined, isSingleVocab: undefined, wordType: undefined, radical: undefined, page: 1 });
    expect(readDictionaryFilters(new URLSearchParams("page=abc&isSingleVocab=true")).page).toBe(1);
    expect(readDictionaryFilters(new URLSearchParams("isSingleVocab=true")).isSingleVocab).toBe(true);
  });

  it("dictionaryQuery/dictionaryHref: bỏ giá trị mặc định, thứ tự cố định, page>1 mới ghi", () => {
    expect(dictionaryQuery(DEFAULT_DICTIONARY_FILTERS)).toBe("");
    // URLSearchParams mã hoá khoảng trắng thành "+" (khác encodeURIComponent).
    expect(dictionaryQuery({ keySearch: "ni", hskLevel: 1, isSingleVocab: true, wordType: "Đại từ", radical: "亻", page: 2 })).toBe(`?keySearch=ni&hskLevel=1&isSingleVocab=true&wordType=${encodeURIComponent("Đại")}+${encodeURIComponent("từ")}&radical=${encodeURIComponent("亻")}&page=2`);
    expect(dictionaryHref("/vocabulary/manage", { ...DEFAULT_DICTIONARY_FILTERS, page: 1 })).toBe("/vocabulary/manage");
    expect(dictionaryHref("/vocabulary/manage", { ...DEFAULT_DICTIONARY_FILTERS, page: 4 })).toBe("/vocabulary/manage?page=4");
  });

  it("toSearchParams đổi page 1-based => 0-based và kích cỡ trang; buildSearchQuery luôn gửi keySearch, chỉ gửi tham số có giá trị", () => {
    expect(toSearchParams({ keySearch: "a", hskLevel: 3, page: 2 })).toEqual({ keySearch: "a", hskLevel: 3, isSingleVocab: undefined, wordType: undefined, radical: undefined, page: 1, size: 10 });
    expect(toSearchParams(DEFAULT_DICTIONARY_FILTERS, 25)).toMatchObject({ page: 0, size: 25 });
    expect(buildSearchQuery({ keySearch: "", page: 0, size: 10 })).toBe("?keySearch=&page=0&size=10");
    expect(buildSearchQuery({ keySearch: "nǐ hǎo", isSingleVocab: false, hskLevel: 2, wordType: "Danh từ", radical: "口", page: 1, size: 10 })).toBe(`?keySearch=${encodeURIComponent("nǐ hǎo").replace(/%20/g, "+")}&isSingleVocab=false&page=1&size=10&hskLevel=2&wordType=Danh+${encodeURIComponent("từ")}&radical=${encodeURIComponent("口")}`);
  });
});

describe("vocabulary-model — hiển thị", () => {
  it("primaryPinyin ưu tiên isPrimary (không thì phần tử đầu); allMeanings gộp mọi pinyin; wordTypesOf bỏ trùng; meaningsSummary nối '; '", () => {
    expect(primaryPinyin(hao)?.pinyin).toBe("hào");
    expect(primaryPinyin({ pinyins: [{ pinyin: "a", meanings: [] }, { pinyin: "b", meanings: [] }] })?.pinyin).toBe("a");
    expect(primaryPinyin({ pinyins: [] })).toBeUndefined();
    expect(allMeanings(hao).map((m) => m.meaning)).toEqual(["tốt", "khỏe", "thích"]);
    expect(wordTypesOf(hao)).toEqual(["Tính từ", "Phó từ", "Động từ"]);
    expect(meaningsSummary(hao)).toBe("tốt; khỏe; thích");
    expect(meaningsSummary({ pinyins: [] })).toBe("---");
  });

  it("huy hiệu HSK và từ loại (bảng màu bản cũ, dự phòng xám); WORD_TYPES đủ 19 mục không trùng", () => {
    expect(hskBadgeClass(1)).toBe("bg-info bg-opacity-10 text-info");
    expect(hskBadgeClass(6)).toBe("bg-dark bg-opacity-10 text-dark");
    expect(hskBadgeClass(undefined)).toBe("bg-secondary bg-opacity-10 text-secondary");
    expect(wordTypeBadgeStyle("Danh từ")).toEqual({ bg: "#e3f2fd", color: "#1565c0", border: "1px solid #bbdefb" });
    expect(wordTypeBadgeStyle("Lạ")).toEqual({ bg: "#f5f5f5", color: "#616161", border: "1px solid #eeeeee" });
    expect(WORD_TYPES).toHaveLength(19);
    expect(new Set(WORD_TYPES).size).toBe(WORD_TYPES.length);
  });

  it("lượng từ: parse '个 [gè], 本' và format ngược (bỏ rỗng)", () => {
    expect(parseMeasureWords("个 [gè], 本 ,, 张[zhāng]")).toEqual([{ hanzi: "个", pinyin: "gè" }, { hanzi: "本", pinyin: "" }, { hanzi: "张", pinyin: "zhāng" }]);
    expect(parseMeasureWords(undefined)).toEqual([]);
    expect(formatMeasureWords([{ hanzi: "个", pinyin: " gè " }, { hanzi: "本", pinyin: "" }, { hanzi: " ", pinyin: "x" }])).toBe("个 [gè], 本");
  });

  it("từ liên quan: JSON hỏng/không phải mảng => []; parse theo khoá phụ; format rỗng => undefined, khoá phụ rỗng => null", () => {
    expect(parseRelatedWords("không phải json", "pinyin")).toEqual([]);
    expect(parseRelatedWords(JSON.stringify({ hanzi: "x" }), "pinyin")).toEqual([]);
    expect(parseRelatedWords(JSON.stringify([{ hanzi: " 棒 ", pinyin: "bàng" }, { hanzi: "", pinyin: "x" }, "rác", null]), "pinyin")).toEqual([{ hanzi: "棒", extra: "bàng" }]);
    expect(parseRelatedWords(JSON.stringify([{ hanzi: "好吃", sinoVietnamese: "hảo cật" }]), "sinoVietnamese")).toEqual([{ hanzi: "好吃", extra: "hảo cật" }]);
    expect(formatRelatedWords([], "pinyin")).toBeUndefined();
    expect(formatRelatedWords([{ hanzi: "棒", extra: "" }, { hanzi: " ", extra: "x" }], "pinyin")).toBe(JSON.stringify([{ hanzi: "棒", pinyin: null }]));
  });
});

describe("vocabulary-form — giá trị form, kiểm tra, payload", () => {
  it("emptyVocabularyForm: 1 pinyin chính với 1 nghĩa trống, HSK 1, từ đơn, draft", () => {
    const form = emptyVocabularyForm();
    expect(form).toMatchObject({ hanzi: "", hskLevel: 1, isSingleVocab: true, status: "draft", strokeCount: "" });
    expect(form.pinyins).toHaveLength(1);
    expect(form.pinyins[0]).toMatchObject({ isPrimary: true, wordTypes: [], compounds: [] });
    expect(form.pinyins[0].meanings).toHaveLength(1);
  });

  it("vocabularyToForm: tách từ loại, parse JSON từ ghép/đồng nghĩa (hỏng => []), số nét => chuỗi, status lạ => draft, pinyin không có chính => phần tử đầu", () => {
    const form = vocabularyToForm(hao);
    expect(form).toMatchObject({ hanzi: "好", hskLevel: 1, strokeCount: "6", radical: "女", status: "published" });
    expect(form.pinyins[0]).toMatchObject({ pinyin: "hǎo", wordTypes: ["Tính từ", "Phó từ"], isPrimary: false, compounds: [{ hanzi: "好吃", extra: "hảo cật" }], synonyms: [{ hanzi: "棒", extra: "bàng" }], antonyms: [] });
    expect(form.pinyins[0].meanings[0]).toMatchObject({ meaning: "tốt", exampleSentenceCn: "很好。", exampleSentencePinyin: "" });
    expect(form.pinyins[1].isPrimary).toBe(true);
    const noPrimary = vocabularyToForm({ ...hao, status: "LẠ", pinyins: [{ pinyin: "a", meanings: [] }] });
    expect(noPrimary.status).toBe("draft");
    expect(noPrimary.pinyins[0]).toMatchObject({ isPrimary: true });
    expect(noPrimary.pinyins[0].meanings).toHaveLength(1);
    expect(vocabularyToForm({ ...hao, pinyins: undefined }).pinyins[0].isPrimary).toBe(true);
  });

  it("validateVocabularyForm: thông điệp và tab cần mở theo thứ tự kiểm tra của bản cũ", () => {
    const ok = emptyVocabularyForm();
    ok.hanzi = "好";
    ok.pinyins[0].pinyin = "hǎo";
    ok.pinyins[0].meanings[0].meaning = "tốt";
    expect(validateVocabularyForm(ok)).toBeNull();
    expect(validateVocabularyForm({ ...ok, hanzi: " " })).toEqual({ message: "Vui lòng nhập Hán tự!", tab: "info" });
    expect(validateVocabularyForm({ ...ok, pinyins: [{ ...ok.pinyins[0], isPrimary: false }] })).toEqual({ message: "Phải có ít nhất một pinyin được đặt làm chính!", tab: "info" });
    expect(validateVocabularyForm({ ...ok, pinyins: [ok.pinyins[0], emptyPinyin()] })).toEqual({ message: "Vui lòng nhập đầy đủ phiên âm cho tất cả pinyin!", tab: "info" });
    expect(validateVocabularyForm({ ...ok, pinyins: [{ ...ok.pinyins[0], meanings: [{ ...ok.pinyins[0].meanings[0], meaning: " " }] }] })).toEqual({ message: "Vui lòng nhập đầy đủ các nghĩa!", tab: "meaning" });
    expect(validateVocabularyForm({ ...ok, strokeCount: "0" })).toEqual({ message: "Số nét phải lớn hơn 0!", tab: "info" });
    expect(validateVocabularyForm({ ...ok, strokeCount: "6" })).toBeNull();
  });

  it("buildVocabularyPayload dựng thân như bản cũ: trường rỗng bỏ, wordTypes nối phẩy, lượng từ cắt, JSON cho danh sách, số nét thành số", () => {
    const form = emptyVocabularyForm();
    form.hanzi = " 好 ";
    form.hskLevel = 2;
    form.strokeCount = "6";
    form.radical = "女";
    form.imageUrl = " ";
    form.pinyins[0] = { ...form.pinyins[0], pinyin: " hǎo ", sinoVietnamese: "hảo", wordTypes: ["Tính từ", "Phó từ"], measureWord: " 个 [gè] ", compounds: [{ hanzi: "好吃", extra: "hảo cật" }], synonyms: [], antonyms: [{ hanzi: "坏", extra: "" }], notes: "", meanings: [{ meaning: " tốt ", meaningEn: "good", meaningZh: "优秀", exampleSentenceCn: "很好。", exampleSentencePinyin: "", exampleSentenceVi: "", exampleSentenceEn: "", exampleWordType: "Tính từ" }] };
    const payload = buildVocabularyPayload(form);
    expect(payload).toMatchObject({ hanzi: "好", hskLevel: 2, strokeCount: 6, radical: "女", isSingleVocab: true, status: "draft" });
    expect(payload.imageUrl).toBeUndefined();
    expect(payload.pinyins[0]).toMatchObject({ pinyin: "hǎo", sinoVietnamese: "hảo", wordTypes: "Tính từ,Phó từ", isPrimary: true, measureWord: "个 [gè]", compounds: JSON.stringify([{ hanzi: "好吃", sinoVietnamese: "hảo cật" }]), antonyms: JSON.stringify([{ hanzi: "坏", pinyin: null }]) });
    expect(payload.pinyins[0].synonyms).toBeUndefined();
    expect(payload.pinyins[0].notes).toBeUndefined();
    expect(payload.pinyins[0].meanings[0]).toEqual({ meaning: "tốt", meaningEn: "good", meaningZh: "优秀", exampleSentenceCn: "很好。", exampleSentencePinyin: undefined, exampleSentenceVi: undefined, exampleSentenceEn: undefined, exampleWordType: "Tính từ" });
  });

  it("setPrimaryPinyin chỉ một chính; removePinyin giữ ≥1 và chuyển 'chính' sang phần tử đầu khi xoá pinyin chính", () => {
    const list = [emptyPinyin(true), emptyPinyin(), emptyPinyin()];
    expect(setPrimaryPinyin(list, 2).map((p) => p.isPrimary)).toEqual([false, false, true]);
    expect(removePinyin(list, 0).map((p) => p.isPrimary)).toEqual([true, false]);
    expect(removePinyin(list, 1)).toHaveLength(2);
    expect(removePinyin([emptyPinyin(true)], 0)).toHaveLength(1);
  });
});
