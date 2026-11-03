import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManagementShell } from "@/components/management/management-shell";
import { OnlineCourseManagementPageContent } from "@/components/management/online-course-management/online-course-management-page-content";
import { confirmAction } from "@/components/shared/confirm-action";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { deleteOnlineCourse, getOnlineCourse, getOnlineCourseFullDetail, getOnlineSyllabus, getOnlineSyncJob, listOnlineCourses, startOnlineSync, updateOnlineCourse } from "@/lib/api/online-course-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { OnlineCourseSummary } from "@/types/online-course";
import { adminUser } from "./fixtures/classes";

vi.mock("next/navigation", () => ({ usePathname: () => "/online-course/manage", useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/notification-client", () => ({ getUnreadCount: vi.fn(), fetchNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
vi.mock("@/lib/api/online-course-client", () => ({
  listOnlineCourses: vi.fn(),
  getOnlineCourse: vi.fn(),
  getOnlineCourseFullDetail: vi.fn(),
  getOnlineSyllabus: vi.fn(),
  getOnlineSyncJob: vi.fn(),
  updateOnlineCourse: vi.fn(),
  deleteOnlineCourse: vi.fn(),
  startOnlineSync: vi.fn(),
  listOnlineCourseLeads: vi.fn(),
}));
// Quy ước của repo: antd Modal.confirm (tĩnh) được mock qua confirmAction và kiểm tra tham số gọi (xem tests/teacher-management-view.test.tsx).
vi.mock("@/components/shared/confirm-action", () => ({ confirmAction: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

const course =(id: string, over: Partial<OnlineCourseSummary> = {}): OnlineCourseSummary => ({ id, code: `C-${id}`, name: `Khóa ${id}`, courseType: "Group", price: 2_500_000, rating: 4.5, level: "HSK3", totalLessons: 10, cmsSynced: true, syllabusId: `syl-${id}`, ...over });
const fixtures = [course("a"), course("b", { courseType: "1-1", cmsSynced: false, price: 1_800_000 }), course("c", { price: 3_900_000, cmsSynced: false })];

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.stubEnv("NEXT_PUBLIC_WRITE_ONLINE_COURSE", "");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(listOnlineCourses).mockReset().mockResolvedValue(fixtures);
  vi.mocked(getOnlineCourse).mockReset();
  vi.mocked(getOnlineCourseFullDetail).mockReset();
  vi.mocked(getOnlineSyllabus).mockReset();
  vi.mocked(getOnlineSyncJob).mockReset().mockReturnValue(new Promise(() => {}));
  vi.mocked(updateOnlineCourse).mockReset();
  vi.mocked(deleteOnlineCourse).mockReset();
  vi.mocked(startOnlineSync).mockReset();
  vi.mocked(confirmAction).mockReset().mockResolvedValue(true);
  for (const fn of [toast.success, toast.error, toast.info]) vi.mocked(fn).mockClear();
});

/** antd Modal giữ DOM sau khi đóng (ẩn bằng display:none ở .ant-modal-wrap) nên kiểm tra "không hiển thị" thay vì "không tồn tại". */
const expectSyncModalHidden = () =>
  waitFor(() => {
    const el = screen.queryByTestId("onl-sync-modal");
    if (el) expect(el).not.toBeVisible();
  });

function renderPage() {
  render(
    <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
      <ManagementShell area="admin">
        <OnlineCourseManagementPageContent />
      </ManagementShell>
    </Provider>,
  );
}

const cards = () => screen.queryAllByTestId("onl-course-card");
const cardTitles = () => cards().map((c) => c.querySelector(".course-title")?.textContent);

describe("màn Quản lý khóa học trực tuyến — danh sách", () => {
  it("4 thẻ thống kê, khung .online-course-mgmt-container, lưới card với huy hiệu nguồn/loại, giá vi-VN, số kết quả", async () => {
    renderPage();
    await screen.findByText("Khóa a");
    expect(screen.getAllByTestId("onl-stat-card").map((c) => c.textContent)).toEqual(["3Tổng số lượng", "1Khóa đã đồng bộ", "2Nhóm", "11-1"]);
    expect(document.querySelector(".content.online-course-mgmt-container")).not.toBeNull();
    expect(cards()).toHaveLength(3);
    expect(screen.getByText("Tìm thấy", { exact: false }).textContent).toBe("Tìm thấy 3 / 3 khóa học");
    const first = cards()[0];
    expect(within(first).getByText("Đã đồng bộ")).toHaveClass("status-badge", "synced");
    expect(within(first).getByText("Khóa Nhóm")).toHaveClass("type-badge");
    expect(within(first).getByText("2.500.000 đ")).toBeInTheDocument();
    expect(within(cards()[1]).getByText("Nội bộ")).toHaveClass("local");
    expect(within(cards()[1]).getByText("Khóa 1-1")).toBeInTheDocument();
    expect(screen.queryByText("Tạo mới khóa học")).toBeNull(); // bản cũ ẩn bằng {false && …}
  });

  it("công tắc ghi đóng: Đồng bộ/Sửa/Xóa bị khoá + WriteLockedNotice; Chi tiết vẫn bấm được", async () => {
    renderPage();
    await screen.findByText("Khóa a");
    expect(screen.getByRole("button", { name: /Đồng bộ dữ liệu/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sửa Khóa a" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Xóa Khóa a" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Chi tiết Khóa a" })).toBeEnabled();
    expect(screen.getByTestId("write-locked")).toHaveTextContent("WAITING FOR BACKEND");
  });

  it("bộ lọc phía client: tìm theo mã, loại 1-1, nguồn, sắp theo giá; 'Xóa tất cả' trả về mặc định", async () => {
    renderPage();
    await screen.findByText("Khóa a");
    await userEvent.type(screen.getByPlaceholderText("Tìm theo tên hoặc mã khóa học..."), "c-b");
    expect(cardTitles()).toEqual(["Khóa b"]);
    await userEvent.click(screen.getByRole("button", { name: "Xóa tất cả" }));
    expect(cards()).toHaveLength(3);
    await userEvent.selectOptions(screen.getByLabelText("Loại khóa học"), "1-1");
    expect(cardTitles()).toEqual(["Khóa b"]);
    await userEvent.selectOptions(screen.getByLabelText("Loại khóa học"), "all");
    await userEvent.selectOptions(screen.getByLabelText("Nguồn quản lý"), "local");
    await userEvent.selectOptions(screen.getByLabelText("Sắp xếp theo giá"), "desc");
    expect(cardTitles()).toEqual(["Khóa c", "Khóa b"]);
    expect(screen.getByText("Tìm thấy", { exact: false }).textContent).toBe("Tìm thấy 2 / 3 khóa học");
    await userEvent.selectOptions(screen.getByLabelText("Nguồn quản lý"), "synced");
    await userEvent.type(screen.getByPlaceholderText("Tìm theo tên hoặc mã khóa học..."), "zzz");
    expect(screen.getByTestId("onl-empty")).toHaveTextContent("Không tìm thấy khóa học nào phù hợp.");
  });

  it("dịch vụ chưa cấu hình => WAITING FOR BACKEND, thống kê '—', không toast; lỗi => khối lỗi có Thử lại tải lại", async () => {
    vi.mocked(listOnlineCourses).mockRejectedValueOnce(new ApiNotConfiguredError());
    renderPage();
    const notice = await screen.findByTestId("onl-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(screen.getAllByTestId("onl-stat-card")[0]).toHaveTextContent("—");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("lỗi API => khối lỗi với thông điệp máy chủ, 'Thử lại' gọi lại và hiện lưới", async () => {
    vi.mocked(listOnlineCourses).mockRejectedValueOnce(new ApiError("Hệ thống đang bảo trì", 503)).mockResolvedValue(fixtures);
    renderPage();
    const notice = await screen.findByTestId("onl-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(notice).toHaveTextContent("Hệ thống đang bảo trì");
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Khóa a")).toBeInTheDocument();
    expect(listOnlineCourses).toHaveBeenCalledTimes(2);
  });

  it("phản hồi không phải mảng => lỗi hợp đồng (bản cũ coi là rỗng)", async () => {
    vi.mocked(listOnlineCourses).mockResolvedValueOnce({ items: [] } as never);
    renderPage();
    expect(await screen.findByTestId("onl-notice")).toHaveTextContent("không đúng định dạng");
  });
});

describe("modal chi tiết / sửa / xóa / đồng bộ", () => {
  it("Chi tiết: gọi GET /courses/{id} + full-detail, hiện tổng quan và mô tả giáo trình với tiêu đề con in đậm", async () => {
    vi.mocked(getOnlineCourse).mockResolvedValue({ ...fixtures[0], syllabus_id: "syl-a" });
    vi.mocked(getOnlineCourseFullDetail).mockResolvedValue({ ...fixtures[0], syllabusInfo: { description: "<p>Mục tiêu: Đạt HSK3</p><p>Nội dung cốt lõi: 10 buổi</p>" } });
    renderPage();
    await screen.findByText("Khóa a");
    await userEvent.click(screen.getByRole("button", { name: "Chi tiết Khóa a" }));
    const detail = await screen.findByTestId("onl-detail");
    await within(detail).findByTestId("onl-syllabus-description");
    expect(getOnlineCourse).toHaveBeenCalledWith("a");
    expect(getOnlineCourseFullDetail).toHaveBeenCalledWith("a");
    expect(getOnlineSyllabus).not.toHaveBeenCalled(); // đã có mô tả từ full-detail
    expect(within(detail).getByText("Tổng quan khóa học")).toBeInTheDocument();
    expect(within(detail).getByText("Mục tiêu:").tagName).toBe("STRONG");
    expect(within(detail).getByTestId("onl-syllabus-description")).toHaveTextContent("Nội dung cốt lõi: 10 buổi");
    expect(within(detail).getByText("Syllabus: syl-a")).toBeInTheDocument();
  });

  it("Chi tiết: thiếu mô tả ở cả hai bước => gọi GET /syllabuses/{id}; vẫn không có => thông báo chưa tích hợp", async () => {
    vi.mocked(getOnlineCourse).mockResolvedValue(fixtures[1]);
    vi.mocked(getOnlineCourseFullDetail).mockRejectedValue(new ApiError("Not found", 404));
    vi.mocked(getOnlineSyllabus).mockResolvedValue({ id: "syl-b" });
    renderPage();
    await screen.findByText("Khóa b");
    await userEvent.click(screen.getByRole("button", { name: "Chi tiết Khóa b" }));
    const detail = await screen.findByTestId("onl-detail");
    expect(await within(detail).findByText("Dữ liệu Syllabus chưa được tích hợp đầy đủ.")).toBeInTheDocument();
    expect(getOnlineSyllabus).toHaveBeenCalledWith("syl-b");
  });

  it("Sửa (công tắc mở bằng cờ): form điền sẵn, lưu => PUT với payload đã chuẩn hoá, toast, tải lại danh sách", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_ONLINE_COURSE", "enabled");
    vi.mocked(updateOnlineCourse).mockResolvedValue(fixtures[0]);
    renderPage();
    await screen.findByText("Khóa a");
    await userEvent.click(screen.getByRole("button", { name: "Sửa Khóa a" }));
    const dialog = await screen.findByRole("dialog");
    const name = within(dialog).getByLabelText("Tên khóa học") as HTMLInputElement;
    expect(name.value).toBe("Khóa a");
    await userEvent.type(name, " mới");
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(updateOnlineCourse).toHaveBeenCalledWith("a", expect.objectContaining({ name: "Khóa a mới", price: 2_500_000, totalLessons: 10, courseType: "Group" }), false));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cập nhật thành công"));
    await waitFor(() => expect(listOnlineCourses).toHaveBeenCalledTimes(2));
  });

  it("Xóa: confirmAction với chữ của modal cũ ('Xác Nhận Xóa' / 'Đồng ý xóa' / 'Quay lại'); từ chối => không gọi API; đồng ý => DELETE + toast + tải lại", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_ONLINE_COURSE", "enabled");
    vi.mocked(deleteOnlineCourse).mockResolvedValue(undefined);
    vi.mocked(confirmAction).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    renderPage();
    await screen.findByText("Khóa a");
    await userEvent.click(screen.getByRole("button", { name: "Xóa Khóa a" }));
    await waitFor(() => expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xác Nhận Xóa", okText: "Đồng ý xóa", cancelText: "Quay lại", danger: true })));
    expect(deleteOnlineCourse).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Xóa Khóa b" }));
    await waitFor(() => expect(deleteOnlineCourse).toHaveBeenCalledWith("b", false));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Xóa thành công"));
    await waitFor(() => expect(listOnlineCourses).toHaveBeenCalledTimes(2));
  });

  it("Đồng bộ: POST /sync/all rồi mở modal 'Đang Đồng Bộ Dữ Liệu' với bước hiện tại; lỗi bắt đầu => toast lỗi, modal đóng", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_ONLINE_COURSE", "enabled");
    vi.mocked(startOnlineSync).mockResolvedValueOnce({ jobId: "j1", status: "RUNNING", currentStep: "Đang kết nối CMS...", progressPercent: 5 });
    renderPage();
    await screen.findByText("Khóa a");
    await userEvent.click(screen.getByRole("button", { name: /Đồng bộ dữ liệu/ }));
    const modal = await screen.findByTestId("onl-sync-modal");
    expect(modal).toHaveAttribute("data-tone", "syncing");
    expect(within(modal).getByText("Đang Đồng Bộ Dữ Liệu")).toBeInTheDocument();
    await within(modal).findByText("Đang kết nối CMS...");
    expect(screen.getByRole("button", { name: /Đang đồng bộ/ })).toBeDisabled();
    await userEvent.click(within(modal).getByRole("button", { name: "Chạy nền" }));
    await expectSyncModalHidden();
  });

  it("Đồng bộ thất bại khi bắt đầu (409 đang có tiến trình) => toast thông điệp máy chủ, không có modal", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_ONLINE_COURSE", "enabled");
    vi.mocked(startOnlineSync).mockRejectedValueOnce(new ApiError("Đang có tiến trình đồng bộ", 409));
    renderPage();
    await screen.findByText("Khóa a");
    await userEvent.click(screen.getByRole("button", { name: /Đồng bộ dữ liệu/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Đang có tiến trình đồng bộ"));
    await expectSyncModalHidden();
    expect(screen.getByRole("button", { name: /Đồng bộ dữ liệu/ })).toBeEnabled();
  });
});
