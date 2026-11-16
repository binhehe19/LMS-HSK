import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { PackageImportModal } from "@/components/management/content-flat/package-import-modal";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/api/lms-client", () => ({ lmsClient: api }));
vi.mock("@/lib/api/lms-dictionary-client", () => ({
  searchPublishedVocabularies: vi.fn(async () => ({
    items: [
      { id: "word-1", hanzi: "你好", pinyins: [{ pinyin: "nǐ hǎo", meanings: [{ meaning: "xin chào" }] }] },
      { id: "word-2", hanzi: "再见", pinyins: [] },
    ],
    totalElements: 2,
  })),
}));

it("keeps selections across tabs and copies only the remaining items to the selected session", async () => {
  const dictionaryContent = { word: "你好", language: "zh", pinyins: [{ pinyin: "nǐ hǎo" }] };
  const packageContent = { word: "谢谢", language: "zh", pinyins: [{ pinyin: "xièxie", meanings: [{ meaningVi: "cảm ơn" }] }] };
  api.get.mockImplementation(async (path: string) => {
    if (path.startsWith("/content-packages?")) {
      return { items: [{ id: "source", draftVersion: { title: "Học phần nguồn A" } }], total_pages: 1 };
    }
    if (path === "/content-packages/source") return { draftVersionId: "source-draft" };
    if (path.endsWith("/source-draft/resources")) return [{
      id: "link", learningResourceId: "package-word", resourceType: "VOCABULARY", subType: "ZH",
      resourceContent: packageContent, sessionNo: 1,
    }];
    if (path === "/content-packages/target") return { draftVersionId: "target-draft", type: "VOCABULARY" };
    if (path.endsWith("/target-draft/resources?sessionNo=2")) return [];
    if (path === "/learning-resources/word-1") {
      return { type: "VOCABULARY", subType: "ZH", inLibrary: true, publishedVersionId: "published", content: dictionaryContent };
    }
    throw new Error(`Unexpected GET ${path}`);
  });
  api.post.mockImplementation(async (path: string, payload: { sourceResourceId: string }) => path === "/learning-resources"
    ? { id: `copy-${payload.sourceResourceId}`, publishedVersionId: "copied-version" }
    : {});
  const onClose = vi.fn();
  const onAdded = vi.fn();
  const user = userEvent.setup();
  render(<PackageImportModal packageId="target" type="VOCABULARY" sessionNo={2} demo onClose={onClose} onAdded={onAdded} />);

  await user.click(await screen.findByRole("checkbox", { name: /^你好 · xin chào/ }));
  await user.click(screen.getByRole("checkbox", { name: "再见" }));
  await user.click(screen.getByRole("tab", { name: "Học phần khác" }));
  await user.click(screen.getByRole("combobox", { name: "Học phần nguồn" }));
  await user.click(await screen.findByText("Học phần nguồn A — Chưa gắn giáo trình"));
  await user.click(await screen.findByRole("checkbox", { name: /^Buổi 1: 谢谢 · cảm ơn/ }));
  const selection = screen.getByRole("region", { name: "Học liệu đã chọn" });
  expect(within(selection).getAllByRole("listitem")).toHaveLength(3);
  expect(within(selection).getByText("你好 · xin chào")).toBeInTheDocument();
  expect(within(selection).getByText("谢谢 · cảm ơn")).toBeInTheDocument();
  await user.click(within(selection).getByRole("button", { name: "Bỏ chọn 再见" }));
  await user.click(screen.getByRole("button", { name: "Sao chép 2 mục" }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(onAdded).toHaveBeenCalledOnce();
  expect(api.post).toHaveBeenCalledWith("/learning-resources", expect.objectContaining({ sourceResourceId: "word-1", content: dictionaryContent, inLibrary: false }));
  expect(api.post).toHaveBeenCalledWith("/learning-resources", expect.objectContaining({ sourceResourceId: "package-word", content: packageContent, inLibrary: false }));
  expect(api.post).toHaveBeenCalledWith("/content-packages/versions/target-draft/resources", expect.objectContaining({ sessionNo: 2, displayOrder: 1 }));
  expect(api.get).not.toHaveBeenCalledWith("/learning-resources/word-2");
}, 15_000);
