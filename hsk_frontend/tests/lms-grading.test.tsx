import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttemptGradingPanel } from "@/components/management/instructor-grading/attempt-grading-panel";
import { attemptsToStudents, sessionToSchedule } from "@/lib/grading/lms-grading-adapter";
import { listClassAttempts, listLmsScheduleStudents, listLmsStudentAttempts } from "@/lib/api/lms-grading-source";
import type { GradingDetail, GradingListItem } from "@/lib/api/assessment-grading-client";

const grading = vi.hoisted(() => ({
  listGradingAttempts: vi.fn(),
  getGradingDetail: vi.fn(),
  acquireGradingLock: vi.fn(),
  releaseGradingLock: vi.fn(),
  saveGrading: vi.fn(),
}));
vi.mock("@/lib/api/assessment-grading-client", () => grading);
vi.mock("@/lib/api/lms-class-client", () => ({ listClassSessions: vi.fn() }));
vi.mock("@/lib/api/storage-client", () => ({ fileUrl: (id?: string) => (id ? `/api/storage/file/${id}` : null) }));

const item = (over: Partial<GradingListItem>): GradingListItem => ({
  attemptId: "a1", studentId: "s1", sessionId: "ses1", sessionNo: 1, contentPackageVersionId: "v", status: "SUBMITTED", gradingStatus: "GRADED",
  earnedPoints: 8, totalPoints: 10, submittedAt: null, hasProvisionalScore: false, assessmentType: "QUIZ", contextType: "CLASS_SESSION",
  title: "Bài 1", studentName: "An", studentEmail: "an@x.vn", studentCode: "HS1", ...over,
});

describe("lms-grading-adapter", () => {
  it("buổi học của lớp: id buổi là khoá buổi, ngày giờ lấy từ startAt/endAt", () => {
    const s = sessionToSchedule({ id: "ses1", sessionNo: 3, startAt: "2026-11-20T08:30:00", endAt: "2026-11-20T10:00:00", note: "Ngữ pháp" });
    expect(s).toMatchObject({ sessionId: "ses1", sessionNo: 3, topic: "Ngữ pháp", date: "2026-11-20", startTime: "08:30", endTime: "10:00" });
  });

  it("gom bài làm theo học viên: điểm chỉ tính bài đã nộp, bài chưa chấm xong là chờ chấm, đã chấm là đã trả", () => {
    const students = attemptsToStudents([
      item({ attemptId: "a1", earnedPoints: 8, totalPoints: 10 }),
      item({ attemptId: "a2", gradingStatus: "MANUAL_GRADING", earnedPoints: 2, totalPoints: 10 }),
      item({ attemptId: "a3", status: "IN_PROGRESS", gradingStatus: "NOT_SUBMITTED", earnedPoints: null, totalPoints: 10 }),
      item({ attemptId: "b1", studentId: "s2", studentName: "Bình" }),
    ]);
    expect(students).toHaveLength(2);
    const an = students.find((s) => s.userId === "s1")!;
    expect(an).toMatchObject({ name: "An", studentCode: "HS1", submittedAny: true, totalScore: 10, completionRate: 50, ungradedCount: 1 });
    expect(an.modules!.map((m) => [m.attemptId, m.submitted, m.status])).toEqual([["a1", true, "RETURNED"], ["a2", true, "SUBMITTED"], ["a3", false, "SUBMITTED"]]);
  });
});

describe("lms-grading-source", () => {
  beforeEach(() => vi.clearAllMocks());

  it("duyệt hết các trang bài làm của lớp", async () => {
    grading.listGradingAttempts
      .mockResolvedValueOnce({ items: [item({ attemptId: "a1" })], page: 0, size: 100, totalElements: 2, totalPages: 2 })
      .mockResolvedValueOnce({ items: [item({ attemptId: "a2" })], page: 1, size: 100, totalElements: 2, totalPages: 2 });
    expect((await listClassAttempts("c1")).map((a) => a.attemptId)).toEqual(["a1", "a2"]);
    expect(grading.listGradingAttempts).toHaveBeenCalledWith(expect.objectContaining({ classId: "c1", allStatuses: true, contextType: "CLASS_SESSION", page: 1 }));
  });

  it("quá nhiều bài làm thì báo lỗi, không im lặng cắt bớt", async () => {
    grading.listGradingAttempts.mockResolvedValue({ items: [item({})], page: 0, size: 100, totalElements: 9999, totalPages: 999 });
    await expect(listClassAttempts("c1")).rejects.toThrow(/quá nhiều bài làm/);
  });

  it("lọc theo buổi và học viên", async () => {
    grading.listGradingAttempts.mockResolvedValue({
      items: [item({ attemptId: "a1" }), item({ attemptId: "a2", sessionId: "ses2" }), item({ attemptId: "a3", studentId: "s2" })],
      page: 0, size: 100, totalElements: 3, totalPages: 1,
    });
    expect((await listLmsScheduleStudents("c1", "ses1")).map((s) => s.userId).sort()).toEqual(["s1", "s2"]);
    expect((await listLmsStudentAttempts("c1", "ses1", "s1")).map((a) => a.attemptId)).toEqual(["a1"]);
  });
});

const detail = (over: Partial<GradingDetail> = {}): GradingDetail => ({
  attemptId: "a1", studentId: "s1", sessionId: "ses1", sessionNo: 1, status: "SUBMITTED", gradingStatus: "MANUAL_GRADING", earnedPoints: 1, totalPoints: 11,
  submittedAt: null, assessmentType: "QUIZ", contextType: "CLASS_SESSION", title: "Bài 1", layout: null, studentName: "An", studentEmail: null, studentCode: null,
  answers: [
    { answerId: "x1", questionId: "q1", displayOrder: 1, question: { questionType: "MULTIPLE_CHOICE", questionText: "<p>Chọn</p>", options: [{ optionIndex: 0, content: "A1", correct: true }] }, answerJson: '{"selectedOptionIndex":0}', gradingStatus: "AUTO_GRADED", earnedPoints: 1, maxPoints: 1, graderComment: null, graderId: null, scoreSource: "AUTO", provisional: false, rubricScores: null },
    { answerId: "x2", questionId: "q2", displayOrder: 2, question: { questionType: "ESSAY", questionText: "Viết" }, answerJson: '{"text":"bài của em"}', gradingStatus: "MANUAL_PENDING", earnedPoints: null, maxPoints: 10, graderComment: null, graderId: null, scoreSource: null, provisional: false, rubricScores: null },
  ],
  ...over,
});

describe("AttemptGradingPanel — chấm một bài trên backend chung", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grading.getGradingDetail.mockResolvedValue(detail());
    grading.acquireGradingLock.mockResolvedValue({ acquired: true, holderUserId: null, lockExpiresAt: null, serverNow: "", endsAt: null });
    grading.releaseGradingLock.mockResolvedValue({});
    grading.saveGrading.mockImplementation(async () => detail({ earnedPoints: 8, gradingStatus: "GRADED" }));
  });

  it("giữ khoá, hiện bài làm; nhập điểm + nhận xét rồi lưu gửi đúng answerId, điểm và khoá chấm", async () => {
    render(<AttemptGradingPanel attemptId="a1" title="Bài 1" />);
    expect(await screen.findByText(/bài của em/)).toBeInTheDocument();
    await waitFor(() => expect(grading.acquireGradingLock).toHaveBeenCalledWith("a1", expect.any(String)));
    const points = screen.getByLabelText(/Điểm \(tối đa 10\)/);
    await waitFor(() => expect(points).not.toBeDisabled());
    fireEvent.change(points, { target: { value: "7" } });
    fireEvent.change(screen.getAllByLabelText("Nhận xét")[1], { target: { value: "Tốt" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu điểm" }));
    await waitFor(() => expect(grading.saveGrading).toHaveBeenCalledTimes(1));
    const [id, token, items] = grading.saveGrading.mock.calls[0];
    expect(id).toBe("a1");
    expect(token).toEqual(grading.acquireGradingLock.mock.calls[0][1]);
    expect(items).toEqual([{ answerId: "x2", earnedPoints: 7, graderComment: "Tốt" }]);
  });

  it("điểm vượt tối đa: báo lỗi, không gọi lưu", async () => {
    render(<AttemptGradingPanel attemptId="a1" title="Bài 1" />);
    const points = await screen.findByLabelText(/Điểm \(tối đa 10\)/);
    await waitFor(() => expect(points).not.toBeDisabled());
    fireEvent.change(points, { target: { value: "11" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu điểm" }));
    await new Promise((r) => setTimeout(r, 30));
    expect(grading.saveGrading).not.toHaveBeenCalled();
  });

  it("người khác đang chấm: ô điểm bị khoá, có nút Chấm thay", async () => {
    grading.acquireGradingLock.mockResolvedValue({ acquired: false, holderUserId: "gv-khac", lockExpiresAt: null, serverNow: "", endsAt: null });
    render(<AttemptGradingPanel attemptId="a1" title="Bài 1" />);
    expect(await screen.findByText(/đang được người khác chấm \(gv-khac\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Điểm \(tối đa 10\)/)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Chấm thay" })).toBeInTheDocument();
  });
});
