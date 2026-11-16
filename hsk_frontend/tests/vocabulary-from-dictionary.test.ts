import { beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/api/lms-client", () => ({ lmsClient: api }));
vi.mock("@/lib/api/write-gate", () => ({ assertWriteEnabled: vi.fn() }));
vi.mock("@/lib/api/storage-client", () => ({ fileUrl: (id?: string | null) => (id ? `/api/storage/file/${id}?disposition=inline` : null) }));
import { addDictionaryWordsToPackage, listPackageItems, updateFlashcardItem } from "@/lib/api/lms-content-client";

beforeEach(() => vi.resetAllMocks());

// Nội dung từ vựng ZH: nghĩa và ví dụ nằm trong pinyins[].meanings[]; phiên âm chính không phải phần tử đầu.
const dictionaryContent = {
  word: "你好",
  hskLevel: 1,
  audioUrl: "/api/storage/file/aud-1?disposition=inline",
  pinyins: [
    { pinyin: "nǐ hǎo (phụ)", isPrimary: false, meanings: [{ meaningVi: "nghĩa phụ" }] },
    { pinyin: "nǐ hǎo", wordTypes: "Thán từ", isPrimary: true, meanings: [{ meaningVi: "xin chào", exampleSentenceZh: "你好吗？", exampleSentencePinyin: "nǐ hǎo ma?", exampleSentenceVi: "bạn khỏe không?" }, { meaningVi: "nghĩa 2" }] },
  ],
};

function packageWith(content: unknown, links = [{ id: "l1", learningResourceId: "r1", learningResourceVersionId: "rv1", displayOrder: 0, resourceContent: content }]) {
  api.get.mockImplementation(async (url: string) => {
    if (url === "/content-packages/p1") return { id: "p1", draftVersionId: "d1", publishedVersionId: null };
    if (url === "/content-packages/versions/d1/resources") return links;
    throw Error("Unexpected GET " + url);
  });
}

describe("listPackageItems: đọc nội dung từ vựng ZH", () => {
  it("lấy phiên âm chính, nghĩa và ví dụ đầu tiên của nó, từ loại và âm thanh", async () => {
    packageWith(dictionaryContent);
    const [card] = await listPackageItems("p1");
    expect(card).toMatchObject({ id: "r1", term: "你好", pinyin: "nǐ hǎo", wordType: "Thán từ", meaning: "xin chào", example: "你好吗？", examplePinyin: "nǐ hǎo ma?", exampleMeaning: "bạn khỏe không?", audioFileId: "aud-1" });
  });

  it("trường tùy chỉnh của thẻ đọc từ notes, mỗi dòng nhãn: giá trị; dòng không có nhãn bị bỏ qua", async () => {
    packageWith({ ...dictionaryContent, notes: "Cấp độ: HSK 1\nghi chú tự do\nVí dụ: a: b" });
    expect((await listPackageItems("p1"))[0].customFields).toEqual([{ label: "Cấp độ", value: "HSK 1" }, { label: "Ví dụ", value: "a: b" }]);
    packageWith(dictionaryContent);
    expect((await listPackageItems("p1"))[0].customFields).toBeUndefined();
  });

  it("từ điển không có nghĩa nào => nghĩa rỗng, không lỗi", async () => {
    packageWith({ word: "空", pinyins: [] });
    expect((await listPackageItems("p1"))[0]).toMatchObject({ term: "空", meaning: "" });
  });
});

describe("addDictionaryWordsToPackage", () => {
  const link = (id: string, order: number) => ({ id: `l${id}`, learningResourceId: id, learningResourceVersionId: `v${id}`, displayOrder: order, resourceContent: null });
  function backend(links: unknown[], over: { missingContent?: string; failLinkFor?: string } = {}) {
    api.get.mockImplementation(async (url: string) => {
      if (url === "/content-packages/p1") return { id: "p1", draftVersionId: "d1", publishedVersionId: null };
      if (url === "/content-packages/versions/d1/resources") return links;
      const word = /^\/learning-resources\/(w\d)$/.exec(url);
      if (word) return { id: word[1], content: word[1] === over.missingContent ? null : { word: word[1], pinyins: [{ pinyin: "x", meanings: [{ meaningVi: "m" }] }] } };
      throw Error("Unexpected GET " + url);
    });
    let counter = 0;
    api.post.mockImplementation(async (url: string, body: { sourceResourceId?: string }) => {
      if (url === "/learning-resources") return { id: `copy-${++counter}`, publishedVersionId: `cv-${counter}`, sourceFor: body.sourceResourceId };
      if (over.failLinkFor && api.post.mock.calls.filter(([u]) => u === "/learning-resources").length === Number(over.failLinkFor)) throw new Error("gắn lỗi");
      return {};
    });
    api.delete.mockResolvedValue(undefined);
  }

  it("mỗi từ thành một bản sao riêng: nội dung nguyên văn, inLibrary=false, nguồn là từ ở từ điển, nối tiếp thứ tự trong bộ", async () => {
    backend([link("a", 0), link("b", 4)]);
    const result = await addDictionaryWordsToPackage("p1", [{ id: "w1", label: "一" }, { id: "w2", label: "二" }], false);
    expect(result).toEqual({ added: 2, failed: [] });
    const created = api.post.mock.calls.filter(([url]) => url === "/learning-resources").map(([, body]) => body);
    expect(created[0]).toEqual({ type: "VOCABULARY", content: { word: "w1", pinyins: [{ pinyin: "x", meanings: [{ meaningVi: "m" }] }] }, publishImmediately: true, inLibrary: false, sourceResourceId: "w1" });
    expect(created[1]).toMatchObject({ inLibrary: false, sourceResourceId: "w2" });
    const links = api.post.mock.calls.filter(([url]) => url === "/content-packages/versions/d1/resources").map(([, body]) => body);
    expect(links.map((l: { displayOrder: number; sessionNo: number }) => [l.displayOrder, l.sessionNo])).toEqual([[5, 1], [6, 1]]);
    expect(links[0]).toMatchObject({ learningResourceId: "copy-1", learningResourceVersionId: "cv-1" });
  });

  it("từ không có nội dung => báo lỗi và không tạo gì; từ khác vẫn được thêm", async () => {
    backend([], { missingContent: "w1" });
    const result = await addDictionaryWordsToPackage("p1", [{ id: "w1", label: "空" }, { id: "w2", label: "二" }], false);
    expect(result.added).toBe(1);
    expect(result.failed).toEqual([{ label: "空", message: "Từ chưa có nội dung" }]);
    expect(api.post.mock.calls.filter(([url]) => url === "/learning-resources")).toHaveLength(1);
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("tạo bản sao xong mà gắn vào gói lỗi => xóa bản sao vừa tạo (không để bản mồ côi) và báo từ đó lỗi", async () => {
    backend([], { failLinkFor: "1" });
    const result = await addDictionaryWordsToPackage("p1", [{ id: "w1", label: "一" }], false);
    expect(result).toEqual({ added: 0, failed: [{ label: "一", message: "gắn lỗi" }] });
    expect(api.delete).toHaveBeenCalledWith("/learning-resources/copy-1");
  });
});

describe("updateFlashcardItem: sửa bản sao từ từ điển không làm mất dữ liệu form thẻ không sửa", () => {
  it("chỉ thay phiên âm chính và nghĩa đầu; giữ các phiên âm, nghĩa và trường khác của nội dung hiện có", async () => {
    api.get.mockImplementation(async (url: string) => {
      if (url === "/content-packages/p1") return { id: "p1", draftVersionId: "d1", publishedVersionId: null };
      if (url === "/learning-resources/r1") return { id: "r1", content: dictionaryContent };
      throw Error("Unexpected GET " + url);
    });
    api.put.mockResolvedValue({});
    const card = await updateFlashcardItem("p1", "r1", { term: "你好", meaning: "chào hỏi", pinyin: "nǐ hǎo", wordType: "Thán từ", example: "你好吗？", examplePinyin: "nǐ hǎo ma?", exampleMeaning: "bạn khỏe không?" }, false);
    const body = api.put.mock.calls[0][1] as { content: Record<string, unknown> };
    expect(api.put.mock.calls[0][0]).toBe("/content-packages/versions/d1/resources/r1/content");
    const pinyins = body.content.pinyins as { pinyin: string; meanings: { meaningVi: string }[] }[];
    expect(pinyins[0]).toEqual(dictionaryContent.pinyins[0]);
    expect(pinyins[1]).toMatchObject({ pinyin: "nǐ hǎo", isPrimary: true });
    expect(pinyins[1].meanings.map((m) => m.meaningVi)).toEqual(["chào hỏi", "nghĩa 2"]);
    expect(body.content).toMatchObject({ word: "你好", hskLevel: 1 });
    expect(body.content).not.toHaveProperty("commonMeaning");
    expect(card).toMatchObject({ id: "r1", term: "你好", meaning: "chào hỏi" });
  });
});
