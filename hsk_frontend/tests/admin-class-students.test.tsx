import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminClassStudentsPageContent } from "@/components/management/admin-class-students/admin-class-students-page-content";
import { AdminClassStudentsView } from "@/components/management/admin-class-students/admin-class-students-view";
import { ManagementShell } from "@/components/management/management-shell";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { getAdminClass, listAdminClassStudents } from "@/lib/api/admin-class-source";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { AdminClassInfo, AdminClassStudent } from "@/types/admin-class";
import { adminUser, classesFixture } from "./fixtures/classes";

// URL giả có thể đổi trong từng test (useSearchParams đọc lúc render).
const nav = vi.hoisted(() => ({ url: "/admin/class-management/students?classId=fx-010", push: [] as string[] }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.url.split("?")[0],
  useSearchParams: () => new URLSearchParams(nav.url.split("?")[1] ?? ""),
  useRouter: () => ({ push: (to: string) => nav.push.push(to), replace: () => {}, back: () => {} }),
}));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/notification-client", () => ({ getUnreadCount: vi.fn(), fetchNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
vi.mock("@/lib/api/admin-class-source", () => ({ getAdminClass: vi.fn(), listAdminClassStudents: vi.fn(), listAdminClasses: vi.fn(), adminClassSource: () => "quiz" }));

// Lớp đã kết thúc (actualEndDate) để trạng thái không phụ thuộc ngày chạy test.
const classInfo: AdminClassInfo = { ...classesFixture[9], source: "quiz" }; // fx-010: HSK5-FX10, actualEndDate 2026-06-30
const student = (i: number, over: Partial<AdminClassStudent> = {}): AdminClassStudent => ({
  userId: `hv-${i}`,
  name: `Học viên ${i}`,
  email: `hv${i}@example.test`,
  phone: `0900 000 ${String(i).padStart(3, "0")}`,
  homeworkCompletionPercent: 80,
  qualityPercent: 55,
  ...over,
});
const twelve = Array.from({ length: 12 }, (_, i) => student(i + 1));

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  // Chuông ở sidebar không thuộc màn này: để lời gọi treo (không resolve) nên không có cập nhật state ngoài act() sau các test view đồng bộ.
  vi.mocked(getUnreadCount).mockReset().mockReturnValue(new Promise<number>(() => {}));
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(getAdminClass).mockReset().mockResolvedValue(classInfo);
  vi.mocked(listAdminClassStudents).mockReset().mockResolvedValue(twelve);
  nav.url = "/admin/class-management/students?classId=fx-010";
  nav.push.length = 0;
});

function wrap(node: React.ReactNode) {
  return render(
    <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
      <ManagementShell area="admin">{node}</ManagementShell>
    </Provider>,
  );
}
const renderPage = () => wrap(<AdminClassStudentsPageContent />);
const renderView = (info: FetchState<AdminClassInfo | null>, students: FetchState<AdminClassStudent[]>, onRetry = vi.fn()) =>
  wrap(<AdminClassStudentsView paramNotice={null} info={info} students={students} onRetry={onRetry} />);
const rows = () => screen.queryAllByTestId("acs-student-row");
const cells = (row: HTMLElement) => within(row).getAllByRole("cell").map((c) => c.textContent);

describe("màn Học viên của lớp (Admin) — có dữ liệu", () => {
  it("gọi 2 API với classId từ URL; dải thông tin lớp, breadcrumb, nút quay lại; bảng 7 cột đúng chữ bản cũ, phân trang 10 dòng, STT liên tục", async () => {
    renderPage();
    await screen.findByText("Danh sách học viên (12)");
    expect(getAdminClass).toHaveBeenCalledWith("fx-010");
    expect(listAdminClassStudents).toHaveBeenCalledWith("fx-010");
    expect(screen.getByRole("link", { name: /Quay lại Quản lý lớp học/ })).toHaveAttribute("href", "/admin/class-management");
    expect(screen.getByText("Lớp HSK5-FX10")).toBeInTheDocument();
    const strip = screen.getByTestId("acs-class-info");
    expect(strip).toHaveTextContent("HSK5-FX10");
    expect(strip).toHaveTextContent("HSK 5 cơ bản");
    expect(strip).toHaveTextContent("Lê Hoàng Cường");
    expect(strip).toHaveTextContent("T2, T4, T6 · 19:00 – 20:30");
    expect(strip).toHaveTextContent("15 học viên");
    expect(strip.querySelector(".acm-status-badge")).toHaveTextContent("Đã kết thúc");
    // nguồn HSK cũ: không có giáo trình/trợ giảng/QL học viên
    expect(screen.queryByTestId("acs-syllabus")).toBeNull();
    expect(screen.queryByTestId("acs-mentor")).toBeNull();
    expect([...document.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["STT", "Email học viên", "Tên học viên", "SĐT", "Số buổi đi học", "CC BTVN", "% Chất lượng BT"]);
    expect(rows()).toHaveLength(10);
    expect(cells(rows()[0])).toEqual(["1", "hv1@example.test", "Học viên 1", "0900 000 001", "—", "80%", "55%"]);
    expect(screen.getByText("Tổng 12 học viên")).toBeInTheDocument();
    await userEvent.click(document.querySelector(".ant-pagination-item-2") as HTMLElement);
    expect(rows()).toHaveLength(2);
    expect(cells(rows()[0])[0]).toBe("11");
    expect(document.querySelector(".content.acm-page-bg > .container > .row > .col-lg-9")).not.toBeNull();
    expect(document.querySelectorAll(".management-sidebar-column")).toHaveLength(1);
  });

  it("màu phần trăm theo ngưỡng bản cũ; thiếu số => '—'; nguồn backend chung: 'Số buổi đi học' = x/y và dải có giáo trình / trợ giảng / QL học viên", async () => {
    vi.mocked(getAdminClass).mockResolvedValue({ ...classInfo, source: "lms", syllabusName: "Giáo trình HSK 5", mentorName: "Lê Thu Hà", studentManagerName: "Phạm Thu Trang" });
    vi.mocked(listAdminClassStudents).mockResolvedValue([
      student(1, { attendancePresent: 7, attendanceTotal: 9, homeworkCompletionPercent: 70, qualityPercent: 49 }),
      student(2, { attendancePresent: 0, attendanceTotal: 0, homeworkCompletionPercent: undefined, qualityPercent: undefined, phone: undefined, email: undefined }),
    ]);
    renderPage();
    await screen.findByText("Danh sách học viên (2)");
    expect(screen.getByTestId("acs-class-info")).toHaveAttribute("data-source", "lms");
    expect(screen.getByTestId("acs-syllabus")).toHaveTextContent("Giáo trình: Giáo trình HSK 5");
    expect(screen.getByTestId("acs-mentor")).toHaveTextContent("Trợ giảng: Lê Thu Hà");
    expect(screen.getByTestId("acs-student-manager")).toHaveTextContent("QL học viên: Phạm Thu Trang");
    const [first, second] = rows();
    const firstCells = within(first).getAllByRole("cell");
    expect(firstCells[4]).toHaveTextContent("7/9");
    expect(firstCells[5].firstElementChild).toHaveClass("text-success");
    expect(firstCells[6].firstElementChild).toHaveClass("text-danger");
    expect(cells(second)).toEqual(["2", "—", "Học viên 2", "—", "—", "—", "—"]);
  });

  it("danh sách rỗng thật => 'Chưa có dữ liệu học viên cho lớp này' (không khối lỗi); lớp không tìm thấy (null hoặc 404) => cảnh báo của bản cũ, bảng vẫn tải", async () => {
    vi.mocked(getAdminClass).mockRejectedValue(new ApiError("Không tìm thấy dữ liệu được yêu cầu.", 404));
    vi.mocked(listAdminClassStudents).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByTestId("acs-info-missing")).toHaveTextContent("Không tìm thấy thông tin lớp học.");
    expect(await screen.findByTestId("acs-students-empty")).toHaveTextContent("Chưa có dữ liệu học viên cho lớp này");
    expect(screen.getByText("Danh sách học viên (0)")).toBeInTheDocument();
    expect(screen.queryByTestId("acs-info-notice")).toBeNull();
    expect(screen.queryByTestId("acs-students-notice")).toBeNull();
    expect(screen.queryByText(/Lớp HSK5/)).toBeNull(); // breadcrumb không có mã lớp
  });
});

describe("tham số URL thiếu/không hợp lệ — KHÔNG gọi API", () => {
  it.each([
    ["/admin/class-management/students", "missing-class"],
    ["/admin/class-management/students?classId=%20", "missing-class"],
    ["/admin/class-management/students?classId=..%2Fadmin", "invalid-class"],
    ["/admin/class-management/students?classId=a%3Fb", "invalid-class"],
  ])("%s => thông báo %s, không có lời gọi API, không spinner, vẫn có nút quay lại", async (url, kind) => {
    nav.url = url;
    renderPage();
    const notice = await screen.findByTestId("acs-param-notice");
    expect(notice).toHaveAttribute("data-kind", kind);
    expect(getAdminClass).not.toHaveBeenCalled();
    expect(listAdminClassStudents).not.toHaveBeenCalled();
    expect(document.querySelector(".ant-spin")).toBeNull();
    expect(screen.getByText(/Chọn một lớp ở "Quản lý lớp học"/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Quay lại Quản lý lớp học/ })).toHaveAttribute("href", "/admin/class-management");
  });

  it("đổi lớp trên URL => gọi lại cho lớp mới, không lẫn dữ liệu lớp cũ", async () => {
    let release: (v: AdminClassStudent[]) => void = () => {};
    vi.mocked(listAdminClassStudents).mockImplementation((id: string) => (id === "fx-010" ? Promise.resolve([student(1, { name: "Học viên lớp mười" })]) : new Promise((r) => (release = r))));
    const { rerender } = renderPage();
    await screen.findByText("Học viên lớp mười");
    nav.url = "/admin/class-management/students?classId=fx-011";
    rerender(
      <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
        <ManagementShell area="admin">
          <AdminClassStudentsPageContent />
        </ManagementShell>
      </Provider>,
    );
    await waitFor(() => expect(listAdminClassStudents).toHaveBeenLastCalledWith("fx-011"));
    expect(screen.queryByText("Học viên lớp mười")).toBeNull();
    await act(async () => release([student(2, { name: "Học viên lớp mười một" })]));
    expect(await screen.findByText("Học viên lớp mười một")).toBeInTheDocument();
  });
});

describe("trạng thái dữ liệu (view thuần + hook)", () => {
  it("đang tải: hai Spin, số lượng 0 như bản cũ", () => {
    renderView({ kind: "loading" }, { kind: "loading" });
    expect(document.querySelectorAll(".ant-spin")).toHaveLength(2);
    expect(screen.getByText("Danh sách học viên (0)")).toBeInTheDocument();
    expect(rows()).toHaveLength(0);
  });

  it("chưa tích hợp (cả hai nguồn chưa cấu hình): hai dòng WAITING FOR BACKEND, không 'Thử lại', số lượng '—'", async () => {
    vi.mocked(getAdminClass).mockRejectedValue(new ApiNotConfiguredError());
    vi.mocked(listAdminClassStudents).mockRejectedValue(new ApiNotConfiguredError());
    renderPage();
    const info = await screen.findByTestId("acs-info-notice");
    const students = await screen.findByTestId("acs-students-notice");
    expect(info).toHaveAttribute("data-kind", "waiting");
    expect(students).toHaveAttribute("data-kind", "waiting");
    expect(students).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
    expect(screen.getByText("Danh sách học viên (—)")).toBeInTheDocument();
    expect(screen.queryByText("Chưa có dữ liệu học viên cho lớp này")).toBeNull();
  });

  it("API học viên lỗi (403): khối lỗi + 'Thử lại' tải lại CẢ hai nguồn; KHÔNG hiện 'Chưa có dữ liệu học viên'", async () => {
    vi.mocked(listAdminClassStudents).mockRejectedValueOnce(new ApiError("Bạn không có quyền thực hiện thao tác này.", 403)).mockResolvedValue(twelve);
    renderPage();
    const notice = await screen.findByTestId("acs-students-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(notice).toHaveTextContent("không có quyền");
    expect(screen.queryByText("Chưa có dữ liệu học viên cho lớp này")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByText("Danh sách học viên (12)");
    expect(getAdminClass).toHaveBeenCalledTimes(2);
    expect(listAdminClassStudents).toHaveBeenCalledTimes(2);
  });

  it("phản hồi học viên không phải mảng => lỗi hợp đồng (bản cũ coi là rỗng)", async () => {
    vi.mocked(listAdminClassStudents).mockResolvedValue({ items: [] } as never);
    renderPage();
    expect(await screen.findByTestId("acs-students-notice")).toHaveTextContent("không đúng định dạng");
    expect(screen.queryByText("Chưa có dữ liệu học viên cho lớp này")).toBeNull();
  });

  it("view: lỗi thông tin lớp có 'Thử lại' riêng gọi onRetry; bảng vẫn hiện dữ liệu", async () => {
    const onRetry = vi.fn();
    renderView({ kind: "error", message: "Máy chủ lỗi" }, { kind: "ok", data: twelve }, onRetry);
    expect(screen.getByTestId("acs-info-notice")).toHaveTextContent("Máy chủ lỗi");
    expect(rows()).toHaveLength(10);
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
