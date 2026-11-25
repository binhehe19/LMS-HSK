import { describe, expect, it } from "vitest";
import { paginationSlots, RADICALS_BY_STROKE, readVocabularyListState, STROKE_GROUPS, vocabularyCardSummary, vocabularyListKey, vocabularyListQuery } from "@/lib/dictionary/vocabulary-list-params";
import type { Vocabulary } from "@/types/dictionary";

const read = (q: string) => readVocabularyListState(new URLSearchParams(q));

describe("trạng thái lọc trong URL (hợp đồng query của HSK cũ)", () => {
  it("đọc đủ tham số; strokeFilter suy từ bộ thủ khi URL không có", () => {
    expect(read("keySearch=好&hskLevel=3&radical=口&page=2")).toEqual({ keySearch: "好", hskLevel: 3, radical: "口", strokeFilter: 3, page: 2 });
    expect(read("radical=口&strokeFilter=5").strokeFilter).toBe(5);
    expect(read("")).toEqual({ keySearch: "", hskLevel: undefined, radical: undefined, strokeFilter: null, page: 0 });
  });

  it("bỏ qua giá trị lạ thay vì gửi lên API", () => {
    expect(read("hskLevel=10&page=-1&radical=abc&strokeFilter=x")).toEqual({ keySearch: "", hskLevel: undefined, radical: undefined, strokeFilter: null, page: 0 });
    expect(read("hskLevel=2.5").hskLevel).toBeUndefined();
    expect(read(`keySearch=${"a".repeat(150)}`).keySearch).toHaveLength(100);
  });

  it("ghi lại đúng thứ tự cũ, luôn có page; khoá tải bỏ qua strokeFilter", () => {
    const s = read("keySearch=ma&radical=口&hskLevel=1&page=4");
    expect(vocabularyListQuery(s)).toBe("?keySearch=ma&radical=%E5%8F%A3&strokeFilter=3&hskLevel=1&page=4");
    expect(vocabularyListQuery(read(""))).toBe("?page=0");
    expect(vocabularyListKey({ ...s, strokeFilter: 9 })).toBe(vocabularyListKey(s));
    expect(vocabularyListKey({ ...s, keySearch: " ma " })).toBe(vocabularyListKey(s));
  });
});

describe("phân trang như bản cũ: đầu, cuối, hiện tại ±1, '…' ở ±2", () => {
  const show = (current: number, total: number) => paginationSlots(current, total).map((s) => (s.kind === "page" ? s.index + 1 : "…"));
  it("các trường hợp", () => {
    expect(show(0, 11167)).toEqual([1, 2, "…", 11167]);
    expect(show(5, 11167)).toEqual([1, "…", 5, 6, 7, "…", 11167]);
    expect(show(11166, 11167)).toEqual([1, "…", 11166, 11167]);
    expect(show(0, 3)).toEqual([1, 2, 3]);
    expect(show(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("thẻ từ và bộ thủ", () => {
  it("tóm tắt thẻ lấy phiên âm đầu, từ loại tách dấu phẩy, nghĩa nối '; '", () => {
    const v: Vocabulary = { id: "1", hanzi: "下", isSingleVocab: true, pinyins: [{ pinyin: "xià", wordTypes: "Danh từ, Động từ,", meanings: [{ meaning: "dưới" }, { meaning: "sau" }] }, { pinyin: "xia", meanings: [{ meaning: "x" }] }] };
    expect(vocabularyCardSummary(v)).toEqual({ pinyin: "xià", wordTypes: ["Danh từ", "Động từ"], meaning: "dưới; sau" });
    expect(vocabularyCardSummary({ id: "2", hanzi: "?", isSingleVocab: true })).toEqual({ pinyin: "", wordTypes: [], meaning: "" });
  });

  it("214 bộ thủ chia theo số nét 1–17", () => {
    expect(Object.values(RADICALS_BY_STROKE).flat()).toHaveLength(214);
    expect(STROKE_GROUPS[0]).toBe(1);
    expect(STROKE_GROUPS.at(-1)).toBe(17);
    expect(RADICALS_BY_STROKE[1]).toContain("一");
  });
});
