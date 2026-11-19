import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InstructorGradingPageContent } from "@/components/management/instructor-grading/instructor-grading-page-content";
import { ManagementShell } from "@/components/management/management-shell";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { getGradingAttempt, gradeAnswer, gradeQuestion, listStudentAttempts, sendAttempt } from "@/lib/api/quiz-grading-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { GradingAttemptDetailResponse, GradingAttemptQuestion, GradingAttemptSummaryResponse } from "@/types/grading";
import { adminUser } from "./fixtures/classes";

const nav = vi.hoisted(() => {
  let url = "/instructor/list-class/grading";
  const listeners = new Set<() => void>();
  return {
    push: [] as string[],
    set(next: string) {
      url = next;
      listeners.forEach((l) => l());
    },
    get: () => url,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
});
vi.mock("next/navigation", () => ({
  usePathname: () => nav.get().split("?")[0],
  useSearchParams: () => {
    const search = useSyncExternalStore(nav.subscribe, nav.get, nav.get);
    return new URLSearchParams(search.split("?")[1] ?? "");
  },
  useRouter: () => ({ push: (to: string) => nav.push.push(to), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/notification-client", () => ({ getUnreadCount: vi.fn(), fetchNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
vi.mock("@/lib/api/quiz-grading-client", () => ({
  listAdminGradingClasses: vi.fn(),
  listTeacherGradingClasses: vi.fn(),
  listStudentAttempts: vi.fn(),
  getGradingAttempt: vi.fn(),
  gradeAnswer: vi.fn(),
  gradeQuestion: vi.fn(),
  finalizeAttempt: vi.fn(),
  sendAttempt: vi.fn(),
  sendStudentResults: vi.fn(),
}));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const teacher = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "gv1@example.test", roles: ["ROLE_TEACHER"] };
const URL = `/instructor/list-class/grading?scheduleId=syl1&userId=hv1&classId=60&courseId=7&title=${encodeURIComponent("Buổi 1")}&view=detail&studentName=${encodeURIComponent("Nguyễn A")}`;

const mc = (over: Partial<GradingAttemptQuestion> = {}): GradingAttemptQuestion => ({
  answerId: "ans-mc",
  questionId: "q-mc",
  questionType: "MULTIPLE_CHOICE",
  questionText: "他们打算几点出发？",
  maxScore: 1,
  options: [
    { id: "A", content: "A. 七点", isCorrect: false },
    { id: "B", content: "B. 八点", isCorrect: true },
  ],
  studentAnswer: "A",
  isCorrect: false,
  autoScore: 0,
  teacherScore: null,
  teacherComment: "",
  returnedAt: null,
  ...over,
});
const essay = (over: Partial<GradingAttemptQuestion> = {}): GradingAttemptQuestion => ({
  answerId: "ans-essay",
  questionId: "q-essay",
  questionType: "ESSAY",
  questionText: "请以“我的家乡”为题写一篇短文。",
  maxScore: 5,
  studentAnswer: "我的家乡很美。",
  correctAnswer: "Bài viết tự luận, giáo viên chấm theo rubric.",
  isCorrect: null,
  autoScore: null,
  teacherScore: null,
  teacherComment: "",
  returnedAt: null,
  ...over,
});
const summary1: GradingAttemptSummaryResponse = { attemptId: "att1", quizId: "quiz1", quizTitle: "一、听力", gradingStatus: "SUBMITTED", totalPoints: 6, totalQuestions: 2, groupId: "g1", groupName: "#1 Quiz - Nghe", groupOrder: 1, quizOrder: 1 };
const detail1 = (questions: GradingAttemptQuestion[], over: Partial<GradingAttemptDetailResponse> = {}): GradingAttemptDetailResponse => ({ attemptId: "att1", userId: "hv1", quizId: "quiz1", quizTitle: "一、听力", gradingStatus: "SUBMITTED", totalPoints: 6, questions, ...over });

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.stubEnv("NEXT_PUBLIC_WRITE_QUIZ_GRADING", "");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(listStudentAttempts).mockReset();
  vi.mocked(getGradingAttempt).mockReset();
  vi.mocked(gradeAnswer).mockReset();
  vi.mocked(gradeQuestion).mockReset();
  vi.mocked(sendAttempt).mockReset();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  nav.push.length = 0;
  nav.set(URL);
});

function renderPage() {
  render(
    <Provider store={makeStore({ status: "authenticated", user: teacher })}>
      <ManagementShell area="instructor">
        <InstructorGradingPageContent />
      </ManagementShell>
    </Provider>,
  );
}

const cards = () => screen.getAllByTestId("question-card");
const stat = (label: string) => (screen.getByText(label).previousElementSibling as HTMLElement).textContent;

describe("màn chấm bài — tải và hiển thị", () => {
  it("gọi listStudentAttempts(scheduleId, userId, classId) rồi getGradingAttempt từng bài; giữ DOM: header dính, banner, nhóm module, số câu liên tục, tổng quan", async () => {
    vi.mocked(listStudentAttempts).mockResolvedValue([summary1]);
    vi.mocked(getGradingAttempt).mockResolvedValue(detail1([mc(), essay()]));
    renderPage();
    await screen.findByText("Chấm điểm (2 câu)");
    expect(listStudentAttempts).toHaveBeenCalledTimes(1);
    expect(listStudentAttempts).toHaveBeenCalledWith("syl1", "hv1", "60");
    expect(getGradingAttempt).toHaveBeenCalledWith("att1");
    expect(screen.getByText("Nguyễn A")).toHaveClass("text-danger");
    expect(screen.getByText("Buổi 1")).toHaveClass("fw-bold", "text-danger");
    expect(document.querySelector(".content")).toHaveClass("cm-grading-workspace-page");
    expect(document.querySelector(".cm-sticky-header")).not.toBeNull();
    expect(document.querySelector(".cm-banner")).toHaveTextContent("Chấm điểm (2 câu)");
    expect(screen.getByText("Nghe")).toBeInTheDocument(); // "#1 Quiz - Nghe" => "Nghe"
    expect(screen.getByText("(2 câu)")).toBeInTheDocument();
    expect(screen.getByText("Câu 1")).toBeInTheDocument();
    expect(screen.getByText("Câu 2")).toBeInTheDocument();
    expect(screen.getByText("一、听力")).toBeInTheDocument();
    expect(screen.getByText("(0 / 6)")).toHaveClass("cm-score-tone--low"); // điểm module tính từ câu hỏi
    expect(stat("Số câu đã có điểm")).toBe("1/2"); // máy chấm 1 câu, tự luận chưa chấm
    expect(stat("Số câu đạt điểm tối đa")).toBe("0/2");
    expect(stat("Số điểm đã lưu")).toBe("0/6");
    expect(screen.getByText("0 / 6")).toHaveClass("fs-5"); // tổng điểm buổi học
    // trắc nghiệm: đáp án đúng xanh, học viên chọn sai đỏ kèm chú thích
    const [mcCard] = cards();
    expect(within(mcCard).getByText("B. 八点").closest(".rounded")).toHaveClass("border-success");
    expect(within(mcCard).getByText("A. 七点").closest(".rounded")).toHaveClass("border-danger");
    expect(within(mcCard).getByText("(Đáp án của học viên)")).toBeInTheDocument();
    expect(screen.getByText("Đáp án tham khảo:")).toBeInTheDocument();
  });

  it("công tắc ghi ĐÓNG (mặc định): WriteLockedNotice, ô điểm/nhận xét bị khoá, nút Lưu và Gửi disabled, không có request ghi", async () => {
    vi.mocked(listStudentAttempts).mockResolvedValue([summary1]);
    vi.mocked(getGradingAttempt).mockResolvedValue(detail1([essay()]));
    renderPage();
    await screen.findByText("Chấm điểm (1 câu)");
    expect(screen.getByTestId("write-locked")).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.getByLabelText("Điểm")).toBeDisabled();
    expect(screen.getByPlaceholderText("Nhập nhận xét...")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Gửi kết quả cho học viên" })).toBeDisabled();
    expect(gradeAnswer).not.toHaveBeenCalled();
  });

  it("nút quay lại điều hướng về Danh sách nộp bài với classId/courseId/scheduleId/title", async () => {
    vi.mocked(listStudentAttempts).mockResolvedValue([]);
    renderPage();
    await screen.findByText("Học viên chưa nộp bài nào");
    await userEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(nav.push).toEqual([`/instructor/list-class/submissions?classId=60&courseId=7&scheduleId=syl1&title=${encodeURIComponent("Buổi 1")}`]);
  });
});

describe("màn chấm bài — thao tác ghi khi công tắc MỞ (NEXT_PUBLIC_WRITE_QUIZ_GRADING=enabled)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_QUIZ_GRADING", "enabled");
    vi.mocked(listStudentAttempts).mockResolvedValue([summary1]);
  });

  it("lưu điểm + nhận xét câu tự luận: gradeAnswer(answerId, body, demo=false) => thẻ chuyển sang xem, module 'graded', tổng quan cập nhật, toast", async () => {
    vi.mocked(getGradingAttempt).mockResolvedValue(detail1([mc(), essay()]));
    vi.mocked(gradeAnswer).mockResolvedValue(detail1([mc(), essay({ teacherScore: 4, teacherComment: "Tốt" })], { gradingStatus: "GRADED" }));
    renderPage();
    await screen.findByText("Chấm điểm (2 câu)");
    expect(screen.queryByTestId("write-locked")).toBeNull();
    const [, essayCard] = cards();
    await userEvent.type(within(essayCard).getByPlaceholderText("Nhập nhận xét..."), "Tốt");
    const score = within(essayCard).getByLabelText("Điểm");
    await userEvent.clear(score);
    await userEvent.type(score, "4");
    await userEvent.click(within(essayCard).getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(gradeAnswer).toHaveBeenCalledWith("ans-essay", { teacherScore: 4, teacherComment: "Tốt" }, false));
    expect(toast.success).toHaveBeenCalledWith("Đã lưu điểm câu hỏi");
    expect(await within(essayCard).findByText("Chỉnh sửa")).toBeInTheDocument();
    expect(within(essayCard).getByText("Tốt", { selector: "div" })).toBeInTheDocument();
    expect(stat("Số câu đã có điểm")).toBe("2/2");
    expect(stat("Số điểm đã lưu")).toBe("4/6");
    expect(screen.getByText("(4 / 6)")).toBeInTheDocument(); // điểm module tính lại từ câu hỏi
    expect(screen.getByText("4 / 6")).toHaveClass("fs-5");
  });

  it("điểm vượt tối đa => toast lỗi, KHÔNG gọi API; câu chưa có answerId => gradeQuestion(attemptId, questionId, ...)", async () => {
    vi.mocked(getGradingAttempt).mockResolvedValue(detail1([essay({ answerId: undefined, studentAnswer: null })]));
    vi.mocked(gradeQuestion).mockResolvedValue(detail1([essay({ answerId: "ans-new", studentAnswer: "", teacherScore: 0, teacherComment: "Chưa làm bài" })]));
    renderPage();
    await screen.findByText("Chấm điểm (1 câu)");
    expect(screen.getByText("Học viên chưa trả lời câu này")).toBeInTheDocument();
    const score = screen.getByLabelText("Điểm");
    await userEvent.type(score, "9");
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(toast.error).toHaveBeenCalledWith("Điểm không hợp lệ (0 đến điểm tối đa)");
    expect(gradeQuestion).not.toHaveBeenCalled();
    expect(gradeAnswer).not.toHaveBeenCalled();
    await userEvent.clear(score);
    await userEvent.type(score, "0");
    await userEvent.type(screen.getByPlaceholderText("Nhập nhận xét..."), "Chưa làm bài");
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(gradeQuestion).toHaveBeenCalledWith("att1", "q-essay", { teacherScore: 0, teacherComment: "Chưa làm bài" }, false));
    expect(await screen.findByText("Chưa làm bài", { selector: "div" })).toBeInTheDocument();
  });

  it("lưu thất bại (API lỗi) => toast thông điệp của máy chủ, thẻ vẫn ở chế độ nhập", async () => {
    vi.mocked(getGradingAttempt).mockResolvedValue(detail1([essay()]));
    vi.mocked(gradeAnswer).mockRejectedValue(new ApiError("Bài đã bị khoá.", 409));
    renderPage();
    await screen.findByText("Chấm điểm (1 câu)");
    await userEvent.type(screen.getByLabelText("Điểm"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Bài đã bị khoá."));
    expect(screen.getByRole("button", { name: "Lưu" })).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("gửi khi còn câu chưa chấm => modal 'Cảnh báo' (antd) liệt kê bài và số câu, KHÔNG gọi sendAttempt", async () => {
    vi.mocked(getGradingAttempt).mockResolvedValue(detail1([mc(), essay()]));
    renderPage();
    await screen.findByText("Chấm điểm (2 câu)");
    const send = screen.getByRole("button", { name: "Gửi kết quả cho học viên" });
    expect(send).toBeEnabled();
    await userEvent.click(send);
    expect(await screen.findByText("Cảnh báo")).toBeInTheDocument();
    expect(screen.getByText("Các bài sau còn câu chưa chấm nên chưa được gửi cho học viên:")).toBeInTheDocument();
    expect(screen.getByText("Nghe — 一、听力")).toBeInTheDocument();
    expect(screen.getByText(/: câu 2$/)).toBeInTheDocument();
    expect(sendAttempt).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() => expect(screen.queryByText("Các bài sau còn câu chưa chấm nên chưa được gửi cho học viên:")).toBeNull());
  });

  it("gửi bài đã chấm đủ: sendAttempt(attemptId, undefined, false), không chấm lại câu không đổi; sau đó badge 'Đã gửi', nút Gửi disabled, toast", async () => {
    const graded = [mc({ isCorrect: true, autoScore: 1, studentAnswer: "B", teacherScore: 1 }), essay({ teacherScore: 4, teacherComment: "Tốt" })];
    vi.mocked(getGradingAttempt).mockResolvedValue(detail1(graded, { gradingStatus: "GRADED" }));
    vi.mocked(sendAttempt).mockResolvedValue(detail1(graded.map((q) => ({ ...q, returnedAt: "2026-10-27T10:00:00Z" })), { gradingStatus: "RETURNED" }));
    renderPage();
    await screen.findByText("Chấm điểm (2 câu)");
    expect(screen.queryByText("Đã gửi")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Gửi kết quả cho học viên" }));
    await waitFor(() => expect(sendAttempt).toHaveBeenCalledWith("att1", undefined, false));
    expect(gradeAnswer).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Đã gửi kết quả các câu mới chấm cho học viên");
    expect(await screen.findAllByText("Đã gửi")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Gửi kết quả cho học viên" })).toBeDisabled(); // không còn gì để gửi
    expect(screen.queryByRole("button", { name: "Chỉnh sửa" })).toBeNull(); // câu đã gửi: chỉ xem
  });

  it("gửi lưu trước bản nháp còn khác điểm đã lưu (câu máy chấm) rồi mới gửi; gửi lỗi => toast kèm tên bài", async () => {
    vi.mocked(getGradingAttempt).mockResolvedValue(detail1([mc()]));
    vi.mocked(gradeAnswer).mockResolvedValue(detail1([mc({ teacherScore: 0 })], { gradingStatus: "GRADED" }));
    vi.mocked(sendAttempt).mockRejectedValue(new ApiError("Hệ thống đang tạm thời gián đoạn hoặc đang bảo trì. Vui lòng thử lại sau ít phút.", 500));
    renderPage();
    await screen.findByText("Chấm điểm (1 câu)");
    await userEvent.click(screen.getByRole("button", { name: "Gửi kết quả cho học viên" }));
    await waitFor(() => expect(sendAttempt).toHaveBeenCalledWith("att1", undefined, false));
    expect(gradeAnswer).toHaveBeenCalledWith("ans-mc", { teacherScore: 0, teacherComment: "" }, false);
    expect(toast.error).toHaveBeenCalledWith("Hệ thống đang tạm thời gián đoạn hoặc đang bảo trì. Vui lòng thử lại sau ít phút.");
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("màn chấm bài — tham số và trạng thái dữ liệu", () => {
  it.each([
    ["/instructor/list-class/grading?scheduleId=syl1&userId=hv1", "missing-class"],
    ["/instructor/list-class/grading?classId=60&userId=hv1", "missing-schedule"],
    ["/instructor/list-class/grading?classId=60&scheduleId=syl1", "missing-user"],
    ["/instructor/list-class/grading?classId=60&scheduleId=syl1&userId=a%2Fb", "invalid-user"],
  ])("%s => thông báo %s, không gọi API", async (url, kind) => {
    nav.set(url);
    renderPage();
    expect(await screen.findByTestId("grading-notice")).toHaveAttribute("data-kind", kind);
    expect(listStudentAttempts).not.toHaveBeenCalled();
    expect(screen.queryByText("Học viên chưa nộp bài nào")).toBeNull();
    expect(screen.getByText("—")).toBeInTheDocument(); // không có studentName
  });

  it("chưa nộp bài nào => 'Học viên chưa nộp bài nào'; dịch vụ chưa cấu hình => WAITING FOR BACKEND không toast", async () => {
    vi.mocked(listStudentAttempts).mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByText("Học viên chưa nộp bài nào")).toBeInTheDocument();
    expect(getGradingAttempt).not.toHaveBeenCalled();
  });

  it("dịch vụ chưa cấu hình => WAITING FOR BACKEND, không toast, không 'chưa nộp bài'", async () => {
    vi.mocked(listStudentAttempts).mockRejectedValue(new ApiNotConfiguredError());
    renderPage();
    const notice = await screen.findByTestId("grading-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByText("Học viên chưa nộp bài nào")).toBeNull();
  });

  it("một chi tiết bài làm lỗi => cả màn ở trạng thái lỗi (không âm thầm bỏ bài như bản cũ), 'Thử lại' tải lại", async () => {
    vi.mocked(listStudentAttempts).mockResolvedValue([summary1, { ...summary1, attemptId: "att2", groupId: "g2", groupOrder: 2 }]);
    vi.mocked(getGradingAttempt)
      .mockResolvedValueOnce(detail1([mc()]))
      .mockRejectedValueOnce(new ApiError("Không tìm thấy dữ liệu được yêu cầu.", 404))
      .mockResolvedValue(detail1([mc()]));
    renderPage();
    const notice = await screen.findByTestId("grading-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(toast.error).toHaveBeenCalledWith("Không tìm thấy dữ liệu được yêu cầu.");
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Chấm điểm (2 câu)")).toBeInTheDocument();
  });
});
