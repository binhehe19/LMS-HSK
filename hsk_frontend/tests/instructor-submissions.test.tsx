import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InstructorSubmissionsPageContent } from "@/components/management/instructor-submissions/instructor-submissions-page-content";
import { ManagementShell } from "@/components/management/management-shell";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { getGradingAttempt, listScheduleStudents } from "@/lib/api/quiz-grading-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { GradingStudentResponse } from "@/types/grading";
import { adminUser } from "./fixtures/classes";

const nav = vi.hoisted(() => {
  let url = "/instructor/list-class/submissions";
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
vi.mock("@/lib/api/quiz-grading-client", () => ({ listAdminGradingClasses: vi.fn(), listTeacherGradingClasses: vi.fn(), listScheduleStudents: vi.fn(), getGradingAttempt: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const teacher = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "gv1@example.test", roles: ["ROLE_TEACHER"] };
const student = (i: number, over: Partial<GradingStudentResponse> = {}): GradingStudentResponse => ({
  userId: `hv${i}`,
  name: `Học Viên ${i}`,
  email: `hv${i}@demo.invalid`,
  studentCode: `HV000${i}`,
  completionRate: 50,
  totalScore: 7.5,
  answeredQuestions: 6,
  totalQuestions: 8,
  submittedAny: true,
  modules: [{ moduleId: "m1", attemptId: `att${i}`, label: "Bài 1", submitted: true, status: "graded", score: 7.5, maxScore: 10 }],
  ...over,
});

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(listScheduleStudents).mockReset();
  vi.mocked(getGradingAttempt).mockReset();
  vi.mocked(toast.error).mockClear();
  nav.push.length = 0;
  nav.set("/instructor/list-class/submissions?classId=60&courseId=7&scheduleId=syl1&title=Bu%E1%BB%95i%201%3A%20Ch%C3%A0o%20h%E1%BB%8Fi");
});

function renderPage() {
  render(
    <Provider store={makeStore({ status: "authenticated", user: teacher })}>
      <ManagementShell area="instructor">
        <InstructorSubmissionsPageContent />
      </ManagementShell>
    </Provider>,
  );
}

const rows = () => screen.queryAllByTestId("submission-row");

describe("màn Danh sách nộp bài — có dữ liệu", () => {
  it("gọi listScheduleStudents(scheduleId, classId) đúng một lần, KHÔNG gọi getGradingAttempt (bỏ N+1 của bản cũ); giữ DOM: breadcrumb, tiêu đề + badge buổi, cột lưới", async () => {
    vi.mocked(listScheduleStudents).mockResolvedValue([student(1)]);
    renderPage();
    await screen.findByText("Học Viên 1");
    expect(listScheduleStudents).toHaveBeenCalledTimes(1);
    expect(listScheduleStudents).toHaveBeenCalledWith("syl1", "60");
    expect(getGradingAttempt).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Danh sách lớp học" })).toHaveAttribute("href", "/instructor/list-class");
    expect(screen.getByRole("link", { name: "Danh sách bài học" })).toHaveAttribute("href", "/instructor/list-class/list-lesson?classId=60&courseId=7");
    expect(screen.getByText("Danh sách học viên gửi bài")).toHaveClass("fw-bold");
    expect(screen.getByText("Buổi 1: Chào hỏi")).toHaveClass("badge", "bg-danger");
    expect([...document.querySelectorAll(".cm-submission-header > div")].map((d) => d.textContent)).toEqual(["STT", "Thông tin học viên", "Chuyên cần bài tập", "Điểm bài tập", "Chi tiết"]);
    expect((document.querySelector(".content > .container > .row") as HTMLElement).className).toBe("row");
  });

  it("dòng học viên: chữ cái đầu, mã, email, điểm (2 chữ số lẻ), số câu, tông màu; chưa nộp => 'Chưa nộp bài' nền xám; sắp theo tên tiếng Việt", async () => {
    vi.mocked(listScheduleStudents).mockResolvedValue([student(2, { name: "Trần Bình", totalScore: 9, completionRate: 100 }), student(1, { name: "Đỗ An", submittedAny: false, totalScore: 0, completionRate: 0, modules: [] })]);
    renderPage();
    await screen.findByText("Đỗ An");
    const [first, second] = rows();
    expect(within(first).getByText("ĐA")).toBeInTheDocument();
    expect(within(first).getByText("Chưa nộp bài")).toBeInTheDocument();
    expect(first.querySelector(".cm-submission-score .rounded-3")).toHaveClass("bg-light", "text-muted");
    expect(first.querySelector(".cm-submission-progress")).toHaveClass("cm-score-tone--muted");
    expect(within(second).getByText("TB")).toBeInTheDocument();
    expect(within(second).getByText("HV0002")).toBeInTheDocument();
    expect(within(second).getByText("hv2@demo.invalid")).toBeInTheDocument();
    expect(within(second).getByText("9")).toBeInTheDocument();
    expect(within(second).getByText("6 / 8 câu")).toBeInTheDocument();
    expect(second.querySelector(".cm-submission-score .rounded-3")).toHaveClass("cm-score-card", "cm-score-tone--high");
    expect(second.querySelector(".cm-submission-progress")).toHaveClass("cm-score-tone--high");
    expect(second.querySelector(".cm-submission-detail i")).toHaveClass("isax-book", "text-warning"); // đã chấm, chưa trả
  });

  it("nút 'Chi tiết' điều hướng sang màn chấm bài với đúng contract query (kể cả view=detail & studentName)", async () => {
    vi.mocked(listScheduleStudents).mockResolvedValue([student(1, { name: "Nguyễn A" })]);
    renderPage();
    await screen.findByText("Nguyễn A");
    await userEvent.click(screen.getByRole("button", { name: "Chi tiết" }));
    expect(nav.push).toEqual([`/instructor/list-class/grading?scheduleId=syl1&userId=hv1&classId=60&courseId=7&title=${encodeURIComponent("Buổi 1: Chào hỏi")}&view=detail&studentName=${encodeURIComponent("Nguyễn A")}`]);
  });

  it("tìm theo tên / mã / email; không khớp => 'Chưa có học viên'", async () => {
    vi.mocked(listScheduleStudents).mockResolvedValue([student(1, { name: "Nguyễn A" }), student(2, { name: "Trần B" })]);
    renderPage();
    await screen.findByText("Nguyễn A");
    const search = screen.getByPlaceholderText("Tìm kiếm tên, mã học viên, email");
    await userEvent.type(search, "hv0002");
    expect(rows()).toHaveLength(1);
    expect(screen.getByText("Trần B")).toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, "không có");
    expect(rows()).toHaveLength(0);
    expect(screen.getByText("Chưa có học viên")).toBeInTheDocument();
  });
});

describe("query thiếu/không hợp lệ — KHÔNG gọi API", () => {
  it.each([
    ["/instructor/list-class/submissions?scheduleId=syl1", "missing-class"],
    ["/instructor/list-class/submissions?classId=a%2Fb&scheduleId=syl1", "invalid-class"],
    ["/instructor/list-class/submissions?classId=60&courseId=7", "missing-schedule"],
    ["/instructor/list-class/submissions?classId=60&scheduleId=..", "invalid-schedule"],
  ])("%s => thông báo %s, không gọi API, không toast, không 'Chưa có học viên'", async (url, kind) => {
    nav.set(url);
    renderPage();
    const notice = await screen.findByTestId("submissions-notice");
    expect(notice).toHaveAttribute("data-kind", kind);
    expect(listScheduleStudents).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByText("Chưa có học viên")).toBeNull();
    expect(document.querySelector(".spinner-border")).toBeNull();
    expect(screen.getByRole("link", { name: "Danh sách lớp học" })).toBeInTheDocument();
  });

  it("thiếu courseId/title vẫn gọi API; badge buổi không hiện; liên kết quay lại có courseId rỗng", async () => {
    nav.set("/instructor/list-class/submissions?classId=60&scheduleId=syl1");
    vi.mocked(listScheduleStudents).mockResolvedValue([student(1)]);
    renderPage();
    await screen.findByText("Học Viên 1");
    expect(listScheduleStudents).toHaveBeenCalledWith("syl1", "60");
    expect(document.querySelector(".card-header .badge")).toBeNull();
    expect(screen.getByRole("link", { name: "Danh sách bài học" })).toHaveAttribute("href", "/instructor/list-class/list-lesson?classId=60&courseId=");
  });
});

describe("trạng thái dữ liệu", () => {
  it("đang tải: spinner, không 'Chưa có học viên'; rỗng thật => 'Chưa có học viên'", async () => {
    vi.mocked(listScheduleStudents).mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    expect(document.querySelector(".spinner-border")).not.toBeNull();
    expect(screen.queryByText("Chưa có học viên")).toBeNull();
  });

  it("rỗng thật => 'Chưa có học viên', không khối lỗi", async () => {
    vi.mocked(listScheduleStudents).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Chưa có học viên")).toBeInTheDocument();
    expect(screen.queryByTestId("submissions-notice")).toBeNull();
  });

  it("dịch vụ chưa cấu hình => WAITING FOR BACKEND, không toast", async () => {
    vi.mocked(listScheduleStudents).mockRejectedValue(new ApiNotConfiguredError());
    renderPage();
    const notice = await screen.findByTestId("submissions-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(notice).toHaveTextContent("WAITING FOR BACKEND");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("403 (buổi/lớp không thuộc giảng viên): toast + khối lỗi có 'Thử lại' tải lại; phản hồi không phải mảng => lỗi hợp đồng", async () => {
    vi.mocked(listScheduleStudents).mockRejectedValueOnce(new ApiError("Bạn không có quyền thực hiện thao tác này.", 403)).mockResolvedValueOnce({ items: [] } as never).mockResolvedValue([student(1)]);
    renderPage();
    const notice = await screen.findByTestId("submissions-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(toast.error).toHaveBeenCalledWith("Bạn không có quyền thực hiện thao tác này.");
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText(/không đúng định dạng/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Học Viên 1")).toBeInTheDocument();
  });
});
