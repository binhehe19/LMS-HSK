import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnswerFields, shuffledOrder } from "@/components/student/timetable/lesson-answer-fields";
import { encodeChoice, encodeChunks, encodeKeyed, encodeMatching, encodeMultiple, encodeText, isAnswered, keyedAnswers, matchingAnswers, optionLabel, partKey, parseAnswer } from "@/lib/assessment/answer-codec";

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
    expect(encodeMatching({ "0": null })).toBe("");
    expect(encodeMatching({ "0": 2, "1": null })).toBe('{"matchingAnswers":{"0":2}}');
    expect(matchingAnswers('{"matchingAnswers":{"1":3,"2":"chữ cũ"}}')).toEqual({ "1": 3 });
    expect(keyedAnswers('{"blankAnswers":{"1":"b"}}', "blankAnswers")).toEqual({ "1": "b" });
    expect(optionLabel([{ optionIndex: 5, content: "" }, { optionIndex: 7, content: "C." }], 5)).toBe("A");
    expect(optionLabel([{ optionIndex: 5, content: "" }, { optionIndex: 7, content: "C." }], 7)).toBe("C.");
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

  it("câu nối: gửi optionIndex của lựa chọn; chọn một dòng giữ nguyên dòng khác, không khoá đáp án dùng lại", () => {
    const question = { questionType: "MATCHING", options: [{ optionIndex: 0, content: "a" }, { optionIndex: 1, content: "b" }], matchingPairs: [{ pairIndex: 0, prompt: "1" }, { pairIndex: 1, prompt: "2" }] };
    const onChange = setup(question, '{"matchingAnswers":{"0":0}}');
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "0" } });
    expect(onChange).toHaveBeenCalledWith('{"matchingAnswers":{"0":0,"1":0}}');
    fireEvent.change(selects[0], { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("câu nối hai tranh cùng nhãn 'A': mỗi tranh là một lựa chọn riêng, gửi đúng chỉ số của tranh đã chọn", () => {
    const question = {
      questionId: "q-same",
      questionType: "MATCHING",
      options: [{ optionIndex: 0, content: "A", mediaUrl: "/api/storage/file/cat" }, { optionIndex: 1, content: "A", mediaUrl: "/api/storage/file/dog" }],
      matchingPairs: [{ pairIndex: 0, prompt: "狗" }],
    };
    const onChange = setup(question);
    expect(screen.getAllByRole("option", { name: "A" })).toHaveLength(2);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "1" } });
    expect(onChange).toHaveBeenCalledWith('{"matchingAnswers":{"0":1}}');
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

  it("trắc nghiệm có ảnh lựa chọn: hiện ảnh storage, bỏ đường dẫn không an toàn; nhãn trùng chữ cái của ô không in lại", () => {
    setup({ questionType: "MULTIPLE_CHOICE", options: [{ optionIndex: 0, content: "A", mediaUrl: "/api/storage/file/img1" }, { optionIndex: 1, content: "B", mediaUrl: "javascript:alert(1)" }] });
    expect(screen.getByAltText("Đáp án A")).toHaveAttribute("src", "/api/storage/file/img1");
    expect(screen.queryByAltText("Đáp án B")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "A Đáp án A" })).toBeInTheDocument();
  });

  it("câu nối có ảnh: bảng tranh dùng nhãn của lựa chọn (C., E), ảnh vế trái; giá trị gửi là optionIndex", () => {
    const question = {
      questionId: "q-img",
      questionType: "MATCHING",
      options: [{ optionIndex: 0, content: "C.", mediaUrl: "/api/storage/file/cat" }, { optionIndex: 1, content: "E", mediaUrl: "/api/storage/file/dog" }],
      matchingPairs: [{ pairIndex: 0, prompt: "猫", promptMediaUrl: "/api/storage/file/left" }],
    };
    const onChange = setup(question);
    expect(screen.getByRole("list", { name: "Các lựa chọn" })).toBeInTheDocument();
    expect(screen.getByAltText("Lựa chọn C.")).toHaveAttribute("src", "/api/storage/file/cat");
    expect(screen.getByAltText("Dòng 1")).toHaveAttribute("src", "/api/storage/file/left");
    expect(screen.queryByRole("option", { name: /^A\. / })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "0" } });
    expect(onChange).toHaveBeenCalledWith('{"matchingAnswers":{"0":0}}');
  });

  it("xếp câu: mảnh hiện theo thứ tự trộn cố định (không theo thứ tự lưu), cùng câu luôn cùng thứ tự", () => {
    const chunks = ["我", "是", "学", "生", "了", "吗"].map((content) => ({ content }));
    setup({ questionId: "q-chunks", questionType: "SENTENCE_BUILDER", sentenceChunks: chunks });
    const shown = screen.getAllByRole("button").map((b) => b.textContent).filter((t) => t !== "Làm lại");
    expect(shown).not.toEqual(chunks.map((c) => c.content));
    expect([...shown].sort()).toEqual(chunks.map((c) => c.content).sort());
    expect(shuffledOrder(6, "q-chunks:chunks")).toEqual(shuffledOrder(6, "q-chunks:chunks"));
  });

  it("tự luận: gõ gửi {text}, hiện số từ và số từ tối thiểu", () => {
    const onChange = setup({ questionType: "ESSAY", minimumWords: 50 }, encodeText("một hai ba"));
    expect(screen.getByText(/3 từ · tối thiểu 50 từ/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Câu trả lời"), { target: { value: "bốn" } });
    expect(onChange).toHaveBeenCalledWith('{"text":"bốn"}');
  });
});
