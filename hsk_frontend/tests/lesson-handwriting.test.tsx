import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import HanziWriter from "hanzi-writer";
import LessonHandwriting from "@/components/student/timetable/lesson-handwriting";

const mocks = vi.hoisted(() => {
  const writer = () => ({
    animateCharacter: vi.fn(),
    cancelQuiz: vi.fn(),
    hideCharacter: vi.fn(),
    hideOutline: vi.fn(),
    showOutline: vi.fn(),
    quiz: vi.fn(),
  });
  return { first: writer(), second: writer(), save: vi.fn() };
});

vi.mock("@/lib/dictionary/hanzi-writer-loader", () => ({ loadHanziChar: async () => ({ strokes: [], medians: [] }) }));
vi.mock("@/lib/api/student-client", () => ({ studentApi: { saveVocabularyState: mocks.save } }));

it("keeps hints local to each character and cancels the full writing round without saving", async () => {
  vi.spyOn(HanziWriter, "create").mockImplementation((_target, character) => (character === "你" ? mocks.first : mocks.second) as unknown as HanziWriter);
  render(<LessonHandwriting words={[{
    id: "link:0", resourceId: "word", word: "你好", pinyin: "nǐ hǎo", meaning: "xin chào",
    pos: "", image: null, audio: null, examples: [], learned: false, progressKnown: true,
  }]} />);
  const first = within(screen.getByRole("group", { name: "Ký tự 1: 你" }));
  const second = within(screen.getByRole("group", { name: "Ký tự 2: 好" }));
  const demo = first.getByRole("button", { name: "Xem gợi ý" });
  const start = screen.getByRole("button", { name: "Bắt đầu viết ngay" });
  await waitFor(() => expect(start).toBeEnabled());

  fireEvent.click(demo);
  fireEvent.click(demo);
  expect(mocks.first.animateCharacter).toHaveBeenCalledTimes(2);
  expect(mocks.second.animateCharacter).not.toHaveBeenCalled();
  expect(demo).not.toHaveAttribute("aria-pressed");
  mocks.first.hideCharacter.mockClear();
  act(() => mocks.first.animateCharacter.mock.calls[0][0].onComplete({ canceled: true }));
  expect(mocks.first.hideCharacter).not.toHaveBeenCalled();
  act(() => mocks.first.animateCharacter.mock.calls[1][0].onComplete({ canceled: false }));
  expect(mocks.first.hideCharacter).toHaveBeenCalledOnce();

  fireEvent.click(start);
  expect(mocks.second.quiz).toHaveBeenCalledOnce();
  fireEvent.click(first.getByRole("button", { name: "Ẩn nét gợi ý" }));
  const showOutline = first.getByRole("button", { name: "Hiện nét gợi ý" });
  expect(second.getByRole("button", { name: "Ẩn nét gợi ý" })).toBeInTheDocument();
  expect(mocks.first.hideOutline).toHaveBeenCalledOnce();
  expect(mocks.second.hideOutline).not.toHaveBeenCalled();
  mocks.first.showOutline.mockClear();
  fireEvent.click(showOutline);
  expect(first.getByRole("button", { name: "Ẩn nét gợi ý" })).toBeInTheDocument();
  expect(mocks.first.showOutline).toHaveBeenCalledOnce();
  expect(mocks.first.quiz).toHaveBeenCalledOnce();

  fireEvent.click(demo);
  expect(screen.getByRole("button", { name: "Ngừng viết" })).toBeEnabled();
  act(() => mocks.first.animateCharacter.mock.calls[2][0].onComplete({ canceled: false }));
  expect(mocks.first.quiz).toHaveBeenCalledTimes(2);
  expect(mocks.second.quiz).toHaveBeenCalledOnce();

  const completeFirst = mocks.first.quiz.mock.calls[1][0].onComplete;
  const completeSecond = mocks.second.quiz.mock.calls[0][0].onComplete;
  mocks.first.cancelQuiz.mockClear();
  mocks.second.cancelQuiz.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Ngừng viết" }));
  expect(mocks.first.cancelQuiz).toHaveBeenCalled();
  expect(mocks.second.cancelQuiz).toHaveBeenCalled();
  expect(start).toBeEnabled();
  act(() => { completeFirst(); completeSecond(); });
  expect(mocks.save).not.toHaveBeenCalled();
});
