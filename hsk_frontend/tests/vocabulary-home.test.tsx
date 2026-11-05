import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VocabularyHomePageContent } from "@/components/student/vocabulary/vocabulary-home-page-content";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { listHskLevelCounts, searchPublishedVocabularies } from "@/lib/api/lms-dictionary-client";
import type { Vocabulary, VocabularyPage } from "@/types/dictionary";

// Router giả CÓ trạng thái: replace đổi URL và báo cho useSearchParams (bộ lọc nằm trong URL).
const nav = vi.hoisted(() => {
  let url = "/vocabulary";
  const listeners = new Set<() => void>();
  return {
    replace: [] as string[],
    set(next: string) {
      url = next;
      window.history.replaceState(null, "", next);
      listeners.forEach((l) => l());
    },
    get: () => url,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
});
vi.mock("next/navigation", () => ({
  usePathname: () => nav.get().split("?")[0],
  useSearchParams: () => {
    const search = useSyncExternalStore(nav.subscribe, nav.get, nav.get);
    return new URLSearchParams(search.split("?")[1] ?? "");
  },
  useRouter: () => ({
    replace: (to: string) => {
      nav.replace.push(to);
      nav.set(to);
    },
    push: vi.fn(),
  }),
}));
vi.mock("@/components/student/dashboard/student-shell", () => ({ default: ({ children }: { children: ReactNode }) => <div data-testid="shell">{children}</div> }));
vi.mock("@/lib/api/lms-dictionary-client", () => ({ searchPublishedVocabularies: vi.fn(), listHskLevelCounts: vi.fn() }));

const word = (i: number, over: Partial<Vocabulary> = {}): Vocabulary => ({
  id: `w${i}`,
  hanzi: ["一", "七", "三"][i - 1] ?? `字${i}`,
  isSingleVocab: true,
  pinyins: [{ pinyin: ["yī", "qī", "sān"][i - 1] ?? "zì", wordTypes: "Số từ,Phó từ", isPrimary: true, meanings: [{ meaning: "một" }, { meaning: "số một" }] }],
  ...over,
});
const pageOf = (items: Vocabulary[], over: Partial<VocabularyPage> = {}): VocabularyPage => ({ items, totalElements: items.length, totalPages: 1, page: 0, size: 10, ...over });
const lastSearch = () => vi.mocked(searchPublishedVocabularies).mock.calls.at(-1)?.[0];

beforeEach(() => {
  nav.replace.length = 0;
  nav.set("/vocabulary");
  vi.mocked(searchPublishedVocabularies).mockReset().mockResolvedValue(pageOf([word(1), word(2), word(3)]));
  vi.mocked(listHskLevelCounts).mockReset().mockResolvedValue([{ level: 1, count: 500 }, { level: 2, count: 700 }]);
});

describe("màn Từ điển học viên /vocabulary", () => {
  it("hiện banner, ô tra cứu, lưới thẻ (Hán tự, phiên âm, từ loại có màu, nghĩa) và liên kết tới chi tiết", async () => {
    render(<VocabularyHomePageContent />);
    expect(screen.getByRole("heading", { name: "Từ vựng" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Tra cứu bằng tiếng Trung, Pinyin hoặc nghĩa tiếng Việt...")).toBeInTheDocument();
    const cards = await screen.findAllByTestId("vocabulary-card");
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveAttribute("href", "/vocabulary/w1");
    expect(within(cards[0]).getByText("一")).toBeInTheDocument();
    expect(within(cards[0]).getByText("yī")).toBeInTheDocument();
    expect(within(cards[0]).getByText("một; số một")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Số từ")).toHaveStyle({ backgroundColor: "#fce4ec" });
    expect(lastSearch()).toEqual({ keySearch: "", hskLevel: undefined, radical: undefined, page: 0, size: 10 });
  });

  it("từ không có từ loại hiện 'Chưa phân loại'; trang rỗng hiện 'Không tìm thấy từ vựng'", async () => {
    vi.mocked(searchPublishedVocabularies).mockResolvedValueOnce(pageOf([word(1, { pinyins: [{ pinyin: "yī", meanings: [{ meaning: "một" }] }] })]));
    const { unmount } = render(<VocabularyHomePageContent />);
    expect(await screen.findByText("Chưa phân loại")).toBeInTheDocument();
    unmount();
    vi.mocked(searchPublishedVocabularies).mockResolvedValueOnce(pageOf([]));
    render(<VocabularyHomePageContent />);
    expect(await screen.findByTestId("vocabulary-empty")).toHaveTextContent("Không tìm thấy từ vựng");
  });

  it("gõ từ khoá: chờ 400ms rồi ghi vào URL (về trang 0) và tìm; Enter tìm ngay", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      nav.set("/vocabulary?page=3");
      render(<VocabularyHomePageContent />);
      await screen.findAllByTestId("vocabulary-card");
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.type(screen.getByRole("searchbox", { name: "Tra cứu từ vựng" }), "ren");
      expect(nav.replace).toHaveLength(0);
      await act(async () => {
        vi.advanceTimersByTime(450);
      });
      expect(nav.get()).toBe("/vocabulary?keySearch=ren&page=0");
      await waitFor(() => expect(lastSearch()?.keySearch).toBe("ren"));
      await user.type(screen.getByRole("searchbox", { name: "Tra cứu từ vựng" }), "{Backspace}{Enter}");
      expect(nav.get()).toBe("/vocabulary?keySearch=re&page=0");
    } finally {
      vi.useRealTimers();
    }
  });

  it("lọc HSK: cấp lấy từ API, chọn rồi bấm lại để bỏ; 'Xóa lọc' bỏ lọc", async () => {
    const user = userEvent.setup();
    render(<VocabularyHomePageContent />);
    await screen.findAllByTestId("vocabulary-card");
    await user.click(screen.getByRole("button", { name: /Lọc theo Trình độ HSK/ }));
    await user.click(await screen.findByRole("button", { name: "HSK 2" }));
    expect(nav.get()).toBe("/vocabulary?hskLevel=2&page=0");
    await waitFor(() => expect(lastSearch()?.hskLevel).toBe(2));
    expect(screen.queryByRole("button", { name: "HSK 9" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "HSK 2" }));
    expect(nav.get()).toBe("/vocabulary?page=0");
    await user.click(screen.getByRole("button", { name: "HSK 1" }));
    await user.click(screen.getByRole("button", { name: /Xóa lọc/ }));
    expect(nav.get()).toBe("/vocabulary?page=0");
  });

  it("lọc bộ thủ: chọn số nét chỉ thu hẹp lưới (không tìm lại), chọn bộ thủ thì tìm theo ký tự; đổi số nét khác nhóm bỏ bộ thủ", async () => {
    const user = userEvent.setup();
    render(<VocabularyHomePageContent />);
    await screen.findAllByTestId("vocabulary-card");
    await user.click(screen.getByRole("button", { name: /Lọc theo Bộ thủ/ }));
    const calls = vi.mocked(searchPublishedVocabularies).mock.calls.length;
    await user.click(screen.getByRole("button", { name: "3" }));
    expect(nav.get()).toBe("/vocabulary?strokeFilter=3&page=0");
    expect(screen.queryByRole("button", { name: /Bộ Nhất 一/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: /Bộ Khẩu 口/ }));
    expect(nav.get()).toBe(`/vocabulary?radical=${encodeURIComponent("口")}&strokeFilter=3&page=0`);
    await waitFor(() => expect(lastSearch()?.radical).toBe("口"));
    expect(vi.mocked(searchPublishedVocabularies).mock.calls.length).toBe(calls + 1);
    await user.click(screen.getByRole("button", { name: "4" }));
    expect(nav.get()).toBe("/vocabulary?strokeFilter=4&page=0");
  });

  it("khôi phục từ URL (reload): panel bộ thủ tự mở, gửi đúng tham số; phân trang ghi page vào URL", async () => {
    vi.mocked(searchPublishedVocabularies).mockResolvedValue(pageOf([word(1)], { totalPages: 50, totalElements: 500, page: 4 }));
    nav.set(`/vocabulary?radical=${encodeURIComponent("口")}&hskLevel=1&page=4`);
    const user = userEvent.setup();
    render(<VocabularyHomePageContent />);
    await screen.findAllByTestId("vocabulary-card");
    expect(lastSearch()).toEqual({ keySearch: "", hskLevel: 1, radical: "口", page: 4, size: 10 });
    expect(screen.getByRole("button", { name: /Bộ Khẩu 口/ })).toHaveAttribute("aria-pressed", "true");
    const pager = within(screen.getByRole("navigation", { name: "Phân trang từ vựng" }));
    expect(pager.getByRole("button", { name: "5" })).toHaveAttribute("aria-current", "page");
    window.scrollTo = vi.fn();
    await user.click(pager.getByRole("button", { name: "Trang sau" }));
    expect(nav.get()).toBe(`/vocabulary?radical=${encodeURIComponent("口")}&strokeFilter=3&hskLevel=1&page=5`);
    const pagerAfter = within(await screen.findByRole("navigation", { name: "Phân trang từ vựng" }));
    await user.click(pagerAfter.getByRole("button", { name: "50" }));
    expect(nav.get()).toContain("page=49");
  });

  it("API lỗi: khối lỗi + 'Thử lại' (không nói 'Không tìm thấy'); chưa cấu hình: WAITING FOR BACKEND", async () => {
    vi.mocked(searchPublishedVocabularies).mockRejectedValueOnce(new ApiError("Máy chủ lỗi", 500));
    const user = userEvent.setup();
    const { unmount } = render(<VocabularyHomePageContent />);
    const notice = await screen.findByTestId("vocabulary-list-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(screen.queryByTestId("vocabulary-empty")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findAllByTestId("vocabulary-card")).toHaveLength(3);
    unmount();
    vi.mocked(searchPublishedVocabularies).mockRejectedValueOnce(new ApiNotConfiguredError());
    render(<VocabularyHomePageContent />);
    expect(await screen.findByTestId("vocabulary-list-notice")).toHaveTextContent("WAITING FOR BACKEND");
  });
});
