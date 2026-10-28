import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManagementShell } from "@/components/management/management-shell";
import { OnlineCourseLeadsPageContent } from "@/components/management/online-course-leads/online-course-leads-page-content";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { listOnlineCourseLeads, listOnlineCourses } from "@/lib/api/online-course-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { OnlineCourseLead, OnlineCourseLeadPage } from "@/types/online-course";
import { adminUser } from "./fixtures/classes";

vi.mock("next/navigation", () => ({ usePathname: () => "/learning-path/online-course/leads", useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/notification-client", () => ({ getUnreadCount: vi.fn(), fetchNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
vi.mock("@/lib/api/online-course-client", () => ({ listOnlineCourseLeads: vi.fn(), listOnlineCourses: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const lead = (id: string, over: Partial<OnlineCourseLead> = {}): OnlineCourseLead => ({ id, courseCode: "H40", courseName: "HSK 4 online", fullName: `Học viên ${id}`, email: `${id}@example.test`, phone: `090${id}`, registeredAt: "2026-10-20T08:00:00.000Z", status: "PENDING", ...over });
const page = (content: OnlineCourseLead[], over: Partial<OnlineCourseLeadPage> = {}): OnlineCourseLeadPage => ({ content, totalElements: content.length, totalPages: 1, size: 20, number: 0, ...over });

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(listOnlineCourses).mockReset().mockResolvedValue([{ id: "oc-1", code: "H40", name: "HSK 4 online", courseType: "Group" }]);
  vi.mocked(listOnlineCourseLeads).mockReset().mockResolvedValue(page([lead("1"), lead("2", { status: "COMPLETED", courseCode: "GT1", courseName: "Giao tiếp 1", courseType: "1-1", note: "Gọi lại" })]));
  for (const fn of [toast.success, toast.error]) vi.mocked(fn).mockClear();
});

function renderPage() {
  render(
    <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
      <ManagementShell area="admin">
        <OnlineCourseLeadsPageContent />
      </ManagementShell>
    </Provider>,
  );
}

const rows = () => screen.getAllByRole("row").slice(1);

describe("màn Quản lý đăng ký khóa học online (chỉ đọc)", () => {
  it("gọi GET /leads trang 0 size 20 không tham số lọc; bảng đúng thứ tự cột; trạng thái và loại khoá từ từ điển; tổng/trang", async () => {
    renderPage();
    await screen.findByText("Học viên 1");
    expect(listOnlineCourseLeads).toHaveBeenCalledWith({ courseCode: undefined, from: undefined, to: undefined, page: 0, size: 20 });
    expect([...document.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["Học viên", "Liên hệ", "Nội dung đăng ký", "Loại khóa học", "Ngày đăng ký", "Trạng thái", "Ghi chú"]);
    const [first, second] = rows();
    expect(within(first).getByText("Chờ tư vấn")).toHaveClass("badge", "bg-info");
    expect(within(first).getAllByRole("cell")[3]).toHaveTextContent("Group"); // từ điển theo mã H40 (lead không có courseType)
    expect(within(second).getByText("Hoàn thành")).toHaveClass("bg-success");
    expect(within(second).getAllByRole("cell")[3]).toHaveTextContent("1-1"); // không có trong từ điển => courseType của lead
    expect(within(second).getByText("Gọi lại")).toBeInTheDocument();
    expect(screen.getByText("Tổng: 2 bản ghi")).toBeInTheDocument();
    expect(screen.getByText("Trang 1 / 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trước" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sau" })).toBeDisabled();
  });

  it("bộ lọc nháp chỉ gửi khi bấm 'Lọc' (courseCode cắt khoảng trắng); 'Xóa bộ lọc' gửi lại không tham số", async () => {
    renderPage();
    await screen.findByText("Học viên 1");
    await userEvent.type(screen.getByLabelText("Mã khóa học"), "  H40 ");
    expect(listOnlineCourseLeads).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Lọc" }));
    await waitFor(() => expect(listOnlineCourseLeads).toHaveBeenLastCalledWith({ courseCode: "H40", from: undefined, to: undefined, page: 0, size: 20 }));
    await userEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    await waitFor(() => expect(listOnlineCourseLeads).toHaveBeenLastCalledWith({ courseCode: undefined, from: undefined, to: undefined, page: 0, size: 20 }));
    expect((screen.getByLabelText("Mã khóa học") as HTMLInputElement).value).toBe("");
  });

  it("phân trang máy chủ: 'Sau' gọi trang kế, 'Trước' quay lại; nhãn 'Trang x / y' theo phản hồi", async () => {
    vi.mocked(listOnlineCourseLeads).mockImplementation(async (q) => page([lead(`p${q.page}`)], { totalElements: 45, totalPages: 3, number: q.page }));
    renderPage();
    await screen.findByText("Học viên p0");
    expect(screen.getByText("Trang 1 / 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sau" }));
    await screen.findByText("Học viên p1");
    expect(listOnlineCourseLeads).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
    expect(screen.getByText("Trang 2 / 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Trước" }));
    await screen.findByText("Học viên p0");
    expect(screen.getByText("Tổng: 45 bản ghi")).toBeInTheDocument();
  });

  it("trạng thái lọc phía client trên trang hiện tại (không gọi API); 'Xuất CSV' tải file các dòng đang hiển thị", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const createObjectURL = vi.fn((_blob: Blob) => "blob:leads");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    renderPage();
    await screen.findByText("Học viên 1");
    await userEvent.selectOptions(screen.getByLabelText("Trạng thái"), "COMPLETED");
    expect(rows()).toHaveLength(1);
    expect(screen.getByText("Học viên 2")).toBeInTheDocument();
    expect(listOnlineCourseLeads).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Xuất CSV" }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as unknown as Blob;
    expect(blob.type).toBe("text/csv;charset=utf-8");
    // jsdom Blob không có .text(): đọc bằng FileReader
    const csv = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    expect(csv).toContain("Học viên 2");
    expect(csv).not.toContain("Học viên 1");
    expect(click).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Đã xuất CSV 1 đăng ký đang hiển thị");
    await userEvent.selectOptions(screen.getByLabelText("Trạng thái"), "CANCELED");
    expect(screen.getByText("Chưa có đăng ký nào")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xuất CSV" })).toBeDisabled();
  });

  it("dịch vụ chưa cấu hình => WAITING FOR BACKEND (không toast); lỗi API => toast + khối lỗi, nút trang bị khoá", async () => {
    vi.mocked(listOnlineCourseLeads).mockRejectedValueOnce(new ApiNotConfiguredError());
    renderPage();
    expect(await screen.findByTestId("leads-notice")).toHaveAttribute("data-kind", "waiting");
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sau" })).toBeDisabled();
  });

  it("lỗi API => toast thông điệp (như bản cũ) + khối lỗi có Thử lại", async () => {
    vi.mocked(listOnlineCourseLeads).mockRejectedValueOnce(new ApiError("Bạn không có quyền thực hiện thao tác này.", 403)).mockResolvedValue(page([lead("ok")]));
    renderPage();
    const notice = await screen.findByTestId("leads-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(toast.error).toHaveBeenCalledWith("Bạn không có quyền thực hiện thao tác này.");
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Học viên ok")).toBeInTheDocument();
  });
});
