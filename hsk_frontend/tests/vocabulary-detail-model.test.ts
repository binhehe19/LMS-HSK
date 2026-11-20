import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_HANZI_DATA_URL_TEMPLATES, loadHanziChar, parseHanziDataUrlTemplates } from "@/lib/dictionary/hanzi-writer-loader";
import { addRecentWord, parseRecentWords, RECENT_VOCAB_MAX, type RecentWord } from "@/lib/dictionary/recent-vocabulary";
import { buildPracticeQuestions, isAnswerCorrect, normalizePinyinAnswer, parseCompounds, practiceTier, shuffleArray } from "@/lib/dictionary/vocab-practice";
import { alignPinyin, buildAnalysisNodes, radicalCharacter, selectExamples, selectPrimaryPinyin, splitHighlight, splitWordTypes } from "@/lib/dictionary/vocabulary-detail-model";
import type { VocabularyExample, VocabularyMeaning, VocabularyPinyin } from "@/types/dictionary";

const identity = <T,>(arr: T[]) => [...arr];

describe("vocabulary-detail-model", () => {
  it("chọn pinyin isPrimary, không có thì mục đầu tiên", () => {
    const a: VocabularyPinyin = { pinyin: "a", meanings: [] };
    const b: VocabularyPinyin = { pinyin: "b", isPrimary: true, meanings: [] };
    expect(selectPrimaryPinyin([a, b])?.pinyin).toBe("b");
    expect(selectPrimaryPinyin([a])?.pinyin).toBe("a");
    expect(selectPrimaryPinyin(undefined)).toBeUndefined();
  });

  it("tách từ loại và gộp mọi câu ví dụ tiếng Trung của các nghĩa theo thứ tự", () => {
    expect(splitWordTypes({ pinyin: "x", wordTypes: " Động từ, Danh từ ,,", meanings: [] })).toEqual(["Động từ", "Danh từ"]);
    expect(splitWordTypes(undefined)).toEqual([]);
    const meanings: VocabularyMeaning[] = [
      { meaning: "a", examples: [{ zh: "我" }, { zh: "你", vi: "bạn" }] },
      { meaning: "b" },
      { meaning: "c", examples: [{ zh: "" }, { pinyin: "chỉ có pinyin" }] },
      { meaning: "d", examples: [{ zh: "他" }] },
    ];
    expect(selectExamples(meanings).map((e) => e.zh)).toEqual(["我", "你", "他"]);
    expect(selectExamples(undefined)).toEqual([]);
  });

  it("lấy ký tự bộ thủ sau khoảng trắng cuối cùng", () => {
    expect(radicalCharacter("NHẤT 一")).toBe("一");
    expect(radicalCharacter("  口 ")).toBe("口");
    expect(radicalCharacter("THỦY  CHẤM THỦY 氵")).toBe("氵");
    expect(radicalCharacter(undefined)).toBe("");
  });

  it("dùng components của API (bỏ ô trùng nguyên từ), không có thì rơi về bộ thủ", () => {
    const nodes = buildAnalysisNodes("山水", [{ id: "01A", hanzi: "山", pinyin: "shān", meaning: "núi" }, { id: null, hanzi: "水" }], "SƠN 山");
    expect(nodes).toEqual([
      { key: "山-0", id: "01A", hanzi: "山", title: "shān", desc: "núi" },
      { key: "水-1", id: null, hanzi: "水", title: "", desc: "" },
    ]);
    expect(buildAnalysisNodes("山", [{ id: "01A", hanzi: "山" }], "SƠN 山")).toEqual([{ key: "radical-山", id: null, hanzi: "山", title: "Bộ Sơn", desc: "3 nét" }]);
    expect(buildAnalysisNodes("好", [], "không có")).toEqual([]);
    expect(buildAnalysisNodes("好", undefined, undefined)).toEqual([]);
  });

  it("cắt đoạn tô đỏ và ghép pinyin theo chữ Hán", () => {
    expect(splitHighlight("我爱山，山很高", "山")).toEqual([
      { text: "我爱", hit: false },
      { text: "山", hit: true },
      { text: "，", hit: false },
      { text: "山", hit: true },
      { text: "很高", hit: false },
    ]);
    expect(splitHighlight("abc", "")).toEqual([{ text: "abc", hit: false }]);
    expect(alignPinyin("我好。", "wǒ hǎo")).toEqual([
      { char: "我", pinyin: "wǒ" },
      { char: "好", pinyin: "hǎo" },
      { char: "。", pinyin: "" },
    ]);
  });
});

describe("vocab-practice", () => {
  const examples: VocabularyExample[] = Array.from({ length: 7 }, (_, i) => ({ zh: `句${i}`, pinyin: `jù ${i}` }));

  it("parse compounds an toàn", () => {
    expect(parseCompounds("không phải json")).toEqual([]);
    expect(parseCompounds('{"hanzi":"x"}')).toEqual([]);
    expect(parseCompounds('[{"hanzi":"山水","sinoVietnamese":"SƠN THỦY"},{"hanzi":5},null,{"hanzi":"火山"}]')).toEqual([
      { hanzi: "山水", sinoVietnamese: "SƠN THỦY" },
      { hanzi: "火山", sinoVietnamese: undefined },
    ]);
  });

  it("dựng câu nối (2–3 từ ghép có Hán Việt) + tối đa 5 câu pinyin", () => {
    const compounds = JSON.stringify([
      { hanzi: "山水", sinoVietnamese: "SƠN THỦY" },
      { hanzi: "火山", sinoVietnamese: "HỎA SƠN" },
      { hanzi: "山区" },
      { hanzi: "高山", sinoVietnamese: "CAO SƠN" },
      { hanzi: "爬山", sinoVietnamese: "BA SƠN" },
    ]);
    const qs = buildPracticeQuestions("山", compounds, examples, identity);
    expect(qs).toHaveLength(6);
    const match = qs[0];
    expect(match.kind).toBe("match");
    if (match.kind !== "match") throw new Error("unreachable");
    expect(match.prompt).toBe("Nối từ ghép có chữ 山 ở cột A với nghĩa phù hợp ở cột B.");
    expect(match.left.map((l) => l.text)).toEqual(["山水", "火山", "高山"]);
    expect(match.right.map((r) => r.text)).toEqual(["SƠN THỦY", "HỎA SƠN", "CAO SƠN"]);
    expect(qs.slice(1).every((q) => q.kind === "pinyin")).toBe(true);
  });

  it("không có câu nối khi JSON hỏng hoặc dưới 2 từ ghép dùng được", () => {
    expect(buildPracticeQuestions("山", "{oops", [], identity)).toEqual([]);
    expect(buildPracticeQuestions("山", '[{"hanzi":"山水","sinoVietnamese":"SƠN THỦY"}]', [], identity)).toEqual([]);
    expect(buildPracticeQuestions("山", undefined, [{ zh: "山" }], identity)).toEqual([]);
  });

  it("chấm câu nối theo khoá gốc và câu pinyin bỏ hoa thường/khoảng trắng thừa", () => {
    const [match] = buildPracticeQuestions("山", '[{"hanzi":"a","sinoVietnamese":"A"},{"hanzi":"b","sinoVietnamese":"B"}]', [], (arr) => [...arr].reverse());
    expect(isAnswerCorrect(match, { "0": "0", "1": "1" }, "")).toBe(true);
    expect(isAnswerCorrect(match, { "0": "1", "1": "0" }, "")).toBe(false);
    const pinyin = { kind: "pinyin" as const, prompt: "", cn: "我", answer: "Wǒ  hǎo" };
    expect(isAnswerCorrect(pinyin, {}, "  wǒ hǎo ")).toBe(true);
    expect(isAnswerCorrect(pinyin, {}, "wo hao")).toBe(false);
    expect(normalizePinyinAnswer(" A  B ")).toBe("a b");
  });

  it("xếp loại và xáo trộn", () => {
    expect(practiceTier(3, 0, 3)).toBe("great");
    expect(practiceTier(2, 1, 3)).toBe("good");
    expect(practiceTier(1, 2, 3)).toBe("poor");
    expect(practiceTier(0, 0, 0)).toBe("poor");
    expect(shuffleArray([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
  });
});

describe("recent-vocabulary", () => {
  const w = (id: string): RecentWord => ({ id, hanzi: id, pinyin: id });

  it("đọc an toàn: JSON hỏng, id số (bản cũ) hoặc sai hình dạng bị bỏ", () => {
    expect(parseRecentWords(null)).toEqual([]);
    expect(parseRecentWords("{")).toEqual([]);
    expect(parseRecentWords('{"id":"a"}')).toEqual([]);
    expect(parseRecentWords(JSON.stringify([{ id: 5, hanzi: "x", pinyin: "y" }, w("01A"), { id: "01B" }]))).toEqual([w("01A")]);
  });

  it("đưa từ mới lên đầu, bỏ trùng, tối đa 10", () => {
    const list = Array.from({ length: RECENT_VOCAB_MAX }, (_, i) => w(`id${i}`));
    const next = addRecentWord(list, w("id5"));
    expect(next[0].id).toBe("id5");
    expect(next.filter((x) => x.id === "id5")).toHaveLength(1);
    const grown = addRecentWord(list, w("new"));
    expect(grown).toHaveLength(RECENT_VOCAB_MAX);
    expect(grown[0].id).toBe("new");
    expect(grown.some((x) => x.id === "id9")).toBe(false);
  });
});

describe("hanzi-writer-loader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("đọc mẫu URL từ env, bỏ mẫu thiếu {char}, trống => mặc định jsdelivr", () => {
    expect(parseHanziDataUrlTemplates(undefined)).toEqual(DEFAULT_HANZI_DATA_URL_TEMPLATES);
    expect(parseHanziDataUrlTemplates("  ")).toEqual(DEFAULT_HANZI_DATA_URL_TEMPLATES);
    expect(parseHanziDataUrlTemplates("https://x/no-char.json")).toEqual(DEFAULT_HANZI_DATA_URL_TEMPLATES);
    expect(parseHanziDataUrlTemplates(" https://a/{char}.json , https://b/x , https://c/d/{char}")).toEqual(["https://a/{char}.json", "https://c/d/{char}"]);
    expect(DEFAULT_HANZI_DATA_URL_TEMPLATES).toEqual([
      "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/{char}.json",
      "https://cdn.jsdelivr.net/gh/MadLadSquad/hanzi-writer-data-youyin@59aa4a02a46c608c939ba790372bbd3a703a6899/data/{char}.json",
    ]);
  });

  it("gọi các nguồn trong env, lấy nguồn có dữ liệu và nhớ đệm", async () => {
    vi.stubEnv("NEXT_PUBLIC_HANZI_WRITER_DATA_URLS", "https://a.test/{char}.json,https://b.test/{char}.json");
    const data = { strokes: ["M0 0"], medians: [[[0, 0]]] };
    const fetchMock = vi.fn(async (url: string) => (url.startsWith("https://b.test/") ? new Response(JSON.stringify(data), { status: 200 }) : new Response("", { status: 404 })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadHanziChar("永")).resolves.toEqual(data);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([`https://a.test/${encodeURIComponent("永")}.json`, `https://b.test/${encodeURIComponent("永")}.json`]);
    await loadHanziChar("永");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("mọi nguồn 404 => null và không gọi lại; lỗi mạng => không ghi nhớ là thiếu", async () => {
    vi.stubEnv("NEXT_PUBLIC_HANZI_WRITER_DATA_URLS", "https://a.test/{char}.json");
    const missing = vi.fn(async () => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", missing);
    await expect(loadHanziChar("龘")).resolves.toBeNull();
    await loadHanziChar("龘");
    expect(missing).toHaveBeenCalledTimes(1);

    const failing = vi.fn(async () => {
      throw new TypeError("offline");
    });
    vi.stubGlobal("fetch", failing);
    await expect(loadHanziChar("靐")).resolves.toBeNull();
    await loadHanziChar("靐");
    expect(failing).toHaveBeenCalledTimes(2);
  });
});
