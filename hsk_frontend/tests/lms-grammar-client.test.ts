import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/api/lms-client", () => ({ lmsClient: api }));
vi.mock("@/lib/api/write-gate", () => ({ assertWriteEnabled: vi.fn() }));
vi.mock("@/lib/api/lms-package-list", () => ({ listFreeContentPackages: vi.fn() }));
import { createGrammarItem, listPackageGrammarPoints, updateGrammarItem } from "@/lib/api/lms-grammar-client";

beforeEach(() => vi.resetAllMocks());

const input = {
  title: "越来越", category: "Phó từ", generalDefinition: "Càng ngày càng", structure: "S + 越来越 + Adj", explanation: "Diễn tả mức độ tăng", note: "Không dùng với phủ định",
  hskLevel: "3", exampleSentenceZh: "天气越来越冷。", exampleSentencePinyin: "Tiānqì yuè lái yuè lěng.", exampleSentenceVi: "Thời tiết ngày càng lạnh.", index: 2,
};

it("tạo ngữ pháp HSK: loại phụ ZH, lưu hskLevel và pinyin, không gửi trường của ngữ pháp EN", async () => {
  api.get.mockResolvedValue({ id: "p1", draftVersionId: "d1", publishedVersionId: null });
  api.post.mockImplementation(async (url: string, body: any) => url === "/learning-resources" ? { id: "r1", publishedVersionId: "rv1", content: body.content } : {});
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
