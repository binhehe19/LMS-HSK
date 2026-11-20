import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InstructorClassListPageContent } from "@/components/management/instructor-class-list/instructor-class-list-page-content";
import { ManagementShell } from "@/components/management/management-shell";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { listTeacherGradingClasses } from "@/lib/api/quiz-grading-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { GradingClassResponse } from "@/types/grading";
import { adminUser } from "./fixtures/classes";

vi.mock("next/navigation", () => ({ usePathname: () => "/instructor/list-class", useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/notification-client", () => ({ getUnreadCount: vi.fn(), fetchNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
vi.mock("@/lib/api/quiz-grading-client", () => ({ listAdminGradingClasses: vi.fn(), listTeacherGradingClasses: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

vi.setConfig({ testTimeout: 30_000 });

const teacher = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "gv1@example.test", roles: ["ROLE_TEACHER"] };
const cls = (i: number, over: Partial<GradingClassResponse> = {}): GradingClassResponse => ({
  classId: `c${i}`, classCode: `MA${String(i).padStart(2, "0")}`, className: `Lớp ${i}`, courseName: "H20", courseId: "course-1", teacherName: "Đỗ Thị Mỹ Hà", teacherEmail: "ha@example.test",
  studentCount: 10 + i, startDate: "2026-09-01", endDate: "2026-12-31", ...over,
});

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(listTeacherGradingClasses).mockReset();
  vi.mocked(toast.error).mockClear();
});

function renderPage() {
  render(
    <Provider store={makeStore({ status: "authenticated", user: teacher })}>
      <ManagementShell area="instructor">
        <InstructorClassListPageContent />
      </ManagementShell>
    </Provider>,
  );
}

const rows = () => screen.queryAllByTestId("class-row");
const codes = () => rows().map((r) => within(r).getAllByRole("cell")[1].textContent);

describe("màn Quản lý lớp học của Giảng viên — có dữ liệu", () => {
  it("dùng bố cục bảng chung và giữ liên kết mã lớp đến danh sách buổi học", async () => {
    vi.mocked(listTeacherGradingClasses).mockResolvedValue([cls(1, { classId: "60", classCode: "GS020", courseId: "c 1", teacherName: "Đỗ Thị Mỹ Hà", startDate: "16/04/2025" })]);
    renderPage();
    const link = await screen.findByRole("link", { name: "GS020" });
    expect(link).toHaveAttribute("href", "/instructor/list-class/list-lesson?classId=60&courseId=c%201");
    expect((document.querySelector(".content > .container > .row") as HTMLElement).className).toBe("row");
    expect(screen.getByRole("heading", { name: "Chấm bài" })).toBeInTheDocument();
    expect([...document.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["STT", "Mã lớp", "Khóa học", "Giáo viên", "Ngày bắt đầu", "Ngày kết thúc dự kiến", "Số học viên", "Bài chưa chấm"]);
    const row = rows()[0];
    expect(within(row).getByText("ĐH")).toBeInTheDocument(); // chữ cái đầu của họ và tên cuối
    expect(within(row).getByText("ha@example.test")).toBeInTheDocument();
    expect(within(row).getByText("16/04/2025")).toBeInTheDocument(); // ngày hiển thị nguyên văn
    expect(screen.getByText("1 bản ghi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xóa bộ lọc" })).toBeInTheDocument();
  });

  it("ô thiếu dữ liệu hiện '-'; lớp còn bài chưa chấm hiện chấm đỏ, không còn hiện dấu ✓", async () => {
    vi.mocked(listTeacherGradingClasses).mockResolvedValue([cls(1, { teacherName: undefined, teacherEmail: undefined, studentCount: undefined, hasPendingGrading: true }), cls(2)]);
    renderPage();
    await screen.findByText("MA01");
    const cells = within(rows()[0]).getAllByRole("cell");
    expect(cells[3].textContent).toContain("-"); // giáo viên
    expect(cells[6].textContent).toBe("-"); // số học viên
    expect(cells[7].querySelector(".cm-dot-badge")).toHaveTextContent("*");
    expect(within(rows()[1]).getAllByRole("cell")[7].querySelector(".badge")).toHaveTextContent("✓");
    expect(within(rows()[0]).getByText("?")).toBeInTheDocument(); // không có tên => "?"
  });

  it("lớp còn bài chờ chấm được đưa lên đầu (ổn định), STT theo vị trí sau sắp xếp", async () => {
    vi.mocked(listTeacherGradingClasses).mockResolvedValue([cls(1), cls(2, { hasPendingGrading: true }), cls(3), cls(4, { hasPendingGrading: true })]);
    renderPage();
    await screen.findByText("MA01");
    expect(codes()).toEqual(["MA02", "MA04", "MA01", "MA03"]);
    expect(rows().map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual(["1", "2", "3", "4"]);
  });

  it("lọc khoá học và lớp độc lập hoặc cùng nhau; đổi khoá xoá lớp đã chọn; tuỳ chọn lớp theo khoá (port bản cũ)", async () => {
    vi.mocked(listTeacherGradingClasses).mockResolvedValue([
      { classId: "a", classCode: "H2001", className: "Lớp A", courseName: "H20" },
      { classId: "b", classCode: "H2002", className: "Lớp B", courseName: "H20" },
      { classId: "c", classCode: "GT101", className: "Lớp C", courseName: "GT1" },
    ]);
    renderPage();
    await screen.findByText("H2001");
    const course = screen.getByLabelText("Khóa học");
    const classFilter = screen.getByLabelText("Mã lớp");
    expect(within(course).getAllByRole("option").map((o) => o.textContent)).toEqual(["Tất cả khóa học", "GT1", "H20"]); // sắp theo tiếng Việt
    fireEvent.change(course, { target: { value: "name:h20" } });
    expect(codes()).toEqual(["H2001", "H2002"]);
    expect(within(classFilter).queryByRole("option", { name: /Lớp C/ })).not.toBeInTheDocument();
    fireEvent.change(classFilter, { target: { value: "b" } });
    expect(codes()).toEqual(["H2002"]);
    fireEvent.change(course, { target: { value: "" } });
    expect(classFilter).toHaveValue("");
    fireEvent.change(classFilter, { target: { value: "c" } });
    expect(codes()).toEqual(["GT101"]);
    expect(within(classFilter).getByRole("option", { name: "Lớp C (GT101)" })).toBeInTheDocument(); // "nhãn (mã)" khi nhãn khác mã
  });

  it("thời gian: 'Ngày chính xác' hiện ô ngày mặc định hôm nay; kết hợp khoá/lớp; ngày không khớp => 'Không có lớp phù hợp bộ lọc' (port bản cũ)", async () => {
    vi.mocked(listTeacherGradingClasses).mockResolvedValue([
      { classId: "a", classCode: "H2001", className: "Lớp A", courseName: "H20", startDate: "25/09/2026", endDate: "30/09/2026" },
      { classId: "b", classCode: "H2002", className: "Lớp B", courseName: "H20", startDate: "01/10/2026", endDate: "31/10/2026" },
      { classId: "c", classCode: "GT101", className: "Lớp C", courseName: "GT1", startDate: "28/09/2026", endDate: "29/09/2026" },
    ]);
    renderPage();
    await screen.findByText("H2001");
    expect(screen.queryByLabelText("Chọn ngày chính xác")).toBeNull();
    fireEvent.change(screen.getByLabelText("Thời gian"), { target: { value: "EXACT" } });
    const date = screen.getByLabelText("Chọn ngày chính xác") as HTMLInputElement;
    expect(date.value).toMatch(/^\d{4}-\d{2}-\d{2}$/); // mặc định: hôm nay
    fireEvent.change(date, { target: { value: "2026-09-28" } });
    expect(codes().sort()).toEqual(["GT101", "H2001"]);
    fireEvent.change(screen.getByLabelText("Khóa học"), { target: { value: "name:h20" } });
    fireEvent.change(screen.getByLabelText("Mã lớp"), { target: { value: "a" } });
    expect(codes()).toEqual(["H2001"]);
    fireEvent.change(date, { target: { value: "2026-10-02" } });
    expect(screen.getByText("Không có lớp phù hợp bộ lọc")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Thời gian"), { target: { value: "" } }); // 'Mọi thời gian' ẩn ô ngày
    expect(screen.queryByLabelText("Chọn ngày chính xác")).toBeNull();
    expect(codes()).toEqual(["H2001"]);
  });

  it("phân trang 20/trang (25 lớp = 2 trang): chuyển trang đúng, STT liên tục, tổng số; đổi bộ lọc về trang 1", async () => {
    vi.mocked(listTeacherGradingClasses).mockResolvedValue(Array.from({ length: 25 }, (_, i) => cls(i + 1, { courseName: i < 20 ? "H20" : "GT1" })));
    renderPage();
    await screen.findByText("MA01");
    expect(rows()).toHaveLength(20);
    expect(screen.getByText("25 bản ghi")).toBeInTheDocument();
    const pager = () => document.querySelector(".ant-pagination") as HTMLElement;
    expect([...pager().querySelectorAll(".ant-pagination-item")].map((i) => i.textContent)).toEqual(["1", "2"]);
    await userEvent.click(within(pager()).getByTitle("2"));
    expect(codes()).toEqual(["MA21", "MA22", "MA23", "MA24", "MA25"]);
    expect(within(rows()[0]).getAllByRole("cell")[0].textContent).toBe("21");
    fireEvent.change(screen.getByLabelText("Khóa học"), { target: { value: "name:h20" } }); // 20 lớp, về trang 1
    expect(within(rows()[0]).getAllByRole("cell")[0].textContent).toBe("1");
    expect(pager().querySelector(".ant-pagination-item-active")).toHaveTextContent("1");
    expect(screen.getByText("20 bản ghi")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    expect(screen.getByText("25 bản ghi")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: "Số dòng mỗi trang" }));
    await userEvent.click(await screen.findByText("50 / trang"));
    expect(rows()).toHaveLength(25);
  });
});

describe("màn Quản lý lớp học của Giảng viên — các trạng thái", () => {
  it("đang tải: spinner, không hiện 'Chưa có lớp được phân công' ở khung hình đầu", () => {
    vi.mocked(listTeacherGradingClasses).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(document.querySelector(".ant-spin-spinning")).not.toBeNull();
    expect(screen.queryByText("Chưa có lớp được phân công")).toBeNull();
  });

  it("rỗng thật: 'Chưa có lớp được phân công', không khối chờ backend", async () => {
    vi.mocked(listTeacherGradingClasses).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Chưa có lớp được phân công")).toBeInTheDocument();
    expect(screen.queryByTestId("class-list-notice")).toBeNull();
    expect(document.querySelector(".spinner-border")).toBeNull();
  });

  it("dịch vụ chưa cấu hình: khối WAITING FOR BACKEND, KHÔNG nói 'chưa có lớp', không toast lỗi", async () => {
    vi.mocked(listTeacherGradingClasses).mockRejectedValue(new ApiNotConfiguredError());
    renderPage();
    const notice = await screen.findByTestId("class-list-notice");
    expect(notice).toHaveAttribute("data-kind", "not-integrated");
    expect(notice).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.queryByText("Chưa có lớp được phân công")).toBeNull();
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("lỗi gọi API: toast như bản cũ + khối lỗi có 'Thử lại'; thử lại thành công hiện danh sách", async () => {
    vi.mocked(listTeacherGradingClasses).mockRejectedValueOnce(new ApiError("Máy chủ lỗi", 500)).mockResolvedValue([cls(1)]);
    renderPage();
    const notice = await screen.findByTestId("class-list-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(notice).toHaveTextContent("Máy chủ lỗi");
    expect(toast.error).toHaveBeenCalledWith("Máy chủ lỗi");
    expect(screen.queryByText("Chưa có lớp được phân công")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("MA01")).toBeInTheDocument();
    expect(screen.queryByTestId("class-list-notice")).toBeNull();
  });

  it("phản hồi không phải mảng => lỗi hợp đồng (bản cũ coi là rỗng)", async () => {
    vi.mocked(listTeacherGradingClasses).mockResolvedValue({ items: [] } as never);
    renderPage();
    const notice = await screen.findByTestId("class-list-notice");
    expect(notice).toHaveTextContent("không đúng định dạng");
    expect(screen.queryByText("Chưa có lớp được phân công")).toBeNull();
  });
});
