import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVocabulary, getVocabulary, updateVocabulary } from "@/lib/api/lms-dictionary-client";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/api/lms-client", () => ({ lmsClient: api }));
vi.mock("@/lib/api/write-gate", () => ({ assertWriteEnabled: vi.fn() }));

const path = "/learning-resources/word";
const current = { id: "word", draftVersionId: "draft", publishedVersionId: "published", content: { word: "好", pinyins: [] } };
const edited = { hanzi: "好", isSingleVocab: true, pinyins: [{ pinyin: "hǎo", isPrimary: true, meanings: [{ meaning: "tốt" }] }] };

beforeEach(() => vi.resetAllMocks());

describe("lưu và xuất bản từ vựng", () => {
  it("mở lại đúng nội dung nháp của từ đã xuất bản", async () => {
    api.get.mockResolvedValueOnce(current).mockResolvedValueOnce([
      { id: "draft", content: { word: "很好", pinyins: [] } },
    ]);
    await expect(getVocabulary("word")).resolves.toMatchObject({ hanzi: "很好", status: "draft" });
    expect(api.get).toHaveBeenNthCalledWith(2, `${path}/versions`);
  });

  it("lưu vào bản nháp hiện hành và chỉ xuất bản khi được chọn", async () => {
    api.get.mockResolvedValue(current);
    const details = { etymologyStoryHtml: "<p><strong>Gốc chữ</strong></p>", notesHtml: "<p><em>Ghi chú</em></p>" };
    await expect(updateVocabulary("word", { ...edited, ...details, status: "draft" }, false)).resolves.toMatchObject(details);
    expect(api.put).toHaveBeenCalledWith(`${path}/versions/draft`, expect.objectContaining({ content: expect.objectContaining({ word: "好", ...details }) }));
    expect(api.post).not.toHaveBeenCalled();
    await updateVocabulary("word", { ...edited, status: "published" }, false);
    expect(api.post).toHaveBeenCalledExactlyOnceWith(`${path}/versions/draft/publish`);
  });

  it("tạo một bản nháp riêng cho từ đang xuất bản", async () => {
    api.get.mockResolvedValue({ ...current, draftVersionId: null });
    await expect(updateVocabulary("word", { ...edited, status: "draft" }, false)).resolves.toMatchObject({ status: "draft" });
    expect(api.put).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledExactlyOnceWith(`${path}/versions`, expect.objectContaining({ publishImmediately: false }));
  });

  it("gửi yêu cầu tạo và xuất bản trong một lần tạo từ mới", async () => {
    api.post.mockResolvedValue({ ...current, draftVersionId: null });
    await expect(createVocabulary({ ...edited, status: "published" }, false)).resolves.toMatchObject({ status: "published" });
    expect(api.post).toHaveBeenCalledExactlyOnceWith("/learning-resources", expect.objectContaining({ publishImmediately: true }));
  });
});
