import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InstructorLessonDetailPageContent } from "@/components/management/instructor-lesson-detail/instructor-lesson-detail-page-content";
import { ManagementShell } from "@/components/management/management-shell";
import { confirmAction } from "@/components/shared/confirm-action";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { getLessonDetail, saveLessonDetail } from "@/lib/api/quiz-grading-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { LessonDetailResponse } from "@/types/grading";
import { adminUser } from "./fixtures/classes";

const nav = vi.hoisted(() => {
  let url = "/instructor/list-class/lesson-detail";
  const listeners = new Set<() => void>();
  return {
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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/notification-client", () => ({ getUnreadCount: vi.fn(), fetchNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
vi.mock("@/lib/api/quiz-grading-client", () => ({ listAdminGradingClasses: vi.fn(), listTeacherGradingClasses: vi.fn(), getLessonDetail: vi.fn(), saveLessonDetail: vi.fn() }));
vi.mock("@/components/shared/confirm-action", () => ({ confirmAction: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const teacher = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "gv1@example.test", roles: ["ROLE_TEACHER"] };
const URL = `/instructor/list-class/lesson-detail?classId=60&courseId=7&scheduleId=syl1&title=${encodeURIComponent("Buổi 1: Chào hỏi")}`;
const fixture = (): LessonDetailResponse => ({
  lessonTitle: "Buổi 1: Chào hỏi",
  modules: [
    {
      id: "m1",
      label: "一、听力",
      topicType: "Bài học",
      materialType: "Nghe",
      locked: true,
      exercises: [{ name: "一、听力 — 判断对错", audioName: "l1.mp3", questions: [{ no: 1, type: "TRUE_FALSE", text: "男的周末要去北京出差。", score: 1, options: [{ label: "对", correct: true }, { label: "错" }] }] }],
    },
    { id: "m2", label: "二、阅读", topicType: "Bài học", materialType: "Đọc", exercises: [] },
  ],
});

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.stubEnv("NEXT_PUBLIC_WRITE_LESSON_DETAIL", "");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(getLessonDetail).mockReset();
  vi.mocked(saveLessonDetail).mockReset();
  vi.mocked(confirmAction).mockReset();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  nav.set(URL);
});

function renderPage() {
  render(
    <Provider store={makeStore({ status: "authenticated", user: teacher })}>
      <ManagementShell area="instructor">
        <InstructorLessonDetailPageContent />
      </ManagementShell>
    </Provider>,
  );
}

const modules = () => screen.getAllByTestId("lesson-module");

describe("màn Chi tiết bài học — công tắc ghi ĐÓNG (bố cục 'Chỉ xem' như HSK cũ không mock)", () => {
  it("gọi getLessonDetail(scheduleId, classId, title) một lần; badge 'Chỉ xem' + WriteLockedNotice, không nút Lưu; chủ đề đầu mở sẵn với bài tập/câu/đáp án đúng", async () => {
    vi.mocked(getLessonDetail).mockResolvedValue(fixture());
    renderPage();
    await screen.findByText("一、听力");
    expect(getLessonDetail).toHaveBeenCalledTimes(1);
    expect(getLessonDetail).toHaveBeenCalledWith("syl1", "60", "Buổi 1: Chào hỏi");
    expect(screen.getByText("Chỉ xem")).toHaveClass("badge");
    expect(screen.getByTestId("write-locked")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lưu thay đổi/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Danh sách bài học" })).toHaveAttribute("href", "/instructor/list-class/list-lesson?classId=60&courseId=7");
    expect(screen.getByText("Buổi 1: Chào hỏi")).toHaveClass("form-control", "bg-light");
    expect(modules()).toHaveLength(2);
    expect(modules()[0]).toHaveClass("cm-left-accent");
    expect(within(modules()[0]).getByText("Nghe")).toHaveClass("badge");
    expect(screen.getByText("一、听力 — 判断对错")).toBeInTheDocument();
    expect(screen.getByText("1 câu")).toBeInTheDocument();
    expect(screen.getByText("男的周末要去北京出差。")).toBeInTheDocument();
    expect(screen.getByText("1 điểm")).toBeInTheDocument();
    expect(screen.getByText("对").closest("div")).toHaveClass("bg-success-subtle", "text-success");
    expect(screen.getByText("错").closest("div")).toHaveClass("bg-light");
    expect(document.querySelectorAll("input, select, textarea")).toHaveLength(0);
  });

  it("bấm tiêu đề chủ đề đóng/mở; chủ đề không có bài tập hiện 'Buổi này chưa có bài tập'", async () => {
    vi.mocked(getLessonDetail).mockResolvedValue(fixture());
    renderPage();
    await screen.findByText("一、听力");
    await userEvent.click(within(modules()[1]).getByRole("button"));
    expect(screen.getByText("Buổi này chưa có bài tập")).toBeInTheDocument();
    expect(screen.queryByText("男的周末要去北京出差。")).toBeNull(); // chỉ một chủ đề mở tại một thời điểm
    await userEvent.click(within(modules()[1]).getByRole("button"));
    expect(screen.queryByText("Buổi này chưa có bài tập")).toBeNull();
  });

  it("buổi không có chủ đề => 'Buổi này chưa có bài tập'; tên bài học rơi về title của URL", async () => {
    vi.mocked(getLessonDetail).mockResolvedValue({ lessonTitle: "", modules: [] });
    renderPage();
    expect(await screen.findByText("Buổi này chưa có bài tập")).toBeInTheDocument();
    expect(screen.getByText("Buổi 1: Chào hỏi")).toHaveClass("form-control");
  });
});

describe("màn Chi tiết bài học — công tắc ghi MỞ (NEXT_PUBLIC_WRITE_LESSON_DETAIL=enabled): bố cục chỉnh sửa", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_LESSON_DETAIL", "enabled");
    vi.mocked(getLessonDetail).mockResolvedValue(fixture());
  });

  it("sửa tên chủ đề, thêm chủ đề/bài tập/câu hỏi/đáp án trên bản nháp; 'Lưu thay đổi' gọi saveLessonDetail(scheduleId, classId, bản nháp, demo=false) + toast", async () => {
    vi.mocked(saveLessonDetail).mockImplementation(async (_s, _c, body) => body);
    renderPage();
    await screen.findByText("Các chủ đề");
    expect(screen.queryByText("Chỉ xem")).toBeNull();
    expect(screen.queryByTestId("write-locked")).toBeNull();
    const label = screen.getByLabelText(/Tên chủ đề/);
    await userEvent.clear(label);
    await userEvent.type(label, "Nghe hiểu");
    await userEvent.click(screen.getByRole("button", { name: /Thêm chủ đề/ }));
    expect(modules()).toHaveLength(3);
    expect(within(modules()[2]).getByText("Chủ đề mới")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Thêm câu hỏi/ }));
    expect(screen.getAllByTestId("lesson-question")).toHaveLength(2);
    expect(screen.getByLabelText("Nội dung câu 2")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "+ Thêm đáp án" })[0]);
    expect(within(screen.getAllByTestId("lesson-question")[0]).getAllByPlaceholderText(/Đáp án \d/)).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: /Thêm bài tập bổ sung/ }));
    expect(screen.getAllByTestId("lesson-exercise")).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: /Lưu thay đổi/ }));
    await waitFor(() => expect(saveLessonDetail).toHaveBeenCalledTimes(1));
    const [scheduleId, classId, body, demo] = vi.mocked(saveLessonDetail).mock.calls[0];
    expect([scheduleId, classId, demo]).toEqual(["syl1", "60", false]);
    expect(body.modules.map((m) => m.label)).toEqual(["Nghe hiểu", "二、阅读", "Chủ đề mới"]);
    expect(body.modules[0].exercises?.[0].questions?.map((q) => q.no)).toEqual([1, 2]);
    expect(body.modules[0].exercises).toHaveLength(2);
    expect(toast.success).toHaveBeenCalledWith("Đã lưu chi tiết bài học");
    expect(screen.getByLabelText(/Tên chủ đề/)).toHaveValue("Nghe hiểu"); // phản hồi lưu là bản hiển thị mới
  });

  it("xoá chủ đề qua confirmAction: từ chối => giữ; đồng ý => bỏ khỏi bản nháp", async () => {
    renderPage();
    await screen.findByText("Các chủ đề");
    vi.mocked(confirmAction).mockResolvedValueOnce(false);
    await userEvent.click(within(modules()[0]).getByRole("button", { name: "Xóa chủ đề" }));
    await waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
    expect(vi.mocked(confirmAction).mock.calls[0][0]).toMatchObject({ title: "Xóa chủ đề", danger: true });
    expect(modules()).toHaveLength(2);
    vi.mocked(confirmAction).mockResolvedValueOnce(true);
    await userEvent.click(within(modules()[0]).getByRole("button", { name: "Xóa chủ đề" }));
    await waitFor(() => expect(modules()).toHaveLength(1));
    expect(screen.queryByText("一、听力")).toBeNull();
  });

  it("xoá audio / đổi đáp án đúng / xoá câu đánh số lại; lưu thất bại => toast lỗi, bản nháp giữ nguyên", async () => {
    vi.mocked(saveLessonDetail).mockRejectedValue(new ApiError("Lưu thất bại (MOCK).", 500));
    renderPage();
    await screen.findByText("Các chủ đề");
    expect(screen.getByText("l1.mp3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Xóa audio" }));
    expect(screen.getByText("Chưa có audio")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Đáp án đúng 2"));
    expect(screen.getByLabelText("Đáp án 2")).toHaveClass("border-success");
    expect(screen.getByLabelText("Đáp án 1")).not.toHaveClass("border-success");
    await userEvent.click(screen.getByRole("button", { name: /Thêm câu hỏi/ }));
    await userEvent.click(screen.getAllByRole("button", { name: /Xóa câu/ })[0]);
    expect(screen.getAllByTestId("lesson-question")).toHaveLength(1);
    expect(screen.getByLabelText("Nội dung câu 1")).toHaveValue(""); // câu mới thêm được đánh số lại thành 1
    await userEvent.click(screen.getByRole("button", { name: /Lưu thay đổi/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Lưu thất bại (MOCK)."));
    expect(screen.getByText("Chưa có audio")).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("màn Chi tiết bài học — tham số và trạng thái dữ liệu", () => {
  it.each([
    ["/instructor/list-class/lesson-detail?scheduleId=syl1", "missing-class"],
    ["/instructor/list-class/lesson-detail?classId=60", "missing-schedule"],
    ["/instructor/list-class/lesson-detail?classId=60&scheduleId=a%23b", "invalid-schedule"],
  ])("%s => thông báo %s, không gọi API", async (url, kind) => {
    nav.set(url);
    renderPage();
    expect(await screen.findByTestId("lesson-detail-notice")).toHaveAttribute("data-kind", kind);
    expect(getLessonDetail).not.toHaveBeenCalled();
    expect(screen.queryByText("Buổi này chưa có bài tập")).toBeNull();
  });

  it("dịch vụ chưa cấu hình => WAITING FOR BACKEND không toast; lỗi => toast + 'Thử lại' tải lại; phản hồi thiếu modules => lỗi hợp đồng", async () => {
    vi.mocked(getLessonDetail)
      .mockRejectedValueOnce(new ApiNotConfiguredError())
      .mockRejectedValueOnce(new ApiError("Bạn không có quyền thực hiện thao tác này.", 403))
      .mockResolvedValueOnce({ lessonTitle: "x" } as never)
      .mockResolvedValue(fixture());
    renderPage();
    expect(await screen.findByTestId("lesson-detail-notice")).toHaveAttribute("data-kind", "waiting");
    expect(toast.error).not.toHaveBeenCalled();
    nav.set(`${URL}&page=2`); // đổi URL => khoá không đổi (page không thuộc khoá) => không tải lại
    expect(getLessonDetail).toHaveBeenCalledTimes(1);

    nav.set(URL.replace("scheduleId=syl1", "scheduleId=syl2"));
    const notice = await screen.findByText("Bạn không có quyền thực hiện thao tác này.");
    expect(notice.closest("[data-testid=lesson-detail-notice]")).toHaveAttribute("data-kind", "error");
    expect(toast.error).toHaveBeenCalledWith("Bạn không có quyền thực hiện thao tác này.");
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText(/không đúng định dạng/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("一、听力")).toBeInTheDocument();
  });
});
