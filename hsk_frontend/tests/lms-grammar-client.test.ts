import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/api/lms-client", () => ({ lmsClient: api }));
vi.mock("@/lib/api/write-gate", () => ({ assertWriteEnabled: vi.fn() }));
vi.mock("@/lib/api/lms-package-list", () => ({ listFreeContentPackages: vi.fn() }));
import { createGrammarItem, getGrammarLibraryDraft, listGrammarLibrary, listPackageGrammarPoints, publishGrammarLibraryDraft, saveGrammarLibraryDraft, updateGrammarItem } from "@/lib/api/lms-grammar-client";

beforeEach(() => vi.resetAllMocks());

const input = {
  title: "越来越", category: "Phó từ", generalDefinition: "Càng ngày càng", structure: "S + 越来越 + Adj", explanation: "Diễn tả mức độ tăng", note: "Không dùng với phủ định",
  hskLevel: "3", exampleSentenceZh: "天气越来越冷。", exampleSentencePinyin: "Tiānqì yuè lái yuè lěng.", exampleSentenceVi: "Thời tiết ngày càng lạnh.", index: 2,
};

it("đọc kho ngữ pháp HSK đã xuất bản theo trang, từ khóa và cấp độ", async () => {
  api.get.mockResolvedValue({
    items: [{ id: "r1", publishedVersionId: "v1", content: { title: "越来越", hskLevel: "3" } }],
    total_elements: 21, total_pages: 2, page: 1, size: 20,
  });
  const result = await listGrammarLibrary({ keyword: " 越来越 ", level: "3", page: 2, size: 20, publishedOnly: true });
  const query = new URLSearchParams(api.get.mock.calls[0][0].split("?")[1]);
  expect(Object.fromEntries(query)).toEqual({ type: "GRAMMAR", subType: "ZH", inLibrary: "true", page: "1", size: "20", keyword: "越来越", cefrLevel: "3", publishedOnly: "true" });
  expect(result.items[0].point).toMatchObject({ id: "r1", title: "越来越", hskLevel: "3" });
});

it("tạo điểm trong kho dưới dạng bản nháp và không gắn vào học phần", async () => {
  await saveGrammarLibraryDraft(input, null, false);
  expect(api.post).toHaveBeenCalledExactlyOnceWith("/learning-resources", expect.objectContaining({
    type: "GRAMMAR", subType: "ZH", inLibrary: true, publishImmediately: false,
  }));
});

it("đọc và cập nhật đúng bản nháp khi đã có bản xuất bản, giữ các ví dụ bổ sung", async () => {
  const otherExample = { exampleIndex: 1, sentenceZh: "我们越来越好。" };
  api.get.mockResolvedValueOnce({ id: "r1", publishedVersionId: "v1", draftVersionId: "v2", content: { title: "Bản đã xuất bản" } })
    .mockResolvedValueOnce([{ id: "v2", content: { title: "Bản nháp", examples: [{ sentenceZh: "天气越来越冷。" }, otherExample] } }]);
  const draft = await getGrammarLibraryDraft("r1");
  expect(draft.point.title).toBe("Bản nháp");
  await saveGrammarLibraryDraft(input, draft, false);
  expect(api.put).toHaveBeenCalledExactlyOnceWith("/learning-resources/r1/versions/v2", {
    content: expect.objectContaining({ examples: [expect.objectContaining({ sentenceZh: input.exampleSentenceZh }), otherExample] }),
  });
  await publishGrammarLibraryDraft(draft, false);
  expect(api.post).toHaveBeenCalledExactlyOnceWith("/learning-resources/r1/versions/v2/publish");
});

it("tạo ngữ pháp HSK: loại phụ ZH, lưu hskLevel và pinyin, không gửi trường của ngữ pháp EN", async () => {
  api.get.mockResolvedValue({ id: "p1", draftVersionId: "d1", publishedVersionId: null });
  api.post.mockImplementation(async (url: string, body: { content?: unknown }) => url === "/learning-resources" ? { id: "r1", publishedVersionId: "rv1", content: body.content } : {});
  await createGrammarItem("p1", input as never, false);
  const create = api.post.mock.calls.find(([url]) => url === "/learning-resources")![1];
  expect(create).toMatchObject({ type: "GRAMMAR", subType: "ZH", inLibrary: false });
  expect(create.content).toEqual({
    title: "越来越", category: "Phó từ", generalDefinition: "Càng ngày càng", structure: "S + 越来越 + Adj", explanation: "Diễn tả mức độ tăng",
    usageNote: "Không dùng với phủ định", hskLevel: "3",
    examples: [{ exampleIndex: 0, sentenceZh: "天气越来越冷。", pinyin: "Tiānqì yuè lái yuè lěng.", translationVi: "Thời tiết ngày càng lạnh." }],
  });
  expect(JSON.stringify(create.content)).not.toMatch(/exampleType|pronunciation|sentenceEn/);
});

it("sửa ngữ pháp: nội dung gửi lên cũng có hskLevel và pinyin", async () => {
  api.get.mockResolvedValue({ id: "p1", draftVersionId: "d1", publishedVersionId: null });
  api.put.mockResolvedValue({});
  const point = await updateGrammarItem("p1", "r1", input as never, false);
  expect(api.put.mock.calls[0][1].content).toMatchObject({ hskLevel: "3", examples: [{ pinyin: "Tiānqì yuè lái yuè lěng." }] });
  expect(point).toMatchObject({ hskLevel: "3", exampleSentencePinyin: "Tiānqì yuè lái yuè lěng." });
});

it("đọc ngữ pháp: hskLevel và pinyin từ nội dung của máy chủ hiện lại trên form", async () => {
  api.get.mockImplementation(async (url: string) => url.endsWith("/resources")
    ? [{ id: "l1", learningResourceId: "r1", learningResourceVersionId: "rv1", displayOrder: 0, resourceContent: {
      title: "越来越", hskLevel: "2", usageNote: "ghi chú", examples: [{ exampleIndex: 0, sentenceZh: "我", pinyin: "wǒ", translationVi: "tôi" }] } }]
    : { id: "p1", draftVersionId: "d1", publishedVersionId: null });
  const [point] = await listPackageGrammarPoints("p1");
  expect(point).toMatchObject({ id: "r1", title: "越来越", hskLevel: "2", note: "ghi chú", exampleSentenceZh: "我", exampleSentencePinyin: "wǒ", exampleSentenceVi: "tôi" });
});
