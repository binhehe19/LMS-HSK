import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttemptGradingPanel } from "@/components/management/instructor-grading/attempt-grading-panel";
import { LessonAttemptResult } from "@/components/student/timetable/lesson-attempt-result";
import { answerLines } from "@/lib/assessment/answer-parts";

const hooks = vi.hoisted(() => ({ result: vi.fn() }));
vi.mock("@/components/student/timetable/use-assessment-attempt-result", () => ({ useAssessmentAttemptResult: hooks.result }));
const grading = vi.hoisted(() => ({ getGradingDetail: vi.fn(), acquireGradingLock: vi.fn(), releaseGradingLock: vi.fn(), saveGrading: vi.fn() }));
vi.mock("@/lib/api/assessment-grading-client", () => grading);
vi.mock("@/lib/api/storage-client", () => ({ fileUrl: () => null }));

const matching = {
  questionType: "MATCHING",
  questionText: "Nối",
  options: [{ optionIndex: 0, content: "a" }, { optionIndex: 1, content: "b" }],
  matchingPairs: [{ pairIndex: 0, prompt: "1", answer: "a" }, { pairIndex: 2, prompt: "2", answer: "b" }],
};
const matchingAnswer = '{"matchingAnswers":{"0":"a"}}';
const parts = [{ index: 0, correct: true }, { index: 2, correct: false }];

describe("answerLines — dấu đúng/sai từng dòng theo parts của backend", () => {
  it("câu nối: mỗi dòng một dấu, theo pairIndex của backend; dòng bỏ trống hiện '(bỏ trống)' và sai", () => {
    expect(answerLines(matching, matchingAnswer, parts)).toEqual([{ text: "1 → a", correct: true }, { text: "2 → (bỏ trống)", correct: false }]);
  });

  it("câu điền: theo blankIndex", () => {
    const fill = { questionType: "FILL_IN_BLANK", questionText: "{{1}} {{2}}", blanks: [{ blankIndex: 0 }, { blankIndex: 1 }] };
    expect(answerLines(fill, '{"blankAnswers":{"0":"đi","1":"sai"}}', [{ index: 0, correct: true }, { index: 1, correct: false }])).toEqual([
      { text: "1. đi", correct: true },
      { text: "2. sai", correct: false },
    ]);
  });

  it("không có parts (câu chưa có điểm hoặc loại khác): chỉ các dòng đã trả lời, không dấu", () => {
    expect(answerLines(matching, matchingAnswer, null)).toEqual([{ text: "1 → a" }]);
    expect(answerLines(matching, matchingAnswer, [])).toEqual([{ text: "1 → a" }]);
    expect(answerLines({ questionType: "ESSAY", questionText: "x" }, '{"text":"bài"}', parts)).toEqual([{ text: "bài" }]);
    expect(answerLines(matching, null, parts)).toEqual([]);
  });
});

describe("màn kết quả của học viên", () => {
  it("hiện ✓/✗ cho từng dòng câu nối khi backend trả parts", () => {
    hooks.result.mockReturnValue({
      loading: false,
      error: null,
      result: {
        attemptId: "a1", attemptStatus: "SUBMITTED", gradingStatus: "GRADED", earnedPoints: 1, totalPoints: 2, percent: 50, submittedAt: null, progress: { gradedQuestions: 1, totalQuestions: 1 }, nextPollMs: null,
        questions: [{ answerId: "x", questionId: "q1", displayOrder: 1, question: matching, answerJson: matchingAnswer, gradingStatus: "AUTO_GRADED", earnedPoints: 1, maxPoints: 2, graderComment: null, parts }],
      },
    });
    render(<LessonAttemptResult attemptId="a1" />);
    expect(screen.getByLabelText("Đúng").parentElement).toHaveTextContent("1 → a");
    expect(screen.getByLabelText("Sai").parentElement).toHaveTextContent("2 → (bỏ trống)");
  });
});

describe("màn chấm bài", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grading.acquireGradingLock.mockResolvedValue({ acquired: true, holderUserId: null, lockExpiresAt: null, serverNow: "", endsAt: null });
    grading.releaseGradingLock.mockResolvedValue({});
  });

  it("hiện ✓/✗ từng dòng theo parts của chi tiết chấm", async () => {
    grading.getGradingDetail.mockResolvedValue({
      attemptId: "a1", studentId: "s", sessionId: null, sessionNo: null, status: "SUBMITTED", gradingStatus: "GRADED", earnedPoints: 1, totalPoints: 2, submittedAt: null,
      subType: "QUIZ", contextType: "CLASS_SESSION", title: "Bài", layout: null, studentName: null, studentEmail: null, studentCode: null,
      answers: [{ answerId: "x", questionId: "q1", displayOrder: 1, question: matching, answerJson: matchingAnswer, gradingStatus: "AUTO_GRADED", earnedPoints: 1, maxPoints: 2, graderComment: null, graderId: null, scoreSource: "AUTO", provisional: false, rubricScores: null, parts }],
    });
    render(<AttemptGradingPanel attemptId="a1" title="Bài" />);
    await waitFor(() => expect(screen.getByLabelText("Sai")).toBeInTheDocument());
    expect(screen.getByLabelText("Đúng").parentElement).toHaveTextContent("1 → a");
    expect(screen.getByLabelText("Sai").parentElement).toHaveTextContent("2 → (bỏ trống)");
  });
});
