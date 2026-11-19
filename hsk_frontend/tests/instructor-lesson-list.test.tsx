import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InstructorLessonListPageContent } from "@/components/management/instructor-lesson-list/instructor-lesson-list-page-content";
import { ManagementShell } from "@/components/management/management-shell";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { listClassSchedules } from "@/lib/api/quiz-grading-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { GradingScheduleResponse } from "@/types/grading";
import { adminUser } from "./fixtures/classes";

// Router giả CÓ trạng thái: replace/push đổi URL hiện tại và báo cho useSearchParams (giống Next thật).
const nav = vi.hoisted(() => {
  let url = "/instructor/list-class/list-lesson";
  const listeners = new Set<() => void>();
  const api = {
    push: [] as string[],
    replace: [] as string[],
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
  return api;
});
vi.mock("next/navigation", () => ({
  usePathname: () => nav.get().split("?")[0],
  useSearchParams: () => {
    const search = useSyncExternalStore(nav.subscribe, nav.get, nav.get);
    return new URLSearchParams(search.split("?")[1] ?? "");
  },
  useRouter: () => ({
    push: (to: string) => nav.push.push(to),
    replace: (to: string) => {
      nav.replace.push(to);
      nav.set(to);
    },
    back: vi.fn(),
  }),
}));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/notification-client", () => ({ getUnreadCount: vi.fn(), fetchNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
vi.mock("@/lib/api/quiz-grading-client", () => ({ listAdminGradingClasses: vi.fn(), listTeacherGradingClasses: vi.fn(), listClassSchedules: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const teacher = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "gv1@example.test", roles: ["ROLE_TEACHER"] };
const lesson = (i: number, over: Partial<GradingScheduleResponse> = {}): GradingScheduleResponse => ({
  sessionId: `s${i}`, syllabusScheduleId: `syl${i}`, sessionNo: i, title: `Bài ${i}`, ...over,
});
const many = (n: number) => Array.from({ length: n }, (_, i) => lesson(i + 1)).reverse();

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(listClassSchedules).mockReset();
  vi.mocked(toast.error).mockClear();
  nav.push.length = 0;
  nav.replace.length = 0;
  nav.set("/instructor/list-class/list-lesson?classId=60&courseId=7");
});

function renderPage() {
  render(
    <Provider store={makeStore({ status: "authenticated", user: teacher })}>
      <ManagementShell area="instructor">
        <InstructorLessonListPageContent />
      </ManagementShell>
    </Provider>,
  );
}

const rows = () => screen.queryAllByTestId("lesson-row");
const titles = () => rows().map((r) => within(r).getAllByRole("cell")[1].textContent);
const pager = () => document.querySelector(".ant-pagination") as HTMLElement;

describe("màn Danh sách bài học — có dữ liệu", () => {
  it("gọi API đúng một lần với classId từ URL (courseId không dùng để gọi); giữ DOM: breadcrumb, thẻ tìm kiếm, tiêu đề thẻ, 5 cột", async () => {
    vi.mocked(listClassSchedules).mockResolvedValue([lesson(1)]);
    renderPage();
    await screen.findByText("Buổi 1: Bài 1");
    expect(listClassSchedules).toHaveBeenCalledTimes(1);
    expect(listClassSchedules).toHaveBeenCalledWith("60");
    expect(screen.getByRole("link", { name: "Danh sách lớp học" })).toHaveAttribute("href", "/instructor/list-class");
    expect(screen.getByText("Danh sách bài học", { selector: ".card-header" })).toHaveClass("bg-light", "fw-bold");
    expect(screen.getByPlaceholderText("Tên bài học")).toBeInTheDocument();
    expect([...document.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["STT", "Tên bài học", "Chi tiết bài học", "Danh sách nộp bài", "Phân tích học tập"]);
    expect((document.querySelector(".content > .container > .row") as HTMLElement).className).toBe("row");
    expect(screen.getByText("Tổng số 1")).toBeInTheDocument();
  });

  it("sắp theo sessionNo dù API trả lẫn lộn; tiêu đề: tiền tố 'Buổi N:', chủ đề sau dấu ':', màu theo hasAssignment; STT liên tục", async () => {
    vi.mocked(listClassSchedules).mockResolvedValue([
      lesson(3, { title: undefined, hasAssignment: true }),
      lesson(2, { title: "Xin chào", topic: "Chủ đề hai" }),
      lesson(1, { title: "Buổi 1" }),
      lesson(9, { sessionNo: undefined, title: "Thiếu số" }),
    ]);
    renderPage();
    await screen.findByText("Buổi 1");
    expect(titles()).toEqual(["Buổi 1", "Buổi 2: Xin chào: Chủ đề hai", "Buổi 3", "Buổi -: Thiếu số"]);
    expect(rows().map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual(["1", "2", "3", "4"]);
    const color = (i: number) => (within(rows()[i]).getAllByRole("cell")[1].firstElementChild as HTMLElement).style.color;
    expect(color(2)).toBe("rgb(128, 0, 32)"); // #800020 (hasAssignment)
    expect(color(0)).toBe("rgb(113, 166, 210)"); // #71A6D2
  });

  it("ba nút mỗi dòng điều hướng đúng route và query (classId, courseId, scheduleId, title); chấm đỏ chỉ khi hasPendingGrading", async () => {
    vi.mocked(listClassSchedules).mockResolvedValue([lesson(1, { hasPendingGrading: true, title: "Xin chào & thế giới" }), lesson(2)]);
    renderPage();
    await screen.findByText(/Xin chào/);
    const first = rows()[0];
    expect(first.querySelector(".cm-dot-badge")).toHaveTextContent("*");
    expect(rows()[1].querySelector(".cm-dot-badge")).toBeNull();
    const title = encodeURIComponent("Xin chào & thế giới");
    await userEvent.click(within(first).getByRole("button", { name: "Chi tiết bài học" }));
    await userEvent.click(within(first).getByRole("button", { name: "Danh sách nộp bài" }));
    await userEvent.click(within(first).getByRole("button", { name: "Phân tích học tập" }));
    expect(nav.push).toEqual([
      `/instructor/list-class/lesson-detail?classId=60&courseId=7&scheduleId=syl1&title=${title}`,
      `/instructor/list-class/submissions?classId=60&courseId=7&scheduleId=syl1&title=${title}`,
      `/instructor/list-class/learning-analysis?classId=60&courseId=7&scheduleId=syl1&title=${title}`,
    ]);
  });

  it("tìm theo tên/chủ đề, về trang 1 chỉ khi NGƯỜI DÙNG gõ (không ghi đè ?page= lúc vào trang)", async () => {
    nav.set("/instructor/list-class/list-lesson?classId=60&courseId=7&page=2");
    vi.mocked(listClassSchedules).mockResolvedValue(many(25));
    renderPage();
    await screen.findByText("Buổi 11: Bài 11");
    expect(nav.replace).toEqual([]); // vào trang không ghi URL
    expect(titles()[0]).toBe("Buổi 11: Bài 11");
    await userEvent.type(screen.getByPlaceholderText("Tên bài học"), "bài 2");
    expect(nav.replace.at(-1)).toContain("page=1");
    expect(titles()).toEqual(["Buổi 2: Bài 2", "Buổi 20: Bài 20", "Buổi 21: Bài 21", "Buổi 22: Bài 22", "Buổi 23: Bài 23", "Buổi 24: Bài 24", "Buổi 25: Bài 25"]);
    expect(screen.getByText("Tổng số 7")).toBeInTheDocument();
    await userEvent.clear(screen.getByPlaceholderText("Tên bài học"));
    await userEvent.type(screen.getByPlaceholderText("Tên bài học"), "không có");
    expect(screen.getByText("Chưa có bài học")).toBeInTheDocument();
  });
});

describe("phân trang qua URL (?page=)", () => {
  beforeEach(() => vi.mocked(listClassSchedules).mockResolvedValue(many(25)));

  it("bấm trang ghi ?page=N bằng replace, giữ classId/courseId; reload (URL có page) hiện đúng trang", async () => {
    renderPage();
    await screen.findByText("Buổi 1: Bài 1");
    await userEvent.click(within(pager()).getByTitle("3"));
    expect(nav.replace.at(-1)).toBe("/instructor/list-class/list-lesson?classId=60&courseId=7&page=3");
    expect(titles()).toEqual(["Buổi 21: Bài 21", "Buổi 22: Bài 22", "Buổi 23: Bài 23", "Buổi 24: Bài 24", "Buổi 25: Bài 25"]);
    expect(within(rows()[0]).getAllByRole("cell")[0].textContent).toBe("21");
    expect(nav.push).toEqual([]); // không thêm mục lịch sử: nút quay lại về trang trước đó
  });

  it.each([["abc"], ["0"], ["-3"], ["1.5"]])("page=%s không hợp lệ => hiện trang 1, không lỗi", async (bad) => {
    nav.set(`/instructor/list-class/list-lesson?classId=60&courseId=7&page=${bad}`);
    renderPage();
    await screen.findByText("Buổi 1: Bài 1");
    expect(rows()).toHaveLength(10);
    expect(pager().querySelector(".ant-pagination-item-active")).toHaveTextContent("1");
  });

  it("page vượt tổng số trang => hiện trang cuối (không bảng trống)", async () => {
    nav.set("/instructor/list-class/list-lesson?classId=60&courseId=7&page=99");
    renderPage();
    await screen.findByText("Buổi 21: Bài 21");
    expect(rows()).toHaveLength(5);
    expect(pager().querySelector(".ant-pagination-item-active")).toHaveTextContent("3");
  });
});

describe("query thiếu/không hợp lệ — KHÔNG gọi API", () => {
  it.each([
    ["/instructor/list-class/list-lesson", "missing-class"],
    ["/instructor/list-class/list-lesson?classId=&courseId=7", "missing-class"],
    ["/instructor/list-class/list-lesson?classId=%20%20", "missing-class"],
    ["/instructor/list-class/list-lesson?classId=..%2Fadmin", "invalid-class"],
    ["/instructor/list-class/list-lesson?classId=a%3Fb", "invalid-class"],
    ["/instructor/list-class/list-lesson?classId=a%5Cb", "invalid-class"],
  ])("%s => thông báo %s, không có lời gọi API, không toast, không 'Chưa có bài học'", async (url, kind) => {
    nav.set(url);
    renderPage();
    const notice = await screen.findByTestId("lesson-list-notice");
    expect(notice).toHaveAttribute("data-kind", kind);
    expect(listClassSchedules).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByText("Chưa có bài học")).toBeNull();
    expect(document.querySelector(".spinner-border")).toBeNull();
    expect(screen.getByText("Tổng số 0")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Danh sách lớp học" })).toBeInTheDocument(); // đường quay lại vẫn có
  });

  it("thiếu courseId vẫn gọi API (courseId chỉ để chuyển tiếp) và liên kết sang màn kế tiếp có courseId rỗng", async () => {
    nav.set("/instructor/list-class/list-lesson?classId=60");
    vi.mocked(listClassSchedules).mockResolvedValue([lesson(1)]);
    renderPage();
    await screen.findByText("Buổi 1: Bài 1");
    expect(listClassSchedules).toHaveBeenCalledWith("60");
    await userEvent.click(within(rows()[0]).getByRole("button", { name: "Chi tiết bài học" }));
    expect(nav.push[0]).toMatch(/\?classId=60&courseId=&scheduleId=syl1&/);
  });

  it("đổi lớp (URL đổi classId) => gọi lại cho lớp mới, KHÔNG hiện dữ liệu của lớp cũ", async () => {
    let release: (v: GradingScheduleResponse[]) => void = () => {};
    vi.mocked(listClassSchedules).mockImplementation((id: string) => (id === "60" ? Promise.resolve([lesson(1, { title: "Lớp sáu mươi" })]) : new Promise((r) => (release = r))));
    renderPage();
    await screen.findByText("Buổi 1: Lớp sáu mươi");
    act(() => nav.set("/instructor/list-class/list-lesson?classId=61&courseId=7"));
    expect(screen.queryByText("Buổi 1: Lớp sáu mươi")).toBeNull(); // đang tải lớp 61, không lẫn dữ liệu
    expect(document.querySelector(".spinner-border")).not.toBeNull();
    await act(async () => release([lesson(1, { title: "Lớp sáu mốt" })]));
    expect(await screen.findByText("Buổi 1: Lớp sáu mốt")).toBeInTheDocument();
    expect(listClassSchedules).toHaveBeenLastCalledWith("61");
  });
});

describe("trạng thái dữ liệu", () => {
  it("đang tải: spinner, không hiện 'Chưa có bài học'", () => {
    vi.mocked(listClassSchedules).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(document.querySelector(".spinner-border")).not.toBeNull();
    expect(screen.queryByText("Chưa có bài học")).toBeNull();
  });

  it("rỗng thật => 'Chưa có bài học', không khối lỗi", async () => {
    vi.mocked(listClassSchedules).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Chưa có bài học")).toBeInTheDocument();
    expect(screen.queryByTestId("lesson-list-notice")).toBeNull();
  });

  it("dịch vụ chưa cấu hình => WAITING FOR BACKEND, không toast, không 'Chưa có bài học'", async () => {
    vi.mocked(listClassSchedules).mockRejectedValue(new ApiNotConfiguredError());
    renderPage();
    const notice = await screen.findByTestId("lesson-list-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(notice).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.queryByText("Chưa có bài học")).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("403 (lớp không thuộc giảng viên): toast + khối lỗi, KHÔNG hiện 'Chưa có bài học'; 'Thử lại' tải lại", async () => {
    vi.mocked(listClassSchedules).mockRejectedValueOnce(new ApiError("Bạn không có quyền thực hiện thao tác này.", 403)).mockResolvedValue([lesson(1)]);
    renderPage();
    const notice = await screen.findByTestId("lesson-list-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(notice).toHaveTextContent("không có quyền");
    expect(toast.error).toHaveBeenCalledWith("Bạn không có quyền thực hiện thao tác này.");
    expect(screen.queryByText("Chưa có bài học")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Buổi 1: Bài 1")).toBeInTheDocument();
  });

  it("phản hồi không phải mảng => lỗi hợp đồng (bản cũ coi là rỗng)", async () => {
    vi.mocked(listClassSchedules).mockResolvedValue({ items: [] } as never);
    renderPage();
    expect(await screen.findByTestId("lesson-list-notice")).toHaveTextContent("không đúng định dạng");
    expect(screen.queryByText("Chưa có bài học")).toBeNull();
  });
});
