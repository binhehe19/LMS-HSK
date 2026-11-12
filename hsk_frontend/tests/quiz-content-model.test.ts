import { describe, expect, it } from "vitest";
import { DEFAULT_PASSING_SCORE, emptyQuizInput, normalizeQuizInput, quizDifficultyMeta, quizSkillLabel, quizSkillWarnings, QUIZ_SKILLS, quizToInput, validateQuizInput } from "@/lib/content/quiz-item";
import { countBlanks, DEFAULT_QUESTION_POINTS, emptyQuestionInput, normalizeQuestionInput, parseAcceptable, questionSummary, questionToInput, questionTypeMeta, QUIZ_QUESTION_TYPES, sortQuestions, validateQuestionInput } from "@/lib/content/quiz-question";
import type { QuizItem, QuizQuestion } from "@/types/content-quiz";

const quiz: QuizItem = { id: "q1", studySetId: "s1", index: 2, title: "  Đọc hiểu  ", description: "mô tả", skill: "READING", difficulty: "HARD", durationMinutes: 15, passingScore: 70, shuffleQuestions: true, audioFileId: "", passageText: "我是学生。" };

describe("quiz-item — form bài tập", () => {
  it("validate: thiếu tiêu đề; thiếu kỹ năng; thời gian âm/lẻ; điểm đạt ngoài 0–100; hợp lệ => null", () => {
    const base = { ...emptyQuizInput(), title: "A", skill: "READING" };
    expect(validateQuizInput({ ...base, title: "  " })).toBe("Vui lòng nhập tiêu đề bài tập");
    expect(validateQuizInput({ ...base, skill: "" })).toBe("Vui lòng chọn kỹ năng của bài tập");
    expect(validateQuizInput({ ...base, skill: undefined })).toBe("Vui lòng chọn kỹ năng của bài tập");
    expect(validateQuizInput({ ...base, durationMinutes: -1 })).toMatch(/số phút nguyên không âm/);
    expect(validateQuizInput({ ...base, durationMinutes: 1.5 })).toMatch(/số phút nguyên/);
    expect(validateQuizInput({ ...base, passingScore: 101 })).toMatch(/0–100/);
    expect(validateQuizInput({ ...base, durationMinutes: undefined, passingScore: undefined })).toBeNull();
  });

  it("cảnh báo kỹ năng: Nghe thiếu audio (ở bài tập lẫn câu hỏi); Nói thiếu câu Ghi âm; kỹ năng khác hoặc đã đủ => không cảnh báo", () => {
    const mc = { type: "MULTIPLE_CHOICE" };
    expect(quizSkillWarnings({ skill: "LISTENING" }, [mc])).toEqual(["Bài Nghe chưa có audio: thêm audio bài nghe cho bài tập hoặc cho câu hỏi."]);
    expect(quizSkillWarnings({ skill: "LISTENING", audioFileId: "f1" }, [mc])).toEqual([]);
    expect(quizSkillWarnings({ skill: "LISTENING" }, [{ ...mc, audioFileId: "f2" }])).toEqual([]);
    expect(quizSkillWarnings({ skill: "SPEAKING" }, [mc])).toEqual(["Bài Nói chưa có câu hỏi Ghi âm nào."]);
    expect(quizSkillWarnings({ skill: "SPEAKING" }, [mc, { type: "AUDIO_RESPONSE" }])).toEqual([]);
    expect(quizSkillWarnings({ skill: "READING" }, [mc])).toEqual([]);
    expect(quizSkillWarnings({ skill: undefined }, [])).toEqual([]);
  });

  it("normalize: cắt khoảng trắng, bỏ trường rỗng, 0 phút => không gửi (không giới hạn), điểm đạt mặc định 80", () => {
    const body = normalizeQuizInput({ ...emptyQuizInput(), title: " HSK 1 ", description: "  ", skill: "", durationMinutes: 0, passingScore: undefined, passageText: " 你好 " });
    expect(body).toMatchObject({ title: "HSK 1", description: undefined, skill: undefined, durationMinutes: undefined, passingScore: DEFAULT_PASSING_SCORE, passageText: "你好", difficulty: "MEDIUM", shuffleQuestions: false });
    expect(normalizeQuizInput({ ...emptyQuizInput(), title: "A", durationMinutes: 12.7 }).durationMinutes).toBe(12);
  });

  it("quizToInput đọc lại từ máy chủ (tệp rỗng => undefined, index giữ) và normalize giữ nguyên trường có giá trị", () => {
    const input = quizToInput(quiz);
    expect(input).toMatchObject({ title: "  Đọc hiểu  ", skill: "READING", difficulty: "HARD", durationMinutes: 15, passingScore: 70, shuffleQuestions: true, audioFileId: undefined, passageText: "我是学生。", index: 2 });
    expect(normalizeQuizInput(input)).toMatchObject({ title: "Đọc hiểu", skill: "READING", durationMinutes: 15, passingScore: 70, index: 2 });
  });

  it("8 kỹ năng của bản cũ đúng thứ tự; nhãn kỹ năng/độ khó có dự phòng", () => {
    expect(QUIZ_SKILLS.map((s) => s.value)).toEqual(["PRACTICE", "LISTENING", "READING", "WRITING", "SPEAKING", "PHONETICS", "TRANSLATION", "GRAMMAR_3_0"]);
    expect(quizSkillLabel("GRAMMAR_3_0")).toBe("Ngữ pháp 3.0");
    expect(quizSkillLabel("LẠ")).toBe("LẠ");
    expect(quizSkillLabel(undefined)).toBe("—");
    expect(quizDifficultyMeta("EASY")).toMatchObject({ label: "Dễ", className: "easy" });
    expect(quizDifficultyMeta(undefined).className).toBe("medium");
  });
});

describe("quiz-question — bảng loại và tiện ích", () => {
  it("7 loại; SENTENCE_BUILDER không hỗ trợ soạn; loại lạ có meta dự phòng không hỗ trợ", () => {
    expect(QUIZ_QUESTION_TYPES.map((t) => t.value)).toEqual(["MULTIPLE_CHOICE", "TRUE_FALSE", "FILL_IN_BLANK", "MATCHING_PAIRS", "SHORT_ANSWER", "AUDIO_RESPONSE", "SENTENCE_BUILDER"]);
    expect(questionTypeMeta("SENTENCE_BUILDER").supported).toBe(false);
    expect(questionTypeMeta("MULTIPLE_CHOICE")).toMatchObject({ label: "Trắc nghiệm", badgeClass: "mc", supported: true });
    expect(questionTypeMeta("ESSAY")).toMatchObject({ label: "ESSAY", supported: false });
  });

  it("countBlanks nhận {blank} và ___ (chuẩn về {blank}); parseAcceptable tách phẩy, bỏ rỗng và trùng", () => {
    expect(countBlanks("我{blank}学生，他___老师。")).toBe(2);
    expect(countBlanks("không có")).toBe(0);
    expect(parseAcceptable(" a, b ,, a ,c")).toEqual(["a", "b", "c"]);
    expect(parseAcceptable("")).toEqual([]);
  });

  it("emptyQuestionInput: 4 lựa chọn trống, 1 chỗ trống, 2 lựa chọn điền, 2 cặp, 10 điểm, TB", () => {
    const v = emptyQuestionInput();
    expect(v).toMatchObject({ type: "MULTIPLE_CHOICE", points: DEFAULT_QUESTION_POINTS, difficulty: "MEDIUM", fillBlankMode: "TYPE", correctAnswer: null });
    expect(v.options).toHaveLength(4);
    expect(v.blanks).toHaveLength(1);
    expect(v.choices).toHaveLength(2);
    expect(v.pairs).toHaveLength(2);
    expect(emptyQuestionInput("TRUE_FALSE").type).toBe("TRUE_FALSE");
  });
});

describe("quiz-question — kiểm tra theo loại (thông điệp bản cũ) và chuẩn hoá", () => {
  it("điểm <= 0 => lỗi; SENTENCE_BUILDER => chưa hỗ trợ", () => {
    expect(validateQuestionInput({ ...emptyQuestionInput(), prompt: "x", points: 0 })).toBe("Điểm của câu hỏi phải lớn hơn 0.");
    expect(validateQuestionInput({ ...emptyQuestionInput("SENTENCE_BUILDER"), prompt: "x" })).toMatch(/chưa được hỗ trợ/);
  });

  it("MULTIPLE_CHOICE: thiếu nội dung; <2 lựa chọn; số đáp án đúng != 1; hợp lệ => options gọn, không gửi trường loại khác", () => {
    const base = emptyQuestionInput();
    expect(validateQuestionInput(base)).toBe("Vui lòng nhập nội dung câu hỏi.");
    expect(validateQuestionInput({ ...base, prompt: "?", options: [{ text: "a", isCorrect: true }, { text: " ", isCorrect: false }] })).toBe("Trắc nghiệm cần ít nhất 2 lựa chọn.");
    expect(validateQuestionInput({ ...base, prompt: "?", options: [{ text: "a", isCorrect: false }, { text: "b", isCorrect: false }] })).toBe("Trắc nghiệm chỉ được có 1 đáp án đúng.");
    const valid = { ...base, prompt: " 你好 nghĩa là? ", explanation: " vì ", options: [{ text: " Xin chào ", isCorrect: true }, { text: "Cảm ơn", isCorrect: false }, { text: "", isCorrect: false }] };
    expect(validateQuestionInput(valid)).toBeNull();
    const body = normalizeQuestionInput(valid);
    expect(body).toEqual({ type: "MULTIPLE_CHOICE", prompt: "你好 nghĩa là?", points: 10, difficulty: "MEDIUM", explanation: "vì", imageFileId: undefined, audioFileId: undefined, index: undefined, options: [{ text: "Xin chào", isCorrect: true }, { text: "Cảm ơn", isCorrect: false }] });
    expect("blanks" in body || "pairs" in body || "correctAnswer" in body).toBe(false);
  });

  it("TRUE_FALSE: thiếu mệnh đề; thiếu đáp án; hợp lệ => correctAnswer boolean", () => {
    const base = emptyQuestionInput("TRUE_FALSE");
    expect(validateQuestionInput(base)).toBe("Vui lòng nhập mệnh đề Đúng/Sai.");
    expect(validateQuestionInput({ ...base, prompt: "再见 = xin chào" })).toBe("Vui lòng chọn đáp án Đúng hoặc Sai.");
    expect(validateQuestionInput({ ...base, prompt: "x", correctAnswer: false })).toBeNull();
    expect(normalizeQuestionInput({ ...base, prompt: "x", correctAnswer: false })).toMatchObject({ type: "TRUE_FALSE", correctAnswer: false });
    expect(normalizeQuestionInput({ ...base, prompt: "x", correctAnswer: false }).options).toBeUndefined();
  });

  it("FILL_IN_BLANK: thiếu câu mẫu; không có chỗ trống; lệch số đáp án; SELECT thiếu lựa chọn; hợp lệ => blanks có index + acceptable, choices chỉ khi SELECT, ___ => {blank}", () => {
    const base = emptyQuestionInput("FILL_IN_BLANK");
    expect(validateQuestionInput(base)).toBe("Vui lòng nhập câu mẫu.");
    expect(validateQuestionInput({ ...base, prompt: "không có chỗ trống" })).toMatch(/ít nhất 1 chỗ trống/);
    expect(validateQuestionInput({ ...base, prompt: "我{blank}学生，他___老师。", blanks: [{ answer: "是", acceptable: "" }] })).toBe("Số lượng chỗ trống trong câu mẫu (2) không khớp với số lượng đáp án bạn đã nhập (1).");
    const two = { ...base, prompt: "我{blank}学生，他___老师。", blanks: [{ answer: " 是 ", acceptable: "系, 为" }, { answer: "是", acceptable: "" }] };
    expect(validateQuestionInput(two)).toBeNull();
    expect(validateQuestionInput({ ...two, fillBlankMode: "SELECT" as const, choices: ["是", ""] })).toBe("Chế độ chọn đáp án cần ít nhất 2 lựa chọn.");
    expect(normalizeQuestionInput(two)).toMatchObject({ type: "FILL_IN_BLANK", prompt: "我{blank}学生，他{blank}老师。", fillBlankMode: "TYPE", blanks: [{ index: 0, answer: "是", acceptable: ["系", "为"] }, { index: 1, answer: "是", acceptable: [] }] });
    expect(normalizeQuestionInput(two).choices).toBeUndefined();
    expect(normalizeQuestionInput({ ...two, fillBlankMode: "SELECT", choices: [" 是", "有", ""] }).choices).toEqual(["是", "有"]);
  });

  it("MATCHING_PAIRS: <2 cặp đủ hai vế; hợp lệ => pairs gọn (nội dung câu hỏi không bắt buộc)", () => {
    const base = emptyQuestionInput("MATCHING_PAIRS");
    expect(validateQuestionInput({ ...base, pairs: [{ left: "a", right: "b" }, { left: "c", right: "" }] })).toBe("Câu hỏi nối cặp cần ít nhất 2 cặp vế.");
    const valid = { ...base, pairs: [{ left: " 老师 ", right: "giáo viên" }, { left: "学生", right: " học sinh " }, { left: "", right: "" }] };
    expect(validateQuestionInput(valid)).toBeNull();
    expect(normalizeQuestionInput(valid).pairs).toEqual([{ left: "老师", right: "giáo viên" }, { left: "学生", right: "học sinh" }]);
  });

  it("SHORT_ANSWER / AUDIO_RESPONSE: đề bài bắt buộc; chấm tay (MANUAL); đáp án tham khảo chỉ cho tự luận", () => {
    expect(validateQuestionInput(emptyQuestionInput("SHORT_ANSWER"))).toBe("Vui lòng nhập đề bài tự luận.");
    expect(validateQuestionInput(emptyQuestionInput("AUDIO_RESPONSE"))).toBe("Vui lòng nhập đề bài ghi âm.");
    expect(normalizeQuestionInput({ ...emptyQuestionInput("SHORT_ANSWER"), prompt: "Viết 3 câu", referenceAnswer: " mẫu " })).toMatchObject({ gradingMode: "MANUAL", referenceAnswer: "mẫu" });
    const audio = normalizeQuestionInput({ ...emptyQuestionInput("AUDIO_RESPONSE"), prompt: "Đọc to", referenceAnswer: "bỏ" });
    expect(audio).toMatchObject({ gradingMode: "MANUAL" });
    expect(audio.referenceAnswer).toBeUndefined();
  });

  it("questionToInput đọc lại câu hỏi từ máy chủ: blanks sắp theo index và acceptable nối bằng ', ', options/pairs giữ, thiếu => mặc định", () => {
    const q: QuizQuestion = { id: "x", quizId: "q1", index: 3, type: "FILL_IN_BLANK", prompt: "我{blank}{blank}", points: 7, fillBlankMode: "SELECT", blanks: [{ index: 1, answer: "b", acceptable: ["B", "β"] }, { index: 0, answer: "a" }], choices: ["a", "b"] };
    const input = questionToInput(q);
    expect(input).toMatchObject({ type: "FILL_IN_BLANK", prompt: "我{blank}{blank}", points: 7, difficulty: "MEDIUM", fillBlankMode: "SELECT", choices: ["a", "b"], index: 3 });
    expect(input.blanks).toEqual([{ answer: "a", acceptable: "" }, { answer: "b", acceptable: "B, β" }]);
    expect(input.options).toHaveLength(4);
    const mc = questionToInput({ id: "y", quizId: "q1", index: 0, type: "MULTIPLE_CHOICE", prompt: "?", points: 0, options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: false }] });
    expect(mc.points).toBe(DEFAULT_QUESTION_POINTS);
    expect(mc.options).toEqual([{ text: "a", isCorrect: true }, { text: "b", isCorrect: false }]);
    expect(questionToInput({ id: "z", quizId: "q1", index: 0, type: "TRUE_FALSE", prompt: "p", points: 5, correctAnswer: false }).correctAnswer).toBe(false);
  });

  it("questionSummary cắt 60 ký tự, rỗng => tên loại; sortQuestions theo index không đổi mảng gốc", () => {
    expect(questionSummary({ type: "MULTIPLE_CHOICE", prompt: "a".repeat(80) })).toHaveLength(58);
    expect(questionSummary({ type: "AUDIO_RESPONSE", prompt: "  " })).toBe("(Ghi âm)");
    const list = [{ index: 2 }, { index: 0 }, { index: 1 }];
    expect(sortQuestions(list).map((q) => q.index)).toEqual([0, 1, 2]);
    expect(list[0].index).toBe(2);
  });
});
