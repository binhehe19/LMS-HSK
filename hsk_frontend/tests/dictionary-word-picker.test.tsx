import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DictionaryWordPickerModal } from "@/components/management/content-flashcard/dictionary-word-picker-modal";
import { addDictionaryWordsToPackage } from "@/lib/api/lms-content-client";
import { searchVocabularies } from "@/lib/api/lms-dictionary-client";
import type { ContentPackage } from "@/types/content";
import type { FlashcardCard } from "@/types/content-flashcard";
import type { Vocabulary } from "@/types/dictionary";

vi.setConfig({ testTimeout: 30_000 });
vi.mock("@/lib/api/lms-dictionary-client", () => ({ searchVocabularies: vi.fn() }));
vi.mock("@/lib/api/lms-content-client", () => ({ addDictionaryWordsToPackage: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

const pkg: ContentPackage = { id: "p1", name: "Bộ HSK 1", type: "VOCABULARY" };
const word = (id: string, hanzi: string, pinyin: string, meaning: string): Vocabulary => ({ id, hanzi, isSingleVocab: false, pinyins: [{ pinyin, isPrimary: true, meanings: [{ meaning }] }] }) as Vocabulary;
const page = (items: Vocabulary[], totalPages = 1) => ({ items, totalElements: items.length, totalPages, page: 0, size: 10 });
const card = (term: string): FlashcardCard => ({ id: `c-${term}`, studySetId: "", term, meaning: "x" });

function renderPicker(over: Partial<Parameters<typeof DictionaryWordPickerModal>[0]> = {}) {
  const onClose = vi.fn();
  const onAdded = vi.fn();
  render(<DictionaryWordPickerModal open pkg={pkg} items={[card("学")]} demo={false} onClose={onClose} onAdded={onAdded} {...over} />);
  return { onClose, onAdded };
}

beforeEach(() => {
  vi.mocked(searchVocabularies).mockReset().mockResolvedValue(page([word("w1", "你好", "nǐ hǎo", "xin chào"), word("w2", "学", "xué", "học"), word("w3", "谢谢", "xièxie", "cảm ơn")]));
  vi.mocked(addDictionaryWordsToPackage).mockReset().mockResolvedValue({ added: 2, failed: [] });
  for (const fn of [toast.success, toast.error]) vi.mocked(fn).mockClear();
});

describe("hộp chọn từ trong Từ điển", () => {
  it("liệt kê từ kèm phiên âm và nghĩa; từ đã có trong bộ bị khóa và có nhãn; nút Thêm bị khóa khi chưa chọn", async () => {
    renderPicker();
    const rows = await screen.findAllByTestId("dict-picker-row");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("你好");
    expect(rows[0]).toHaveTextContent("nǐ hǎo");
    expect(rows[0]).toHaveTextContent("xin chào");
    expect(rows[1]).toBeDisabled();
    expect(rows[1]).toHaveTextContent("Đã có trong bộ");
    expect(screen.getByRole("button", { name: /Thêm .*vào bộ/ })).toBeDisabled();
    expect(searchVocabularies).toHaveBeenCalledWith({ keySearch: "", page: 0, size: 10 });
  });

  it("tìm theo từ khóa => gọi lại tìm kiếm trang 0 với từ khóa đã cắt khoảng trắng", async () => {
    renderPicker();
    await screen.findAllByTestId("dict-picker-row");
    await userEvent.type(screen.getByLabelText("Tìm từ trong từ điển"), "  xin  ");
    await userEvent.click(screen.getByRole("button", { name: "Tìm" }));
    await waitFor(() => expect(searchVocabularies).toHaveBeenLastCalledWith({ keySearch: "xin", page: 0, size: 10 }));
  });

  it("chọn nhiều từ rồi thêm => gọi thêm theo id từ điển kèm chữ Hán, toast, tải lại và đóng hộp", async () => {
    const { onAdded, onClose } = renderPicker();
    const rows = await screen.findAllByTestId("dict-picker-row");
    await userEvent.click(rows[0]);
    await userEvent.click(rows[2]);
    await userEvent.click(screen.getByRole("button", { name: "Thêm 2 từ vào bộ" }));
    await waitFor(() => expect(addDictionaryWordsToPackage).toHaveBeenCalledWith("p1", [{ id: "w1", label: "你好" }, { id: "w3", label: "谢谢" }], false, 1));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã thêm 2 từ vào bộ"));
    expect(onAdded).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("có từ lỗi => toast lỗi từng từ, vẫn tải lại, hộp giữ nguyên và chỉ còn chọn các từ lỗi để thử lại", async () => {
    vi.mocked(addDictionaryWordsToPackage).mockResolvedValue({ added: 1, failed: [{ label: "谢谢", message: "Từ chưa có nội dung" }] });
    const { onAdded, onClose } = renderPicker();
    const rows = await screen.findAllByTestId("dict-picker-row");
    await userEvent.click(rows[0]);
    await userEvent.click(rows[2]);
    await userEvent.click(screen.getByRole("button", { name: "Thêm 2 từ vào bộ" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Không thêm được "谢谢": Từ chưa có nội dung'));
    expect(onAdded).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Thêm 1 từ vào bộ" })).toBeEnabled();
    expect(screen.getAllByTestId("dict-picker-row")[2]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByTestId("dict-picker-row")[0]).toHaveAttribute("aria-pressed", "false");
  });

  it("nút Tải lại gọi lại tìm kiếm với cùng từ khóa và trang (vd sau khi thêm từ ở màn Từ điển)", async () => {
    renderPicker();
    await screen.findAllByTestId("dict-picker-row");
    expect(searchVocabularies).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: /Tải lại/ }));
    await waitFor(() => expect(searchVocabularies).toHaveBeenCalledTimes(2));
    expect(searchVocabularies).toHaveBeenLastCalledWith({ keySearch: "", page: 0, size: 10 });
  });

  it("thanh phân trang luôn hiện: không có kết quả hoặc chỉ một trang thì Trước/Sau đều bị khóa và ghi Trang 1/1", async () => {
    vi.mocked(searchVocabularies).mockResolvedValue(page([], 0));
    renderPicker();
    const pager = await screen.findByTestId("dict-picker-pager");
    expect(pager).toHaveTextContent("Trang 1/1 (0 từ)");
    expect(within(pager).getByRole("button", { name: "Trước" })).toBeDisabled();
    expect(within(pager).getByRole("button", { name: "Sau" })).toBeDisabled();
    expect(screen.getByText("Không có từ nào khớp.")).toBeInTheDocument();
  });

  it("có lối sang màn Từ điển để thêm từ chưa có, và phân trang khi có nhiều trang", async () => {
    vi.mocked(searchVocabularies).mockResolvedValue(page([word("w1", "你好", "nǐ hǎo", "xin chào")], 3));
    renderPicker();
    await screen.findAllByTestId("dict-picker-row");
    expect(screen.getByRole("link", { name: "Thêm vào Từ điển" })).toHaveAttribute("href", "/vocabulary/manage");
    await userEvent.click(screen.getByRole("button", { name: "Sau" }));
    await waitFor(() => expect(searchVocabularies).toHaveBeenLastCalledWith({ keySearch: "", page: 1, size: 10 }));
    expect(within(screen.getByRole("dialog")).getByText(/Trang 1\/3|Trang 2\/3/)).toBeInTheDocument();
  });
});
