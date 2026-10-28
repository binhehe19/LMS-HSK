import { describe, expect, it } from "vitest";
import { emptyGrammarPointInput, grammarPointSummary, grammarPointToInput, HSK_LEVEL_OPTIONS, hskLevelStyle, normalizeGrammarPointInput, validateGrammarPointInput } from "@/lib/content/grammar-point";
import type { GrammarPoint } from "@/types/content-grammar";

const point: GrammarPoint = { id: "g1", studySetId: "s1", index: 4, title: "Câu với 是", category: "Câu trần thuật", structure: "A + 是 + B", explanation: "Khẳng định A là B", hskLevel: "1", exampleSentenceZh: "我是学生。", exampleSentencePinyin: "Wǒ shì xuésheng.", exampleSentenceVi: "Tôi là học sinh." };

describe("grammar-point — form điểm ngữ pháp", () => {
  it("validate theo các trường required của GrammarPointModal cũ: tên, phân loại, cấu trúc, giải thích; cấp HSK 1–9", () => {
    const ok = { ...emptyGrammarPointInput(), title: "T", category: "C", structure: "S", explanation: "E" };
    expect(validateGrammarPointInput({ ...ok, title: " " })).toBe("Vui lòng nhập tên điểm ngữ pháp");
    expect(validateGrammarPointInput({ ...ok, category: "" })).toBe("Vui lòng nhập phân loại");
    expect(validateGrammarPointInput({ ...ok, structure: "  " })).toBe("Vui lòng nhập cấu trúc");
    expect(validateGrammarPointInput({ ...ok, explanation: "" })).toBe("Vui lòng nhập giải thích");
    expect(validateGrammarPointInput({ ...ok, hskLevel: "10" })).toBe("Cấp độ HSK phải từ 1 đến 9");
    expect(validateGrammarPointInput({ ...ok, hskLevel: "0" })).toBe("Cấp độ HSK phải từ 1 đến 9");
    expect(validateGrammarPointInput(ok)).toBeNull();
    expect(validateGrammarPointInput({ ...ok, hskLevel: "" })).toBeNull();
  });

  it("normalize cắt khoảng trắng, bỏ trường rỗng, giữ index", () => {
    expect(normalizeGrammarPointInput({ ...emptyGrammarPointInput(), title: " 把 ", category: "Câu đặc biệt", structure: " S + 把 + O ", explanation: "x", note: "  ", linkedQuizStudySetId: "", hskLevel: "3", index: 1 })).toEqual({
      title: "把",
      generalDefinition: undefined,
      category: "Câu đặc biệt",
      hskLevel: "3",
      structure: "S + 把 + O",
      explanation: "x",
      note: undefined,
      exampleSentenceZh: undefined,
      exampleSentencePinyin: undefined,
      exampleSentenceVi: undefined,
      linkedQuizStudySetId: undefined,
      index: 1,
    });
  });

  it("grammarPointToInput: trường thiếu => chuỗi rỗng, cấp HSK thiếu => '1', index giữ; summary là tên", () => {
    expect(grammarPointToInput(point)).toMatchObject({ title: "Câu với 是", category: "Câu trần thuật", hskLevel: "1", note: "", linkedQuizStudySetId: "", exampleSentenceVi: "Tôi là học sinh.", index: 4 });
    expect(grammarPointToInput({ ...point, hskLevel: undefined }).hskLevel).toBe("1");
    expect(grammarPointSummary(point)).toBe("Câu với 是");
    expect(emptyGrammarPointInput().hskLevel).toBe("1");
  });

  it("huy hiệu HSK: màu theo cấp 1–6 của bản cũ, cấp lạ/thiếu => xám; tuỳ chọn 1–9", () => {
    expect(hskLevelStyle("1")).toEqual({ bg: "#d1fae5", color: "#065f46" });
    expect(hskLevelStyle(6)).toEqual({ bg: "#fce7f3", color: "#9d174d" });
    expect(hskLevelStyle("9")).toEqual({ bg: "#f3f4f6", color: "#374151" });
    expect(hskLevelStyle(undefined)).toEqual({ bg: "#f3f4f6", color: "#374151" });
    expect(HSK_LEVEL_OPTIONS).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  });
});
