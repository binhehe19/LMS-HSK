import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { RECENT_VOCAB_KEY } from "@/lib/dictionary/recent-vocabulary";
import type { VocabularyDetail } from "@/types/dictionary";

const mocks = vi.hoisted(() => ({
  getPublishedVocabulary: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  toastSuccess: vi.fn(),
  writer: {
    quiz: vi.fn(async () => undefined),
    cancelQuiz: vi.fn(),
    animateCharacter: vi.fn(async () => undefined),
    showOutline: vi.fn(),
    hideOutline: vi.fn(),
  },
  create: vi.fn(),
}));

vi.mock("@/lib/api/lms-dictionary-client", () => ({ getPublishedVocabulary: mocks.getPublishedVocabulary }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, back: mocks.back, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: vi.fn() }, Toaster: () => null }));
vi.mock("hanzi-writer", () => ({ default: { create: mocks.create } }));
vi.mock("@/lib/dictionary/hanzi-writer-loader", () => ({
  loadHanziChar: vi.fn(async () => ({ strokes: ["M 0 0 L 10 10", "M 5 5 L 20 20"], medians: [] })),
  charDataLoader: vi.fn(),
}));

import { VocabularyDetailPageContent } from "@/components/student/vocabulary/vocabulary-detail-page-content";

function makeDetail(overrides: Partial<VocabularyDetail> = {}): VocabularyDetail {
  return {
    id: "01HZWORD",
    hanzi: "山水",
    hskLevel: 3,
    isSingleVocab: false,
    radical: "SƠN 山",
    pinyins: [
      { pinyin: "shānshui", isPrimary: false, sinoVietnamese: "SAI", meanings: [{ meaning: "nghĩa phụ" }] },
      {
        pinyin: "shān shuǐ",
        isPrimary: true,
        sinoVietnamese: "SƠN THỦY",
        wordTypes: "Danh từ, Tính từ",
        compounds: JSON.stringify([
          { hanzi: "山水画", sinoVietnamese: "SƠN THỦY HỌA" },
          { hanzi: "山水诗", sinoVietnamese: "SƠN THỦY THI" },
        ]),
        meanings: [
          { id: "m1", meaning: "phong cảnh", exampleSentenceCn: "这里的山水很美。", exampleSentencePinyin: "zhè lǐ de shān shuǐ hěn měi", exampleSentenceVi: "Phong cảnh ở đây rất đẹp." },
          { id: "m2", meaning: "tranh sơn thủy", exampleSentenceCn: "他喜欢画山水。", exampleSentencePinyin: "tā xǐ huan huà shān shuǐ" },
          { id: "m3", meaning: "thơ", exampleSentenceCn: "山水诗很有名。" },
          { id: "m4", meaning: "không có ví dụ" },
        ],
      },
    ],
    components: [
      { id: "01HZSHAN", hanzi: "山", pinyin: "shān", meaning: "núi" },
      { id: null, hanzi: "水", pinyin: "shuǐ", meaning: "nước" },
    ],
    ...overrides,
  };
}

async function renderLoaded(detail: VocabularyDetail = makeDetail()) {
  mocks.getPublishedVocabulary.mockResolvedValue(detail);
  render(<VocabularyDetailPageContent id={detail.id} />);
  await screen.findByRole("heading", { level: 1, name: detail.hanzi });
}

beforeEach(() => {
  mocks.getPublishedVocabulary.mockReset();
  mocks.push.mockReset();
  mocks.back.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.create.mockReset();
  mocks.create.mockReturnValue(mocks.writer);
  Object.values(mocks.writer).forEach((fn) => fn.mockClear());
});

describe("VocabularyDetailPageContent — trạng thái", () => {
  it("hiện spinner khi đang tải", () => {
    mocks.getPublishedVocabulary.mockReturnValue(new Promise(() => {}));
    render(<VocabularyDetailPageContent id="01X" />);
    expect(screen.getByTestId("vocabulary-detail-loading")).toBeInTheDocument();
    expect(mocks.getPublishedVocabulary).toHaveBeenCalledWith("01X");
  });

  it("404 => Không tìm thấy từ vựng + Quay lại (không có lịch sử => về /vocabulary)", async () => {
    mocks.getPublishedVocabulary.mockRejectedValue(new ApiError("Không tìm thấy dữ liệu được yêu cầu.", 404));
    render(<VocabularyDetailPageContent id="01X" />);
    expect(await screen.findByText("Không tìm thấy từ vựng")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(mocks.push).toHaveBeenCalledWith("/vocabulary");
  });

  it("thiếu cấu hình API => WAITING FOR BACKEND, không phải không tìm thấy", async () => {
    mocks.getPublishedVocabulary.mockRejectedValue(new ApiNotConfiguredError());
    render(<VocabularyDetailPageContent id="01X" />);
    expect(await screen.findByTestId("vocabulary-detail-waiting")).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.queryByText("Không tìm thấy từ vựng")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
  });

  it("lỗi khác => thông báo + Thử lại gọi lại API", async () => {
    mocks.getPublishedVocabulary.mockRejectedValueOnce(new ApiError("Hệ thống đang tạm thời gián đoạn.", 503)).mockResolvedValueOnce(makeDetail());
    render(<VocabularyDetailPageContent id="01HZWORD" />);
    expect(await screen.findByText("Hệ thống đang tạm thời gián đoạn.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("heading", { level: 1, name: "山水" })).toBeInTheDocument();
    expect(mocks.getPublishedVocabulary).toHaveBeenCalledTimes(2);
  });
});

describe("VocabularyDetailPageContent — dữ liệu", () => {
  it("hiện từ, pinyin CHÍNH, nghĩa, Hán Việt, HSK, từ loại và breadcrumb", async () => {
    await renderLoaded();
    const hero = document.querySelector(".vd-hero") as HTMLElement;
    expect(within(hero).getByText("shān shuǐ")).toBeInTheDocument();
    expect(screen.queryByText("shānshui")).not.toBeInTheDocument();
    expect(within(hero).getByText("phong cảnh")).toBeInTheDocument();
    expect(within(hero).getByText("Hán việt: SƠN THỦY")).toBeInTheDocument();
    expect(within(hero).getByText("HSK3")).toBeInTheDocument();
    expect(within(hero).getByText("Danh từ")).toHaveStyle({ color: "#1565c0" });
    expect(within(hero).getByText("Tính từ")).toBeInTheDocument();

    const crumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumb).getByRole("link", { name: /Trang chủ/ })).toHaveAttribute("href", "/student/student-dashboard");
    expect(within(crumb).getByRole("link", { name: "Từ vựng" })).toHaveAttribute("href", "/vocabulary");
    expect(crumb).toHaveTextContent("HSK 3.0/HSK3/Chi tiết từ vựng 山水");
    expect(screen.getByText("Chưa có hình ảnh")).toBeInTheDocument();
  });

  it("chữ thành phần có id là liên kết, không có id thì không bấm được", async () => {
    await renderLoaded();
    const group = screen.getByTestId("vocabulary-analysis-nodes");
    expect(within(group).getByRole("link", { name: /山/ })).toHaveAttribute("href", "/vocabulary/01HZSHAN");
    expect(within(group).getAllByRole("link")).toHaveLength(1);
    expect(within(group).getByText("水")).toBeInTheDocument();
    expect(within(group).getByText("nước")).toBeInTheDocument();
  });

  it("không có components => ô bộ thủ tra theo ký tự ('SƠN 山' => 山)", async () => {
    await renderLoaded(makeDetail({ hanzi: "岩", components: [], radical: "SƠN 山" }));
    const group = screen.getByTestId("vocabulary-analysis-nodes");
    expect(within(group).getByText("Bộ Sơn")).toBeInTheDocument();
    expect(within(group).getByText("3 nét")).toBeInTheDocument();
    expect(within(group).queryByRole("link")).not.toBeInTheDocument();
  });

  it("ví dụ: 2 câu rồi Xem tất cả / Thu gọn, chữ đang tra được tô đỏ", async () => {
    await renderLoaded();
    expect(screen.getByText("Ví dụ (3)")).toBeInTheDocument();
    expect(document.querySelectorAll(".vd-example")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Xem tất cả" }));
    expect(document.querySelectorAll(".vd-example")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Thu gọn" }));
    expect(document.querySelectorAll(".vd-example")).toHaveLength(2);
    const highlighted = Array.from(document.querySelectorAll(".vd-example .hl")).map((el) => el.textContent);
    expect(highlighted).toContain("山水");
    expect(highlighted).toContain("shān shuǐ");
  });

  it("nút lưu chỉ đổi trạng thái tại chỗ + toast như bản cũ", async () => {
    await renderLoaded();
    const save = screen.getByRole("button", { name: "Lưu từ vựng" });
    fireEvent.click(save);
    expect(mocks.toastSuccess).toHaveBeenLastCalledWith("Đã lưu từ vựng");
    expect(screen.getByRole("button", { name: "Bỏ lưu từ vựng" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Bỏ lưu từ vựng" }));
    expect(mocks.toastSuccess).toHaveBeenLastCalledWith("Đã bỏ lưu từ vựng");
  });

  it("có audioUrl => nút loa của từ phát tệp đó thay cho TTS", async () => {
    const played: string[] = [];
    class FakeAudio {
      src: string;
      playbackRate = 1;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(src: string) {
        this.src = src;
        played.push(src);
      }
      play() {
        return Promise.resolve();
      }
      pause() {}
    }
    vi.stubGlobal("Audio", FakeAudio);
    try {
      await renderLoaded(makeDetail({ audioUrl: "https://cdn.test/shanshui.mp3" }));
      fireEvent.click(screen.getByRole("button", { name: "Nghe phát âm" }));
      expect(played).toEqual(["https://cdn.test/shanshui.mp3"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("ảnh từ API được ưu tiên; Wikimedia chỉ chạy khi bật env", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      await renderLoaded(makeDetail({ hanzi: "山", components: [], etymologyImage: "https://cdn.test/shan.png" }));
      expect(screen.getByRole("img", { name: "山" })).toHaveAttribute("src", "https://cdn.test/shan.png");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("Wikimedia (bật env) => hiển thị ảnh tìm được, không upload", async () => {
    vi.stubEnv("NEXT_PUBLIC_DICTIONARY_WIKIMEDIA_FALLBACK", "enabled");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ query: { pages: { "1": { imageinfo: [{ url: "https://upload.wikimedia.org/seal.svg" }] } } } }), { status: 200 }));
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Image", FakeImage);
    try {
      await renderLoaded(makeDetail({ hanzi: "山", components: [] }));
      expect(await screen.findByRole("img", { name: "山" })).toHaveAttribute("src", "https://upload.wikimedia.org/seal.svg");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("commons.wikimedia.org");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("VocabularyDetailPageContent — Từ đã xem", () => {
  it("ghi từ vừa xem vào localStorage (id chuỗi), giữ từ cũ hợp lệ, bỏ id số của bản cũ", async () => {
    window.localStorage.setItem(
      RECENT_VOCAB_KEY,
      JSON.stringify([
        { id: 7, hanzi: "旧", pinyin: "jiù" },
        { id: "01HZOLD", hanzi: "好", pinyin: "hǎo" },
      ]),
    );
    await renderLoaded();
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(RECENT_VOCAB_KEY) ?? "[]")).toEqual([
      { id: "01HZWORD", hanzi: "山水", pinyin: "shān shuǐ" },
      { id: "01HZOLD", hanzi: "好", pinyin: "hǎo" },
    ]));
    const recent = document.querySelector(".vd-recent") as HTMLElement;
    expect(within(recent).getByText("2 từ")).toBeInTheDocument();
    fireEvent.click(within(recent).getByRole("button", { name: /好/ }));
    expect(mocks.push).toHaveBeenCalledWith("/vocabulary/01HZOLD");

    fireEvent.click(within(recent).getByRole("button", { name: "Xóa tất cả" }));
    expect(window.localStorage.getItem(RECENT_VOCAB_KEY)).toBeNull();
    expect(within(recent).getByText("Chưa có từ nào.")).toBeInTheDocument();
    expect(within(recent).getByText("0 từ")).toBeInTheDocument();
  });

  it("storage bị chặn => trang vẫn chạy, danh sách rỗng", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    await renderLoaded();
    expect(within(document.querySelector(".vd-recent") as HTMLElement).getByText("0 từ")).toBeInTheDocument();
  });
});

describe("VocabularyDetailPageContent — popup luyện tập", () => {
  it("Luyện tập: dựng câu nối từ compounds + câu pinyin từ ví dụ", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Luyện tập" }));
    const dialog = await screen.findByRole("dialog", { name: "Luyện tập từ vựng: 山水" });
    expect(within(dialog).getByText("Câu 1/3")).toBeInTheDocument();
    expect(within(dialog).getByText("Nối từ ghép có chữ 山水 ở cột A với nghĩa phù hợp ở cột B.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "1. 山水画" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Câu tiếp" })).toBeDisabled();
    expect(document.querySelector(".hsk-vocab-modal .pm-modal--green")).not.toBeNull();
  });

  it("Luyện viết: tạo hanzi-writer bằng import động cho chữ đầu tiên, đổi chữ tạo writer mới", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Luyện viết" }));
    const dialog = await screen.findByRole("dialog", { name: "Luyện viết: 山水" });
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create.mock.calls[0][1]).toBe("山");
    expect(await screen.findAllByText("ĐANG TẬP")).toHaveLength(1);
    await waitFor(() => expect(document.querySelectorAll(".so-thumb-box")).toHaveLength(2));

    fireEvent.click(screen.getByRole("switch", { name: "Viết" }));
    expect(mocks.writer.quiz).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("button", { name: /^水/ }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[1][1]).toBe("水");
    expect(screen.getByRole("switch", { name: "Viết" })).toHaveAttribute("aria-checked", "false");
  });

  it("Hội thoại: lượt A/B từ ví dụ, tốc độ lưu ở dialogue_audio_speed", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: /Hội thoại/ }));
    const dialog = await screen.findByRole("dialog", { name: "Luyện hội thoại: 山水" });
    expect(dialog.querySelectorAll(".cv-turn--a")).toHaveLength(2);
    expect(dialog.querySelectorAll(".cv-turn--b")).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole("button", { name: /Cài đặt/ }));
    const settings = await screen.findByRole("dialog", { name: "Cài đặt hội thoại" });
    fireEvent.click(within(settings).getByRole("button", { name: "1.5x" }));
    expect(window.localStorage.getItem("dialogue_audio_speed")).toBe("1.5");
    fireEvent.click(within(settings).getByRole("switch", { name: "Hiển thị bản dịch" }));
    expect(within(dialog).queryByText("Phong cảnh ở đây rất đẹp.")).not.toBeInTheDocument();
  });

  it("Phát âm: câu mẫu đầu tiên có pinyin trên từng chữ; Esc đóng popup và mở khoá cuộn", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: /Phát âm/ }));
    const dialog = await screen.findByRole("dialog", { name: "Luyện phát âm: 山水" });
    expect(document.body.style.overflow).toBe("hidden");
    const rubies = Array.from(dialog.querySelectorAll(".pm-ruby__pinyin")).map((el) => el.textContent);
    expect(rubies.slice(0, 3)).toEqual(["zhè", "lǐ", "de"]);
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe("");
  });
});
