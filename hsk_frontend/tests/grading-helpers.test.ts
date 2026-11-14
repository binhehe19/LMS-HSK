import { describe, expect, it } from "vitest";
import {
  areAllQuestionsReturned,
  computeAttemptScoreFromQuestions,
  computePartialAutoScore,
  formatScore,
  getDefaultQuestionScore,
  getProgressToneColors,
  isQuestionReadyToSend,
  isQuestionReturnedToStudent,
  sanitizeScoreInput,
  scoreToneClass,
  summarizeGradingQuestions,
} from "@/lib/grading/grading-helpers";

describe("formatScore / scoreToneClass / getProgressToneColors (nguyên nghĩa class-management.helpers.ts)", () => {
  it("formatScore: null/undefined => '-', số nguyên giữ nguyên, số lẻ 2 chữ số", () => {
    expect(formatScore(null)).toBe("-");
    expect(formatScore(undefined)).toBe("-");
    expect(formatScore(7)).toBe("7");
    expect(formatScore(7.5)).toBe("7.50");
    expect(formatScore(0)).toBe("0");
  });

  it("scoreToneClass: theo tỷ lệ trên thang 100 (<60 low, <85 mid, còn lại high); thiếu/không hữu hạn => muted", () => {
    expect(scoreToneClass(5, 10)).toBe("cm-score-tone--low");
    expect(scoreToneClass(7, 10)).toBe("cm-score-tone--mid");
    expect(scoreToneClass(9, 10)).toBe("cm-score-tone--high");
    expect(scoreToneClass(59)).toBe("cm-score-tone--low"); // không có maxScore => coi điểm là %
    expect(scoreToneClass(null, 10)).toBe("cm-score-tone--muted");
    expect(scoreToneClass(Number.NaN, 10)).toBe("cm-score-tone--muted");
    expect(scoreToneClass(3, 0)).toBe("cm-score-tone--low"); // maxScore 0 => dùng điểm thô
  });

  it("getProgressToneColors: chưa nộp hoặc 0% => xám; ngưỡng 60/85", () => {
    expect(getProgressToneColors(80, false)).toEqual({ stroke: "#e5e7eb", text: "#9ca3af" });
    expect(getProgressToneColors(0)).toEqual({ stroke: "#e5e7eb", text: "#9ca3af" });
    expect(getProgressToneColors(40)).toEqual({ stroke: "#ef4444", text: "#dc2626" });
    expect(getProgressToneColors(70)).toEqual({ stroke: "#f59e0b", text: "#d97706" });
    expect(getProgressToneColors(100)).toEqual({ stroke: "#22c55e", text: "#16a34a" });
  });
});

describe("sanitizeScoreInput", () => {
  it.each([
    ["abc1.5e3", "1.53"],
    ["1.2.3", "1.23"],
    ["-4", "4"],
    ["  7 ", "7"],
    ["", ""],
    ["..", "."],
  ])("%j => %j", (raw, expected) => {
    expect(sanitizeScoreInput(raw)).toBe(expected);
  });
});

describe("computePartialAutoScore / getDefaultQuestionScore", () => {
  const matching = {
    questionType: "MATCHING_PAIRS",
    maxScore: 10,
    matchingPairs: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
    studentAnswer: { pairMatches: [{ promptId: "p1", answerId: "p1" }, { promptId: "p2", answerId: "p3" }, { promptId: "p3", answerId: "p3" }] },
  };
  const blanks = { questionType: "FILL_IN_BLANK", maxScore: 6, blanks: [{ index: 0, correctAnswer: "六点" }, { index: 1, correctAnswer: "公园" }], studentAnswer: [{ blankIndex: 0, answer: " 六点 " }, { blankIndex: 1, answer: "不知道" }] };

  it("nối cặp: 2/3 cặp đúng trên 10 điểm => 7 (làm tròn); điền khuyết: 1/2 ô đúng (bỏ khoảng trắng, không phân biệt hoa/thường) => 3", () => {
    expect(computePartialAutoScore(matching)).toBe(7);
    expect(computePartialAutoScore(blanks)).toBe(3);
    expect(computePartialAutoScore({ questionType: "SHORT_ANSWER", maxScore: 5 })).toBeNull();
  });

  it("điền khuyết dạng bọc { blankAnswers } vẫn tính đúng (lỗi đã gặp ở HSK cũ)", () => {
    expect(computePartialAutoScore({ ...blanks, studentAnswer: [{ blankIndex: 0, answer: "六点" }, { blankIndex: 1, answer: "公园" }] })).toBe(6);
  });

  it("điểm mặc định: GV đã lưu > đúng/sai máy chấm > từng phần > autoScore > '0' khi máy chấm sai > rỗng khi chấm tay", () => {
    expect(getDefaultQuestionScore({ teacherScore: 2.5, isCorrect: true, maxScore: 5 })).toBe("2.5");
    expect(getDefaultQuestionScore({ isCorrect: true, maxScore: 5 })).toBe("5");
    expect(getDefaultQuestionScore({ ...matching, isCorrect: false })).toBe("7");
    expect(getDefaultQuestionScore({ isCorrect: false, autoScore: 1, maxScore: 5 })).toBe("1");
    expect(getDefaultQuestionScore({ isCorrect: false, maxScore: 5 })).toBe("0");
    expect(getDefaultQuestionScore({ isCorrect: null, maxScore: 5 })).toBe("");
  });

  it("computeAttemptScoreFromQuestions cộng điểm từng câu theo điểm mặc định", () => {
    expect(computeAttemptScoreFromQuestions([{ teacherScore: 4, maxScore: 5 }, { isCorrect: true, maxScore: 1 }, { isCorrect: null, maxScore: 5 }, matching])).toBe(12);
    expect(computeAttemptScoreFromQuestions()).toBe(0);
  });
});

describe("summarizeGradingQuestions", () => {
  it("chỉ câu có điểm (GV/máy) mới là đã chấm; đạt tối đa khi teacherScore >= maxScore hoặc isCorrect; điểm chỉ cộng câu đã chấm", () => {
    const summary = summarizeGradingQuestions([
      { teacherScore: 5, maxScore: 5 }, // đã chấm, tối đa
      { teacherScore: 3, maxScore: 5 }, // đã chấm, chưa tối đa
      { isCorrect: true, maxScore: 1 }, // máy chấm đúng
      { isCorrect: false, autoScore: 0, maxScore: 1 }, // máy chấm sai
      { isCorrect: null, maxScore: 5 }, // chưa chấm
      { autoScore: 2, maxScore: 2 }, // autoScore đạt tối đa, không có isCorrect
      { teacherScore: 1, maxScore: 0 }, // maxScore 0 => không tính là tối đa, nhưng điểm GV vẫn được cộng (như HSK cũ)
    ]);
    expect(summary).toEqual({ total: 7, graded: 6, correct: 3, score: 12 });
  });
});

describe("isQuestionReturnedToStudent / areAllQuestionsReturned / isQuestionReadyToSend", () => {
  it("returnedAt => đã gửi; bài có theo dõi từng câu => chỉ câu có returnedAt bị khoá", () => {
    const all = [{ returnedAt: "2026-10-01T00:00:00Z" }, { returnedAt: null }];
    expect(isQuestionReturnedToStudent({ returnedAt: "2026-10-01T00:00:00Z" })).toBe(true);
    expect(isQuestionReturnedToStudent({ returnedAt: null, teacherScore: 3 }, { status: "returned" }, all)).toBe(false);
  });

  it("legacy (không có returnedAt): chỉ khoá khi module RETURNED, có danh sách câu VÀ câu đã có điểm (câu mới tách chưa chấm vẫn sửa được)", () => {
    const legacy = [{ returnedAt: null }, { returnedAt: null }];
    expect(isQuestionReturnedToStudent({ teacherScore: 3 }, { status: "returned" }, legacy)).toBe(true);
    expect(isQuestionReturnedToStudent({ autoScore: 1 }, { status: "RETURNED" }, legacy)).toBe(true);
    expect(isQuestionReturnedToStudent({}, { status: "returned" }, legacy)).toBe(false);
    expect(isQuestionReturnedToStudent({ teacherScore: 3 }, { status: "graded" }, legacy)).toBe(false);
    expect(isQuestionReturnedToStudent({ teacherScore: 3 }, { status: "returned" }, [])).toBe(false);
  });

  it("areAllQuestionsReturned: rỗng => false; mọi câu có returnedAt => true", () => {
    expect(areAllQuestionsReturned([])).toBe(false);
    expect(areAllQuestionsReturned([{ returnedAt: "x" }, { returnedAt: "y" }])).toBe(true);
    expect(areAllQuestionsReturned([{ returnedAt: "x" }, { returnedAt: null }])).toBe(false);
  });

  it("isQuestionReadyToSend: đã gửi => false; có điểm GV / bản nháp khác rỗng / máy chấm => true; còn lại false", () => {
    expect(isQuestionReadyToSend({ returnedAt: "x", teacherScore: 5 })).toBe(false);
    expect(isQuestionReadyToSend({ teacherScore: 0 })).toBe(true);
    expect(isQuestionReadyToSend({}, { score: "3" })).toBe(true);
    expect(isQuestionReadyToSend({}, { score: "" })).toBe(false);
    expect(isQuestionReadyToSend({ isCorrect: false, autoScore: 0 })).toBe(true);
    expect(isQuestionReadyToSend({ isCorrect: null, autoScore: null })).toBe(false);
  });
});
