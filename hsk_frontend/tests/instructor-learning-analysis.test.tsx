import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InstructorLearningAnalysisDetailPageContent } from "@/components/management/instructor-learning-analysis/instructor-learning-analysis-detail-page-content";
import { InstructorLearningAnalysisPageContent } from "@/components/management/instructor-learning-analysis/instructor-learning-analysis-page-content";
import { ManagementShell } from "@/components/management/management-shell";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { approvePersonalizationReport, generatePersonalizationSnapshot, getAttendanceAnalysis, getLatestTeacherNote, getPersonalization, sendTeacherNote } from "@/lib/api/learning-analysis-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { getLessonDetail, listScheduleStudents, listStudentAttempts } from "@/lib/api/quiz-grading-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import { adminUser } from "./fixtures/classes";
import { attemptsFixture, attendanceFixture, lessonFixture, personalizationApprovedFixture, personalizationDraftFixture, personalizationNoSnapshotFixture, studentsFixture } from "./fixtures/learning-analysis";

// Router giả CÓ trạng thái: push/replace đổi URL hiện tại và báo cho useSearchParams (giống Next thật).
const nav = vi.hoisted(() => {
  let url = "/instructor/list-class/learning-analysis";
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
  useRouter: () => ({
    push: (to: string) => {
      nav.push.push(to);
      nav.set(to);
    },
    replace: (to: string) => nav.set(to),
    back: vi.fn(),
  }),
}));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/notification-client", () => ({ getUnreadCount: vi.fn(), fetchNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
vi.mock("@/lib/api/quiz-grading-client", () => ({ listAdminGradingClasses: vi.fn(), listTeacherGradingClasses: vi.fn(), listClassSchedules: vi.fn(), listScheduleStudents: vi.fn(), listStudentAttempts: vi.fn(), getLessonDetail: vi.fn() }));
vi.mock("@/lib/api/learning-analysis-client", () => ({ getAttendanceAnalysis: vi.fn(), getLatestTeacherNote: vi.fn(), sendTeacherNote: vi.fn(), getPersonalization: vi.fn(), generatePersonalizationSnapshot: vi.fn(), approvePersonalizationReport: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// ApexCharts cần SVG thật của trình duyệt; ở đây chỉ kiểm tra loại biểu đồ và dữ liệu được truyền.
vi.mock("@/components/shared/apex-chart", () => ({
  ApexChart: (props: { type?: string; series?: unknown; options?: { xaxis?: { categories?: unknown } } }) => <div data-testid="apex-chart" data-type={props.type} data-series={JSON.stringify(props.series)} data-categories={JSON.stringify(props.options?.xaxis?.categories)} />,
}));

const teacher = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "gv1@example.test", roles: ["ROLE_TEACHER"] };
const LIST_URL = "/instructor/list-class/learning-analysis?classId=60&courseId=7&scheduleId=sch-1&title=Bu%E1%BB%95i%201";
const detailUrl = (userId = "u-1", studentName = "Nguyễn Văn An") =>
  `/instructor/list-class/learning-analysis/detail?scheduleId=sch-1&userId=${userId}&studentEmail=an%40demo.invalid&classId=60&courseId=7&title=Bu%E1%BB%95i%201&studentName=${encodeURIComponent(studentName)}`;

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
  vi.stubEnv("NEXT_PUBLIC_WRITE_TEACHER_NOTE", "");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  for (const fn of [listScheduleStudents, listStudentAttempts, getLessonDetail, getAttendanceAnalysis, getLatestTeacherNote, sendTeacherNote, getPersonalization, generatePersonalizationSnapshot, approvePersonalizationReport]) vi.mocked(fn).mockReset();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  nav.push.length = 0;
});

function renderWithShell(node: React.ReactNode) {
  render(
    <Provider store={makeStore({ status: "authenticated", user: teacher })}>
      <ManagementShell area="instructor">{node}</ManagementShell>
    </Provider>,
  );
}

// ================================================================ DANH SÁCH ================================================================
describe("màn Phân tích học tập — danh sách học viên của buổi", () => {
  const renderList = () => renderWithShell(<InstructorLearningAnalysisPageContent />);
  const rows = () => screen.queryAllByTestId("student-row");

  beforeEach(() => nav.set(LIST_URL));

  it("gọi listScheduleStudents(scheduleId, classId) một lần; giữ DOM: breadcrumb 2 liên kết, huy hiệu tiêu đề buổi, cột, STT, mã HV '-' khi thiếu, chữ cái đầu", async () => {
    vi.mocked(listScheduleStudents).mockResolvedValue(studentsFixture);
    renderList();
    await screen.findByText("Nguyễn Văn An");
    expect(listScheduleStudents).toHaveBeenCalledTimes(1);
    expect(listScheduleStudents).toHaveBeenCalledWith("sch-1", "60");
    expect(screen.getByRole("link", { name: "Danh sách lớp học" })).toHaveAttribute("href", "/instructor/list-class");
    expect(screen.getByRole("link", { name: "Danh sách bài học" })).toHaveAttribute("href", "/instructor/list-class/list-lesson?classId=60&courseId=7");
    expect(screen.getByText("Buổi 1")).toHaveClass("badge", "bg-danger");
    expect(screen.getByText("Phân tích học tập", { selector: ".card-header span" })).toHaveClass("fw-bold");
    expect(screen.getByText("Mã học viên")).toBeInTheDocument();
    expect(rows()).toHaveLength(3);
    expect(rows().map((r) => r.firstElementChild?.textContent)).toEqual(["1", "2", "3"]);
    expect(within(rows()[0]).getByText("HV0001")).toBeInTheDocument();
    expect(within(rows()[0]).getByText("an@demo.invalid")).toBeInTheDocument();
    expect(within(rows()[0]).getByText("NA")).toBeInTheDocument(); // Nguyễn … An
    expect(within(rows()[2]).getByText("-")).toBeInTheDocument(); // thiếu mã học viên
    expect(rows()[2].querySelector("img")).toHaveAttribute("src", "https://cdn.example.invalid/c.png"); // alt="" => không có role img
    expect((document.querySelector(".content > .container > .row") as HTMLElement).className).toBe("row");
  });

  it("tìm theo tên/email/mã học viên; không khớp => 'Chưa có học viên'", async () => {
    vi.mocked(listScheduleStudents).mockResolvedValue(studentsFixture);
    renderList();
    await screen.findByText("Nguyễn Văn An");
    const input = screen.getByPlaceholderText("Tìm theo tên, email, mã học viên");
    await userEvent.type(input, "hv0002");
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getByText("Trần Thị Bình")).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, "không ai");
    expect(rows()).toHaveLength(0);
    expect(screen.getByText("Chưa có học viên")).toBeInTheDocument();
  });

  it("nút 'Xem chi tiết' điều hướng sang /detail với query cũ (userId định danh; studentEmail/studentName chuyển tiếp)", async () => {
    vi.mocked(listScheduleStudents).mockResolvedValue(studentsFixture);
    renderList();
    await screen.findByText("Nguyễn Văn An");
    await userEvent.click(within(rows()[0]).getByRole("button", { name: "Xem chi tiết Nguyễn Văn An" }));
    expect(nav.push).toEqual([detailUrl()]);
  });

  it.each([
    ["/instructor/list-class/learning-analysis?classId=60&courseId=7", "mã buổi học (scheduleId)"],
    ["/instructor/list-class/learning-analysis?scheduleId=sch-1", "mã lớp (classId)"],
    ["/instructor/list-class/learning-analysis?classId=..%2Fadmin&scheduleId=sch-1", "Không hợp lệ: mã lớp (classId)"],
  ])("%s => thông báo tham số (%s), KHÔNG gọi API, không toast, không 'Chưa có học viên'", async (url, text) => {
    nav.set(url);
    renderList();
    expect(await screen.findByTestId("la-param-notice")).toHaveTextContent(text);
    expect(listScheduleStudents).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByText("Chưa có học viên")).toBeNull();
    expect(document.querySelector(".spinner-border")).toBeNull();
    expect(screen.getByRole("link", { name: "Danh sách bài học" })).toHaveAttribute("href", "/instructor/list-class"); // thiếu mã lớp => về danh sách lớp
  });

  it("đang tải: spinner; rỗng thật: 'Chưa có học viên' không khối lỗi", async () => {
    vi.mocked(listScheduleStudents).mockReturnValue(new Promise(() => {}));
    renderList();
    expect(document.querySelector(".spinner-border")).not.toBeNull();
    expect(screen.queryByText("Chưa có học viên")).toBeNull();
  });

  it("rỗng thật => 'Chưa có học viên'", async () => {
    vi.mocked(listScheduleStudents).mockResolvedValue([]);
    renderList();
    expect(await screen.findByText("Chưa có học viên")).toBeInTheDocument();
    expect(screen.queryByTestId("la-students-notice")).toBeNull();
  });

  it("dịch vụ chưa cấu hình => WAITING FOR BACKEND không toast; 403 => toast + khối lỗi + Thử lại tải lại; phản hồi không phải mảng => lỗi hợp đồng", async () => {
    vi.mocked(listScheduleStudents).mockRejectedValueOnce(new ApiNotConfiguredError());
    renderList();
    let notice = await screen.findByTestId("la-students-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(notice).toHaveTextContent("WAITING FOR BACKEND");
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByText("Chưa có học viên")).toBeNull();

    nav.set(`${LIST_URL}&x=1`); // đổi khoá? không — khoá chỉ gồm lớp+buổi, nên Thử lại mới tải lại
    vi.mocked(listScheduleStudents).mockRejectedValueOnce(new ApiError("Bạn không có quyền thực hiện thao tác này.", 403)).mockResolvedValueOnce({ items: [] } as never).mockResolvedValue(studentsFixture);
    await act(async () => nav.set(`${LIST_URL.replace("sch-1", "sch-2")}`));
    notice = await screen.findByTestId("la-students-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(toast.error).toHaveBeenCalledWith("Bạn không có quyền thực hiện thao tác này.");
    await userEvent.click(within(notice).getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByTestId("la-students-notice")).toHaveTextContent("không đúng định dạng danh sách học viên");
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Nguyễn Văn An")).toBeInTheDocument();
    expect(listScheduleStudents).toHaveBeenLastCalledWith("sch-2", "60");
  });
});

// ================================================================ CHI TIẾT ================================================================
describe("màn Chi tiết phân tích học tập của một học viên", () => {
  const renderDetail = () => renderWithShell(<InstructorLearningAnalysisDetailPageContent />);
  const charts = () => screen.queryAllByTestId("apex-chart");
  const chartOf = (type: string) => charts().find((c) => c.dataset.type === type);

  const happyMocks = () => {
    vi.mocked(getLessonDetail).mockResolvedValue(lessonFixture);
    vi.mocked(listStudentAttempts).mockResolvedValue(attemptsFixture);
    vi.mocked(listScheduleStudents).mockResolvedValue(studentsFixture);
    vi.mocked(getAttendanceAnalysis).mockResolvedValue(attendanceFixture);
    vi.mocked(getLatestTeacherNote).mockResolvedValue(null);
    vi.mocked(getPersonalization).mockResolvedValue(personalizationDraftFixture);
  };

  beforeEach(() => nav.set(detailUrl()));

  it("tải 5 nguồn với đúng tham số (userId, không email); header, tổng bài đã làm, nhóm bài tập, biểu đồ chuyên cần + ô điểm danh, bảng điểm danh, biểu đồ kỹ năng, panel AI, nhận xét", async () => {
    happyMocks();
    renderDetail();
    expect(await screen.findByText("7/10")).toBeInTheDocument();
    expect(getLessonDetail).toHaveBeenCalledWith("sch-1", "60", "Buổi 1");
    expect(listStudentAttempts).toHaveBeenCalledWith("sch-1", "u-1", "60");
    expect(listScheduleStudents).toHaveBeenCalledWith("sch-1", "60");
    expect(getAttendanceAnalysis).toHaveBeenCalledWith("60", "sch-1", "u-1");
    expect(getLatestTeacherNote).toHaveBeenCalledWith("60", "sch-1", "u-1");
    expect(getPersonalization).toHaveBeenCalledWith("sch-1", "u-1", "60");
    for (const fn of [getLessonDetail, listStudentAttempts, listScheduleStudents, getAttendanceAnalysis, getLatestTeacherNote, getPersonalization]) expect(fn).toHaveBeenCalledTimes(1);

    // breadcrumb + header
    expect(screen.getByRole("link", { name: "Phân tích học tập" })).toHaveAttribute("href", "/instructor/list-class/learning-analysis?classId=60&courseId=7&scheduleId=sch-1&title=Bu%E1%BB%95i%201");
    expect(screen.getByText("Nguyễn Văn An", { selector: ".fw-bold" })).toBeInTheDocument();
    expect(screen.getByText("NA")).toBeInTheDocument();
    expect(screen.getByTestId("assignment-summary")).toHaveTextContent("Bài tập buổi này: 1/2 đã làm");

    // bài tập theo nhóm
    expect(screen.getAllByTestId("assignment-group").map((g) => g.firstElementChild?.textContent)).toEqual(["#1 Quiz - Nghe", "#2 Quiz - Đọc"]);
    const assignmentRows = screen.getAllByTestId("assignment-row");
    expect(assignmentRows.map((r) => r.dataset.status)).toEqual(["DONE", "NOT_STARTED"]);
    expect(within(assignmentRows[1]).getByText("Chưa làm")).toBeInTheDocument();

    // biểu đồ chuyên cần + ô điểm danh
    const line = chartOf("line");
    expect(line?.dataset.categories).toBe(JSON.stringify(["Buổi 1", "Buổi 2", "Buổi 3"]));
    expect(JSON.parse(line?.dataset.series ?? "[]")).toEqual([
      { name: "Học viên", data: [100, 50, null] },
      { name: "Trung bình lớp", data: [90, 85, null] },
    ]);
    const chips = within(screen.getByTestId("attendance-chips")).getAllByTitle(/Buổi/);
    expect(chips.map((c) => c.textContent)).toEqual(["1", "2", "3"]);
    expect(chips[1]).toHaveAttribute("title", "Buổi 2 (2026-10-04): Vắng — Vắng không phép");
    expect(chips[1].style.background).toBe("rgb(208, 59, 59)");
    expect(chips[0].style.background).toBe("rgb(12, 163, 12)");

    // bảng lịch sử điểm danh
    const table = within(screen.getByTestId("attendance-log"));
    expect(table.getAllByRole("row")).toHaveLength(4); // header + 3
    expect(table.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell").map((c) => c.textContent))).toEqual([
      ["Buổi 1", "2026-10-01", "Có mặt", "-"],
      ["Buổi 2", "2026-10-04", "Vắng", "Vắng không phép"],
      ["Buổi 3", "-", "Đi muộn", "Đi muộn 10 phút"],
    ]);
    expect(table.getByText("Vắng")).toHaveClass("bg-danger-subtle", "text-danger");

    // biểu đồ kỹ năng (bản cũ không render)
    const bar = chartOf("bar");
    expect(bar?.dataset.categories).toBe(JSON.stringify(["Nghe"]));
    expect(JSON.parse(bar?.dataset.series ?? "[]")).toEqual([
      { name: "Học viên", data: [70] },
      { name: "Trung bình lớp", data: [80] },
    ]);

    // panel AI
    const panel = within(screen.getByTestId("personalization-panel"));
    expect(panel.getByText("Đủ dữ liệu")).toBeInTheDocument();
    expect(panel.getByTestId("ai-summary")).toHaveTextContent("Học viên nên luyện thêm phần đọc hiểu đoạn văn.");
    expect(panel.getByText("Kỹ năng Đọc", { selector: "li" })).toBeInTheDocument();
    expect(panel.getByRole("button", { name: /Duyệt nhận xét/ })).toBeInTheDocument();
    expect(panel.queryByRole("button", { name: /Tạo nhận xét AI/ })).toBeNull();
    expect(panel.getByTestId("ai-recommendation")).toHaveTextContent("Đang chờ giáo viên duyệt và giao bài.");
    expect(panel.getByText("Chưa có nhận xét nào được gửi cho buổi học này.")).toBeInTheDocument();
  });

  it("công tắc teacher-note ĐÓNG (không demo, không cờ): ô nhập + nút Gửi/Duyệt bị khoá, có WriteLockedNotice, không request ghi", async () => {
    happyMocks();
    renderDetail();
    await screen.findByText("7/10");
    expect(screen.getByPlaceholderText("Nhập nhận xét dành cho học viên...")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Gửi nhận xét" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Duyệt nhận xét/ })).toBeDisabled();
    expect(screen.getAllByTestId("write-locked")).toHaveLength(2);
    expect(sendTeacherNote).not.toHaveBeenCalled();
    expect(approvePersonalizationReport).not.toHaveBeenCalled();
  });

  it("demo: gửi nhận xét => sendTeacherNote(classId, scheduleId, userId, nội dung đã trim, demo=true), tải lại nhận xét, xoá ô nhập, toast; rỗng => toast lỗi không gọi", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "1");
    happyMocks();
    vi.mocked(getLatestTeacherNote).mockResolvedValueOnce(null).mockResolvedValue({ content: "Em làm tốt", sentAt: "2026-10-27T08:00:00Z", author: "GV" });
    vi.mocked(sendTeacherNote).mockResolvedValue({ content: "Em làm tốt" });
    renderDetail();
    await screen.findByText("Chưa có nhận xét nào được gửi cho buổi học này.");
    expect(screen.queryByTestId("write-locked")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Gửi nhận xét" }));
    expect(toast.error).toHaveBeenCalledWith("Nhập nội dung nhận xét trước khi gửi");
    expect(sendTeacherNote).not.toHaveBeenCalled();

    const textarea = screen.getByPlaceholderText("Nhập nhận xét dành cho học viên...");
    await userEvent.type(textarea, "  Em làm tốt  ");
    await userEvent.click(screen.getByRole("button", { name: "Gửi nhận xét" }));
    expect(sendTeacherNote).toHaveBeenCalledWith("60", "sch-1", "u-1", "Em làm tốt", true);
    expect(await screen.findByText("Em làm tốt")).toBeInTheDocument();
    expect(screen.getByText("Đã gửi cho học viên")).toBeInTheDocument();
    expect(textarea).toHaveValue("");
    expect(getLatestTeacherNote).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith("Đã gửi nhận xét cho học viên");
  });

  it("demo: gửi nhận xét thất bại => toast lỗi của API, giữ nội dung đã gõ", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "1");
    happyMocks();
    vi.mocked(sendTeacherNote).mockRejectedValue(new ApiError("Nội dung nhận xét phải từ 1 đến 2000 ký tự (MOCK)", 400));
    renderDetail();
    await screen.findByText("7/10");
    await userEvent.type(screen.getByPlaceholderText("Nhập nhận xét dành cho học viên..."), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Gửi nhận xét" }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nội dung nhận xét phải từ 1 đến 2000 ký tự (MOCK)"));
    expect(screen.getByPlaceholderText("Nhập nhận xét dành cho học viên...")).toHaveValue("abc");
    expect(getLatestTeacherNote).toHaveBeenCalledTimes(1);
  });

  it("demo: chưa có snapshot => nút 'Tạo nhận xét AI'; bấm => generatePersonalizationSnapshot(scheduleId, userId, classId, false, true), tải lại, toast theo result", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "1");
    happyMocks();
    vi.mocked(getPersonalization).mockResolvedValueOnce(personalizationNoSnapshotFixture).mockResolvedValue(personalizationDraftFixture);
    vi.mocked(generatePersonalizationSnapshot).mockResolvedValue({ result: "CREATED", snapshot: { id: "snap-1", version: 1 } });
    renderDetail();
    expect(await screen.findByText("Chưa có nhận xét AI cho buổi học này.")).toBeInTheDocument();
    expect(screen.getByText("Chưa có bài tập củng cố được đề xuất cho buổi học này.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Tạo nhận xét AI/ }));
    expect(generatePersonalizationSnapshot).toHaveBeenCalledWith("sch-1", "u-1", "60", false, true);
    expect(await screen.findByRole("button", { name: /Duyệt nhận xét/ })).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Đã tạo nhận xét AI cho buổi học này");
    expect(getPersonalization).toHaveBeenCalledTimes(2);
  });

  it("demo: duyệt báo cáo => approvePersonalizationReport(..., reportId, true); sau tải lại hiện bài tập đã giao (gộp theo sessionCode), hết nút Duyệt", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "1");
    happyMocks();
    vi.mocked(getPersonalization).mockResolvedValueOnce(personalizationDraftFixture).mockResolvedValue(personalizationApprovedFixture);
    vi.mocked(approvePersonalizationReport).mockResolvedValue({ reportId: "rep-1", state: "APPROVED" });
    renderDetail();
    await userEvent.click(await screen.findByRole("button", { name: /Duyệt nhận xét/ }));
    expect(approvePersonalizationReport).toHaveBeenCalledWith("sch-1", "u-1", "60", "rep-1", true);
    const task = await screen.findByTestId("ai-task");
    expect(screen.getAllByTestId("ai-task")).toHaveLength(1); // 2 bài cùng sessionCode => 1 thẻ
    expect(task).toHaveTextContent("Bài củng cố: Kỹ năng Đọc");
    expect(task).toHaveTextContent("Nội dung cần củng cố: Kỹ năng Đọc, Từ vựng bài 1");
    expect(within(task).getByText("Đã giao")).toBeInTheDocument();
    expect(within(task).getByRole("link", { name: /Xem bài tập/ })).toHaveAttribute("href", "https://exam.demo.invalid/practice?sessionCode=CNH-1");
    expect(screen.queryByRole("button", { name: /Duyệt nhận xét/ })).toBeNull();
    expect(toast.success).toHaveBeenCalledWith("Đã duyệt nhận xét AI cho buổi học này");
  });

  it("demo: tạo snapshot thất bại (AI không xác nhận) => toast lỗi, không tải lại", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "1");
    happyMocks();
    vi.mocked(getPersonalization).mockResolvedValue(personalizationNoSnapshotFixture);
    vi.mocked(generatePersonalizationSnapshot).mockRejectedValue(new ApiError("AI-CNH không xác nhận đã tạo hoặc tìm thấy snapshot cho buổi học này.", 200, "UNCONFIRMED_SNAPSHOT_MUTATION"));
    renderDetail();
    await userEvent.click(await screen.findByRole("button", { name: /Tạo nhận xét AI/ }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("AI-CNH không xác nhận đã tạo hoặc tìm thấy snapshot cho buổi học này."));
    expect(getPersonalization).toHaveBeenCalledTimes(1);
  });

  it("mỗi khối báo lỗi riêng: bài tập (toast + khối lỗi, tổng '–/–'), chuyên cần 403, kỹ năng WAITING, AI lỗi có Thử lại, nhận xét lỗi có Thử lại", async () => {
    vi.mocked(getLessonDetail).mockRejectedValue(new ApiError("Lỗi bài học", 500));
    vi.mocked(listStudentAttempts).mockResolvedValue(attemptsFixture);
    vi.mocked(listScheduleStudents).mockRejectedValue(new ApiNotConfiguredError());
    vi.mocked(getAttendanceAnalysis).mockRejectedValue(new ApiError("Bạn không có quyền thực hiện thao tác này.", 403));
    vi.mocked(getPersonalization).mockRejectedValueOnce(new ApiError("Hệ thống đang tạm thời gián đoạn.", 500)).mockResolvedValue(personalizationDraftFixture);
    vi.mocked(getLatestTeacherNote).mockRejectedValueOnce(new ApiError("Lỗi nhận xét", 500)).mockResolvedValue({ content: "Đã có" });
    renderDetail();

    expect(await screen.findByTestId("assignments-notice")).toHaveTextContent("Lỗi bài học");
    expect(toast.error).toHaveBeenCalledWith("Lỗi bài học");
    expect(screen.getByTestId("assignment-summary")).toHaveTextContent("–/–");
    expect(screen.queryByText("Buổi này chưa có bài tập (quiz).")).toBeNull();

    const attendanceNotice = await screen.findByTestId("attendance-notice");
    expect(attendanceNotice).toHaveAttribute("data-kind", "error");
    expect(attendanceNotice).toHaveTextContent("không có quyền");
    expect(screen.queryByTestId("attendance-log")).toBeNull();
    expect(charts()).toHaveLength(0);

    const skillsNotice = await screen.findByTestId("skills-notice");
    expect(skillsNotice).toHaveAttribute("data-kind", "waiting");
    expect(skillsNotice).toHaveTextContent("WAITING FOR BACKEND");

    const aiNotice = await screen.findByTestId("ai-notice");
    expect(aiNotice).toHaveTextContent("gián đoạn");
    await userEvent.click(within(aiNotice).getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByTestId("ai-summary")).toBeInTheDocument();
    expect(getPersonalization).toHaveBeenCalledTimes(2);

    const noteNotice = screen.getByTestId("note-notice");
    expect(noteNotice).toHaveTextContent("Không tải được nhận xét đã gửi cho buổi học này.");
    await userEvent.click(within(noteNotice).getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Đã có")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledTimes(1); // chỉ bài tập toast như bản cũ; các khối khác báo tại chỗ
  });

  it("rỗng thật: không bài tập => 'Buổi này chưa có bài tập (quiz).' và 0/0; chuyên cần/kỹ năng rỗng => ẨN thẻ biểu đồ (như bản cũ), không có bảng điểm danh", async () => {
    happyMocks();
    vi.mocked(getLessonDetail).mockResolvedValue({ lessonTitle: "Buổi 1", modules: [] });
    vi.mocked(listStudentAttempts).mockResolvedValue([]);
    vi.mocked(getAttendanceAnalysis).mockResolvedValue({ trend: [], log: [] });
    vi.mocked(listScheduleStudents).mockResolvedValue([{ userId: "u-1", modules: [] }]);
    renderDetail();
    expect(await screen.findByText("Buổi này chưa có bài tập (quiz).")).toBeInTheDocument();
    expect(screen.getByTestId("assignment-summary")).toHaveTextContent("0/0");
    await vi.waitFor(() => expect(screen.queryByTestId("trend-card")).toBeNull());
    expect(screen.queryByTestId("skill-card")).toBeNull();
    expect(screen.queryByTestId("attendance-log")).toBeNull();
    expect(charts()).toHaveLength(0);
  });

  it("đang tải: spinner dưới header, thẻ biểu đồ hiện spinner (không ẩn), panel AI 'Đang tải...'", () => {
    const pending = <T,>() => new Promise<T>(() => {});
    vi.mocked(getLessonDetail).mockReturnValue(pending());
    vi.mocked(listStudentAttempts).mockReturnValue(pending());
    vi.mocked(listScheduleStudents).mockReturnValue(pending());
    vi.mocked(getAttendanceAnalysis).mockReturnValue(pending());
    vi.mocked(getLatestTeacherNote).mockReturnValue(pending());
    vi.mocked(getPersonalization).mockReturnValue(pending());
    renderDetail();
    expect(screen.getByTestId("assignment-summary")).toHaveTextContent("0/0");
    expect(within(screen.getByTestId("trend-card")).getByRole("status")).toBeInTheDocument();
    expect(within(screen.getByTestId("skill-card")).getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Đang tải nhận xét AI...")).toBeInTheDocument();
    expect(screen.getByText("Đang tải nhận xét đã gửi...")).toBeInTheDocument();
    expect(screen.queryByTestId("attendance-notice")).toBeNull();
  });

  it("thiếu userId => thông báo tham số, KHÔNG gọi API nào, không header học viên", async () => {
    nav.set("/instructor/list-class/learning-analysis/detail?scheduleId=sch-1&classId=60&courseId=7&title=B1");
    renderDetail();
    expect(await screen.findByTestId("la-param-notice")).toHaveTextContent("Thiếu mã học viên (userId)");
    for (const fn of [getLessonDetail, listStudentAttempts, listScheduleStudents, getAttendanceAnalysis, getLatestTeacherNote, getPersonalization]) expect(fn).not.toHaveBeenCalled();
    expect(screen.queryByTestId("assignment-summary")).toBeNull();
    expect(screen.queryByTestId("personalization-panel")).toBeNull();
    expect(screen.getByText("Chi tiết học viên")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Phân tích học tập" })).toHaveAttribute("href", "/instructor/list-class");
  });

  it("đổi học viên trên URL => gọi lại cho userId mới, không lẫn dữ liệu, bản nháp nhận xét về rỗng", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "1");
    happyMocks();
    vi.mocked(listStudentAttempts).mockImplementation((_s: string, userId: string) => Promise.resolve(userId === "u-1" ? attemptsFixture : []));
    renderDetail();
    await screen.findByText("7/10");
    await userEvent.type(screen.getByPlaceholderText("Nhập nhận xét dành cho học viên..."), "nháp");
    act(() => nav.set(detailUrl("u-2", "Trần Thị Bình")));
    expect(await screen.findByText("Trần Thị Bình", { selector: ".fw-bold" })).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByTestId("assignment-summary")).toHaveTextContent("0/2"));
    expect(screen.queryByText("7/10")).toBeNull();
    expect(listStudentAttempts).toHaveBeenLastCalledWith("sch-1", "u-2", "60");
    expect(getAttendanceAnalysis).toHaveBeenLastCalledWith("60", "sch-1", "u-2");
    expect(screen.getByPlaceholderText("Nhập nhận xét dành cho học viên...")).toHaveValue("");
  });
});
