import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnswerFields } from "@/components/student/timetable/lesson-answer-fields";
import { encodeChoice, encodeChunks, encodeKeyed, encodeMultiple, encodeText, isAnswered, keyedAnswers, partKey, parseAnswer } from "@/lib/assessment/answer-codec";

describe("answer-codec — định dạng đáp án của backend", () => {
  it("mã hoá từng loại câu đúng khoá backend, chuỗi rỗng khi chưa trả lời", () => {
    expect(encodeChoice(2)).toBe('{"selectedOptionIndex":2}');
    expect(encodeChoice(null)).toBe("");
    expect(encodeMultiple([3, 1])).toBe('{"selectedOptionIndexes":[1,3]}');
    expect(encodeMultiple([])).toBe("");
    expect(encodeChunks([2, 0, 1])).toBe('{"chunkOrder":[2,0,1]}');
    expect(encodeText("  ")).toBe("");
    expect(parseAnswer(encodeText("xin chào"))).toEqual({ text: "xin chào" });
  });

  it("câu nối/câu điền: bỏ ý để trống, không còn ý nào thì là chưa trả lời; giữ ý khác khi sửa một ý", () => {
    expect(encodeKeyed("blankAnswers", { "0": "đi", "1": "  " })).toBe('{"blankAnswers":{"0":"đi"}}');
    expect(encodeKeyed("matchingAnswers", { "0": "" })).toBe("");
    expect(keyedAnswers('{"matchingAnswers":{"1":"b"}}', "matchingAnswers")).toEqual({ "1": "b" });
    expect(isAnswered("")).toBe(false);
    expect(isAnswered('{"text":"a"}')).toBe(true);
  });

  it("khoá của ý theo pairIndex/blankIndex của backend, thiếu thì theo vị trí", () => {
    expect(partKey({ pairIndex: 5 }, 0, "pairIndex")).toBe("5");
    expect(partKey({}, 3, "blankIndex")).toBe("3");
  });
});

const setup = (question: Record<string, unknown>, value = "") => {
  const onChange = vi.fn();
  render(<AnswerFields question={question} value={value} onChange={onChange} />);
  return onChange;
};

describe("AnswerFields — ô trả lời theo loại câu", () => {
  it("trắc nghiệm: chọn lựa chọn gửi selectedOptionIndex theo optionIndex", () => {
    const onChange = setup({ questionType: "MULTIPLE_CHOICE", options: [{ optionIndex: 0, content: "A1" }, { optionIndex: 1, content: "B1" }] });
    fireEvent.click(screen.getByRole("radio", { name: /B1/ }));
    expect(onChange).toHaveBeenCalledWith('{"selectedOptionIndex":1}');
  });

  it("chọn nhiều: bật rồi tắt lựa chọn", () => {
    const question = { questionType: "MULTIPLE_SELECT", options: [{ optionIndex: 0, content: "x" }, { optionIndex: 1, content: "y" }] };
    const onChange = setup(question, encodeMultiple([0]));
    fireEvent.click(screen.getByRole("checkbox", { name: /y/ }));
    expect(onChange).toHaveBeenLastCalledWith('{"selectedOptionIndexes":[0,1]}');
    fireEvent.click(screen.getByRole("checkbox", { name: /x/ }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("câu nối: chọn đáp án cho một dòng giữ nguyên dòng khác, không khoá đáp án dùng lại", () => {
    const question = { questionType: "MATCHING", options: [{ content: "a" }, { content: "b" }], matchingPairs: [{ pairIndex: 0, prompt: "1" }, { pairIndex: 1, prompt: "2" }] };
    const onChange = setup(question, '{"matchingAnswers":{"0":"a"}}');
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "a" } });
    expect(onChange).toHaveBeenCalledWith('{"matchingAnswers":{"0":"a","1":"a"}}');
  });

  it("câu điền: {{n}} thành ô nhập, ô thứ n ghi vào blankIndex n-1", () => {
    const onChange = setup({ questionType: "FILL_IN_BLANK", questionText: "<p>Tôi {{1}} học, bạn {{2}} làm</p>" });
    fireEvent.change(screen.getByLabelText("Ô trống 2"), { target: { value: "đi" } });
    expect(onChange).toHaveBeenCalledWith('{"blankAnswers":{"1":"đi"}}');
  });

  it("xếp câu: bấm mảnh thêm vào thứ tự theo chỉ số trong sentenceChunks; bấm mảnh đã xếp để bỏ", () => {
    const question = { questionType: "SENTENCE_BUILDER", sentenceChunks: [{ content: "học" }, { content: "Tôi" }, { content: "bài" }] };
    const onChange = setup(question, encodeChunks([1]));
    fireEvent.click(screen.getByRole("button", { name: "học" }));
    expect(onChange).toHaveBeenLastCalledWith('{"chunkOrder":[1,0]}');
    fireEvent.click(screen.getByTitle("Bấm để bỏ mảnh này"));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("tự luận: gõ gửi {text}, hiện số từ và số từ tối thiểu", () => {
    const onChange = setup({ questionType: "ESSAY", minimumWords: 50 }, encodeText("một hai ba"));
    expect(screen.getByText(/3 từ · tối thiểu 50 từ/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Câu trả lời"), { target: { value: "bốn" } });
    expect(onChange).toHaveBeenCalledWith('{"text":"bốn"}');
  });
});
