import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LessonAttemptPlayer } from "@/components/student/timetable/lesson-attempt-player";
import type { AssessmentAttemptResponse } from "@/lib/api/assessment-attempt-client";

const client = vi.hoisted(() => ({
  acquireLock: vi.fn(),
  releaseLock: vi.fn(),
  releaseLockOnUnload: vi.fn(),
  heartbeat: vi.fn(),
  submitAttempt: vi.fn(),
}));
vi.mock("@/lib/api/assessment-attempt-client", () => client);

const attempt = {
  attemptId: "a1",
  status: "IN_PROGRESS",
  remainingSeconds: null,
  savedAnswers: [{ answerId: "x", questionId: "q1", answerJson: '{"selectedOptionIndex":0}' }],
  questions: [],
} as unknown as AssessmentAttemptResponse;

const questions = [
  { questionId: "q1", questionType: "MULTIPLE_CHOICE", questionText: "Chọn", options: [{ optionIndex: 0, content: "A1" }, { optionIndex: 1, content: "B1" }] },
  { questionId: "q2", questionType: "ESSAY", questionText: "Viết" },
];

const renderPlayer = (onSubmitted = vi.fn()) => {
  render(<LessonAttemptPlayer attempt={attempt} title="Bài 1" content={{}} questions={questions} skill="reading" skillName="Đọc" onSubmitted={onSubmitted} />);
  return onSubmitted;
};

beforeEach(() => {
  vi.clearAllMocks();
  client.acquireLock.mockResolvedValue({ acquired: true, holderUserId: "u", lockExpiresAt: null, serverNow: new Date().toISOString(), endsAt: null });
  client.releaseLock.mockResolvedValue({});
  client.heartbeat.mockResolvedValue({ lockRenewed: true, savedAnswerIds: ["q2"], remainingSeconds: null, effectiveStatus: "IN_PROGRESS" });
  client.submitAttempt.mockResolvedValue({ attemptId: "a1", answersIgnored: false, submittedAt: new Date().toISOString() });
});

describe("LessonAttemptPlayer — luồng làm bài dùng chung với backend", () => {
  it("giữ khoá, hiện đáp án đã lưu, nhập đáp án rồi nộp: gửi mọi đáp án, sau đó báo đã nộp", async () => {
    const onSubmitted = renderPlayer();
    await waitFor(() => expect(client.acquireLock).toHaveBeenCalledWith("a1", expect.any(String)));
    // Câu 1: đáp án đã lưu trên server được chọn sẵn.
    await waitFor(() => expect(screen.getByRole("radio", { name: /A1/ })).toHaveAttribute("aria-checked", "true"));

    fireEvent.click(screen.getByRole("button", { name: "Câu sau ›" }));
    await waitFor(() => expect(screen.getByLabelText("Câu trả lời")).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText("Câu trả lời"), { target: { value: "bài viết" } });

    fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận nộp" }));

    await waitFor(() => expect(client.submitAttempt).toHaveBeenCalled());
    const [id, , answers] = client.submitAttempt.mock.calls[0];
    expect(id).toBe("a1");
    expect(answers).toEqual(expect.arrayContaining([{ questionId: "q1", answerJson: '{"selectedOptionIndex":0}' }, { questionId: "q2", answerJson: '{"text":"bài viết"}' }]));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
  });

  it("nộp khi còn câu chưa trả lời: hỏi lại số câu còn thiếu", async () => {
    renderPlayer();
    await waitFor(() => expect(screen.getByRole("button", { name: "Nộp bài" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
    expect(screen.getByText("Còn 1 câu chưa trả lời. Nộp bài ngay?")).toBeInTheDocument();
  });

  it("bài đang mở ở nơi khác: khoá bị từ chối, không cho nộp, có nút làm tiếp ở đây", async () => {
    client.acquireLock.mockResolvedValue({ acquired: false, holderUserId: "other", lockExpiresAt: null, serverNow: new Date().toISOString(), endsAt: null });
    renderPlayer();
    expect(await screen.findByText(/Bài đang mở ở thiết bị hoặc tab khác/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nộp bài" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Làm tiếp ở đây" })).toBeInTheDocument();
  });
});
