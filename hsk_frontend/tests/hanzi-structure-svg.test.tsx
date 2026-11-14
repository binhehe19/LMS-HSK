import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HanziStructureSvg } from "@/components/management/dictionary/hanzi-structure-svg";
import { hanziCharsOf } from "@/lib/dictionary/hanzi-writer-module";

type WriterOptions = { radicalColor?: string; showCharacter?: boolean; onLoadCharDataSuccess?: () => void; onLoadCharDataError?: () => void };
const create = vi.hoisted(() => vi.fn());
vi.mock("hanzi-writer", () => ({ default: { create } }));
vi.mock("@/lib/dictionary/hanzi-writer-loader", () => ({ charDataLoader: vi.fn() }));

// Giả lập Hanzi Writer: chữ nằm trong `missing` không có dữ liệu nét, còn lại vẽ được.
function stubWriter(missing: string[] = []) {
  create.mockImplementation((_target: HTMLElement, char: string, options: WriterOptions) => {
    queueMicrotask(() => (missing.includes(char) ? options.onLoadCharDataError?.() : options.onLoadCharDataSuccess?.()));
  });
}

beforeEach(() => create.mockReset());

describe("hanziCharsOf", () => {
  it("chỉ lấy chữ Hán, bỏ chữ số, chữ Latin, dấu và chữ lặp, giữ thứ tự", () => {
    expect(hanziCharsOf("21三体综合症")).toEqual(["三", "体", "综", "合", "症"]);
    expect(hanziCharsOf("妈妈")).toEqual(["妈"]);
    expect(hanziCharsOf("AA制")).toEqual(["制"]);
    expect(hanziCharsOf(undefined)).toEqual([]);
  });

  it("tối đa 12 chữ", () => {
    expect(hanziCharsOf("一二三四五六七八九十百千万亿")).toHaveLength(12);
  });
});

describe("HanziStructureSvg", () => {
  it("mỗi chữ Hán khác nhau một SVG, hiện chữ và tô màu bộ thủ", async () => {
    stubWriter();
    render(<HanziStructureSvg word="好好人" />);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("hanzi-structure")).not.toHaveAttribute("hidden"));
    expect(create.mock.calls.map(([, char]) => char)).toEqual(["好", "人"]);
    const options = create.mock.calls[0][2] as WriterOptions;
    expect(options.showCharacter).toBe(true);
    expect(options.radicalColor).toBe("#077ddd");
    expect(screen.getByRole("img", { name: "Cấu tạo chữ 好" })).toBeInTheDocument();
  });

  it("chữ không có dữ liệu nét bị ẩn riêng, chữ còn lại vẫn hiện", async () => {
    stubWriter(["罕"]);
    render(<HanziStructureSvg word="罕好" />);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("hanzi-structure")).not.toHaveAttribute("hidden"));
    // Ô và nút của chữ thiếu dữ liệu nằm trong cột bị ẩn (d-none); chữ còn lại hiện cả ô lẫn nút.
    await waitFor(() => expect(screen.getByLabelText("Cấu tạo chữ 罕").parentElement).toHaveClass("d-none"));
    expect(screen.getByLabelText("Cấu tạo chữ 好").parentElement).not.toHaveClass("d-none");
  });

  it("mỗi chữ có nút Viết ngay dưới ô; bấm thì chỉ chữ đó viết lại nét tại chỗ, nút khóa trong lúc viết", async () => {
    const animations: Record<string, { animateCharacter: ReturnType<typeof vi.fn> }> = {};
    let finishWriting: () => void = () => undefined;
    create.mockImplementation((_target: HTMLElement, char: string, options: WriterOptions) => {
      const animateCharacter = vi.fn(() => (char === "校" ? new Promise<void>((resolve) => (finishWriting = resolve)) : Promise.resolve()));
      animations[char] = { animateCharacter };
      queueMicrotask(() => options.onLoadCharDataSuccess?.());
      return { animateCharacter, pauseAnimation: vi.fn().mockResolvedValue(undefined) };
    });
    render(<HanziStructureSvg word="学校" />);
    await waitFor(() => expect(screen.getByTestId("hanzi-structure")).not.toHaveAttribute("hidden"));
    const buttons = screen.getAllByRole("button", { name: /^Viết chữ/ });
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(["Viết chữ 学", "Viết chữ 校"]);
    expect(buttons[0]).toHaveTextContent("Viết");
    expect(screen.getByLabelText("Cấu tạo chữ 学").nextElementSibling).toBe(buttons[0]); // nút nằm ngay dưới ô chữ của nó

    await userEvent.click(buttons[1]);
    expect(animations["校"].animateCharacter).toHaveBeenCalledTimes(1);
    expect(animations["学"].animateCharacter).not.toHaveBeenCalled();
    expect(buttons[1]).toBeDisabled();
    expect(screen.queryByText(/Cách viết chữ/)).not.toBeInTheDocument(); // không còn hộp thoại

    finishWriting();
    await waitFor(() => expect(buttons[1]).toBeEnabled());
  });

  it("không chữ nào có dữ liệu => cả khối ẩn; từ không có chữ Hán => không dựng gì", async () => {
    stubWriter(["罕"]);
    const { container, rerender } = render(<HanziStructureSvg word="罕" />);
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(screen.getByTestId("hanzi-structure")).toHaveAttribute("hidden");
    rerender(<HanziStructureSvg word="ABC123" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("thẻ Media có thông báo khi chưa nhập chữ hoặc không có dữ liệu nét", async () => {
    stubWriter(["罕"]);
    const { rerender } = render(<HanziStructureSvg word="" showStatus />);
    expect(screen.getByText("Chưa có chữ Hán để xem nét viết.")).toBeInTheDocument();

    rerender(<HanziStructureSvg word="罕" showStatus />);
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải nét viết…");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Chưa có dữ liệu nét viết cho từ này."));
  });
});
