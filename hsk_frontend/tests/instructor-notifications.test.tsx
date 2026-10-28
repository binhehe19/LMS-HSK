import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManagementShell } from "@/components/management/management-shell";
import { InstructorNotificationsPageContent } from "@/components/management/notifications/instructor-notifications-page-content";
import { NotificationListView } from "@/components/management/notifications/notification-list-view";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { fetchNotifications, getUnreadCount, markAllNotificationsRead, markNotificationRead } from "@/lib/api/notification-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { NotificationPageResponse, NotificationResponse } from "@/types/notification";
import { adminUser } from "./fixtures/classes";

const push = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/instructor/instructor-notifications", useRouter: () => ({ push, back: vi.fn() }) }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/notification-client", () => ({ getUnreadCount: vi.fn(), fetchNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn() } }));

const teacher = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "gv1@example.test", roles: ["ROLE_TEACHER"] };

const noti = (id: number, over: Partial<NotificationResponse> = {}): NotificationResponse => ({
  id: `n${id}`, topic: "GENERAL", title: `Thông báo ${id}`, message: `Nội dung ${id}`, resourceType: "", resourceId: "",
  payload: null, read: false, seen: false, createdAt: "2026-03-05T08:30:00", readAt: null, seenAt: null, ...over,
});
const pageOf = (items: NotificationResponse[], over: Partial<NotificationPageResponse> = {}): NotificationPageResponse => ({
  items, totalElements: items.length, totalPages: 1, page: 0, size: 10, unreadCount: items.filter((n) => !n.read).length, ...over,
});

beforeEach(() => {
  push.mockClear();
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(fetchNotifications).mockReset();
  vi.mocked(markNotificationRead).mockReset().mockResolvedValue({} as never);
  vi.mocked(markAllNotificationsRead).mockReset().mockResolvedValue(undefined);
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

function renderPage() {
  render(
    <Provider store={makeStore({ status: "authenticated", user: teacher })}>
      <ManagementShell area="instructor">
        <InstructorNotificationsPageContent />
      </ManagementShell>
    </Provider>,
  );
}

const list = () => document.querySelector(".notification-list-items") as HTMLElement;

describe("màn Thông báo của tôi — có dữ liệu (mock ở lớp client)", () => {
  beforeEach(() => {
    vi.mocked(fetchNotifications).mockResolvedValue(
      pageOf([
        noti(1, { payload: { targetUrl: "/instructor/list-class" } }),
        noti(2),
        noti(3, { read: true, payload: { deepLink: "/instructor/welcome" } }),
        noti(4, { read: true }),
      ]),
    );
  });

  it("giữ DOM khung trang (.content > .container > .row > sidebar + .col-lg-9 > card), không có g-4, tiêu đề và badge chưa đọc", async () => {
    renderPage();
    await screen.findByText("Thông báo 1");
    const row = document.querySelector(".content > .container > .row") as HTMLElement;
    expect(row.className).toBe("row");
    expect(row.querySelector(":scope > .col-lg-9 > .card.shadow-sm.border-0.mb-4")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 4 })).toHaveTextContent("Thông báo của tôi");
    expect(screen.getByText("2 chưa đọc")).toHaveClass("badge", "bg-danger", "rounded-pill");
    expect(screen.queryByText(/Gửi Thông Báo Mới|Thông báo đã gửi/)).toBeNull(); // composer/lịch sử chỉ cho Admin/Teacher-manager
    expect(fetchNotifications).toHaveBeenCalledWith({ page: 0, size: 10, readStatus: "ALL" });
  });

  it("thông báo chưa đọc/đã đọc có class và biểu tượng như bản cũ; thời gian định dạng HH:mm DD/MM/YYYY", async () => {
    renderPage();
    await screen.findByText("Thông báo 1");
    const rows = [...list().children] as HTMLElement[];
    expect(rows).toHaveLength(4);
    expect(rows[0].className).toBe("p-4 border-bottom d-flex align-items-start transition-all hover-bg-light bg-light-primary border-start border-primary border-4");
    expect(rows[2].className).toBe("p-4 border-bottom d-flex align-items-start transition-all hover-bg-light ");
    expect(rows[0].querySelector("h5")).toHaveClass("fw-bold", "text-primary");
    expect(rows[2].querySelector("h5")).toHaveClass("fw-semibold", "text-dark");
    expect(rows[0].querySelector(".rounded-circle")).toHaveClass("bg-primary", "text-white");
    expect(rows[2].querySelector(".rounded-circle")).toHaveClass("bg-light", "text-muted");
    expect(within(rows[0]).getByText("08:30 05/03/2026")).toBeInTheDocument();
  });

  it("bấm thông báo CHƯA đọc có đích nội bộ: đánh dấu đã đọc rồi điều hướng", async () => {
    renderPage();
    await userEvent.click(await screen.findByText("Thông báo 1"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/instructor/list-class"));
    expect(markNotificationRead).toHaveBeenCalledWith("n1");
  });

  it("bấm thông báo đã đọc có đích: KHÔNG gọi đánh dấu đã đọc, điều hướng ngay (deepLink)", async () => {
    renderPage();
    await userEvent.click(await screen.findByText("Thông báo 3"));
    expect(push).toHaveBeenCalledWith("/instructor/welcome");
    expect(markNotificationRead).not.toHaveBeenCalled();
  });

  it("chưa đọc nhưng không có đích: đánh dấu đã đọc, KHÔNG điều hướng, tải lại danh sách", async () => {
    renderPage();
    await userEvent.click(await screen.findByText("Thông báo 2"));
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith("n2"));
    await waitFor(() => expect(fetchNotifications).toHaveBeenCalledTimes(2));
    expect(push).not.toHaveBeenCalled();
  });

  it("đã đọc và không có đích: chỉ tải lại danh sách", async () => {
    renderPage();
    await userEvent.click(await screen.findByText("Thông báo 4"));
    await waitFor(() => expect(fetchNotifications).toHaveBeenCalledTimes(2));
    expect(markNotificationRead).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("đích ngoài hệ thống ('//host', 'http://…') bị bỏ qua, không điều hướng", async () => {
    vi.mocked(fetchNotifications).mockResolvedValue(pageOf([noti(5, { read: true, payload: { targetUrl: "//evil.example" } }), noti(6, { read: true, payload: { targetUrl: "https://evil.example/x" } })]));
    renderPage();
    await userEvent.click(await screen.findByText("Thông báo 5"));
    await userEvent.click(screen.getByText("Thông báo 6"));
    expect(push).not.toHaveBeenCalled();
  });

  it("markNotificationRead lỗi: không điều hướng (như bản cũ)", async () => {
    vi.mocked(markNotificationRead).mockRejectedValue(new ApiError("boom", 500));
    renderPage();
    await userEvent.click(await screen.findByText("Thông báo 1"));
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });

  it("'Đánh dấu tất cả là đã đọc': gọi API, toast thành công, tải lại", async () => {
    renderPage();
    await screen.findByText("Thông báo 1");
    await userEvent.click(screen.getByRole("button", { name: "Đánh dấu tất cả là đã đọc" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã đánh dấu tất cả là đã đọc"));
    expect(markAllNotificationsRead).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(fetchNotifications).toHaveBeenCalledTimes(2));
  });

  it("'Đánh dấu tất cả' lỗi: toast lỗi 'Thao tác thất bại', không tải lại", async () => {
    vi.mocked(markAllNotificationsRead).mockRejectedValue(new ApiError("boom", 500));
    renderPage();
    await screen.findByText("Thông báo 1");
    await userEvent.click(screen.getByRole("button", { name: "Đánh dấu tất cả là đã đọc" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Thao tác thất bại"));
    expect(fetchNotifications).toHaveBeenCalledTimes(1);
  });

  it("đổi bộ lọc trạng thái: gọi lại với readStatus và về trang 0", async () => {
    renderPage();
    await screen.findByText("Thông báo 1");
    await userEvent.selectOptions(screen.getByRole("combobox"), "UNREAD");
    await waitFor(() => expect(fetchNotifications).toHaveBeenLastCalledWith({ page: 0, size: 10, readStatus: "UNREAD" }));
  });

  it("sự kiện notifications-updated từ chuông làm danh sách tải lại", async () => {
    renderPage();
    await screen.findByText("Thông báo 1");
    act(() => {
      window.dispatchEvent(new CustomEvent("notifications-updated"));
    });
    await waitFor(() => expect(fetchNotifications).toHaveBeenCalledTimes(2));
  });
});

describe("màn Thông báo của tôi — phân trang", () => {
  it("ẩn phân trang khi tổng ≤ 10; có Trước/số trang/Sau và chuyển trang khi > 10", async () => {
    vi.mocked(fetchNotifications).mockResolvedValue(pageOf([noti(1)], { totalElements: 25, totalPages: 3 }));
    renderPage();
    await screen.findByText("Thông báo 1");
    const pagination = document.querySelector(".pagination") as HTMLElement;
    expect([...pagination.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Trước", "1", "2", "3", "Sau"]);
    expect(pagination.querySelector("li:first-child")).toHaveClass("disabled");
    expect(pagination.querySelector("li:nth-child(2)")).toHaveClass("active");
    await userEvent.click(screen.getByRole("button", { name: "3" }));
    await waitFor(() => expect(fetchNotifications).toHaveBeenLastCalledWith({ page: 2, size: 10, readStatus: "ALL" }));
    expect(document.querySelector(".pagination li:last-child")).toHaveClass("disabled");
  });

  it("không hiện phân trang khi tổng đúng bằng một trang", async () => {
    vi.mocked(fetchNotifications).mockResolvedValue(pageOf([noti(1)], { totalElements: 10 }));
    renderPage();
    await screen.findByText("Thông báo 1");
    expect(document.querySelector(".pagination")).toBeNull();
  });
});

describe("màn Thông báo của tôi — các trạng thái", () => {
  it("đang tải: spinner + 'Đang tải...', nút đánh dấu tất cả bị khoá", async () => {
    vi.mocked(fetchNotifications).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Đang tải...")).toBeInTheDocument();
    expect(document.querySelector(".spinner-border")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Đánh dấu tất cả là đã đọc" })).toBeDisabled();
  });

  it("rỗng thật (API trả 0): hiện trạng thái rỗng như bản cũ, không hiện khối chờ backend", async () => {
    vi.mocked(fetchNotifications).mockResolvedValue(pageOf([]));
    renderPage();
    expect(await screen.findByText("Không tìm thấy thông báo nào")).toBeInTheDocument();
    expect(screen.getByText("Thử thay đổi bộ lọc hoặc quay lại sau nhé!")).toBeInTheDocument();
    expect(screen.queryByTestId("notifications-data-notice")).toBeNull();
    expect(screen.queryByText(/chưa đọc$/)).toBeNull();
    expect(screen.getByRole("button", { name: "Đánh dấu tất cả là đã đọc" })).toBeDisabled();
  });

  it("dịch vụ chưa cấu hình: khối WAITING FOR BACKEND, KHÔNG nói 'không có thông báo', không dữ liệu giả, không toast lỗi", async () => {
    vi.mocked(fetchNotifications).mockRejectedValue(new ApiNotConfiguredError());
    renderPage();
    const notice = await screen.findByTestId("notifications-data-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(notice).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.queryByText("Không tìm thấy thông báo nào")).toBeNull();
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("lỗi gọi API: khối lỗi + 'Thử lại' (tải lại được) + toast lỗi như bản cũ", async () => {
    vi.mocked(fetchNotifications).mockRejectedValueOnce(new ApiError("Máy chủ lỗi", 500)).mockResolvedValue(pageOf([noti(1)]));
    renderPage();
    const notice = await screen.findByTestId("notifications-data-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(notice).toHaveTextContent("Máy chủ lỗi");
    expect(toast.error).toHaveBeenCalledWith("Không thể tải danh sách thông báo");
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Thông báo 1")).toBeInTheDocument();
    expect(screen.queryByTestId("notifications-data-notice")).toBeNull();
  });

  it("phản hồi cũ (đổi bộ lọc giữa chừng) không ghi đè kết quả mới", async () => {
    let resolveFirst: (v: NotificationPageResponse) => void = () => {};
    vi.mocked(fetchNotifications)
      .mockReturnValueOnce(new Promise((r) => { resolveFirst = r; }))
      .mockResolvedValue(pageOf([noti(9, { title: "Kết quả mới" })]));
    renderPage();
    await userEvent.selectOptions(screen.getByRole("combobox"), "READ");
    expect(await screen.findByText("Kết quả mới")).toBeInTheDocument();
    await act(async () => resolveFirst(pageOf([noti(1, { title: "Kết quả cũ" })])));
    expect(screen.queryByText("Kết quả cũ")).toBeNull();
    expect(screen.getByText("Kết quả mới")).toBeInTheDocument();
  });
});

describe("NotificationListView — hộp chọn ngày (view thuần)", () => {
  const base = {
    title: "Thông báo của tôi", state: { kind: "ok" } as const, items: [], unreadCount: 0, totalElements: 0,
    filters: { page: 0, size: 10, readStatus: "ALL" as const }, onMarkAllRead: vi.fn(), onOpen: vi.fn(), onChangeFilters: vi.fn(), onGoToPage: vi.fn(), onRetry: vi.fn(),
  };

  it("hiện đúng ngày đã chọn trong ô RangePicker và nhãn/placeholder tiếng Việt", () => {
    render(<NotificationListView {...base} filters={{ ...base.filters, fromDate: "2026-03-01T00:00:00", toDate: "2026-03-07T23:59:59" }} />);
    const inputs = [...document.querySelectorAll(".ant-picker input")] as HTMLInputElement[];
    expect(inputs.map((i) => i.value)).toEqual(["01/03/2026", "07/03/2026"]);
    expect(screen.getByText("Từ ngày - Đến ngày:")).toBeInTheDocument();
    expect(screen.getByText("Trạng thái:")).toBeInTheDocument();
  });

  it("chưa chọn ngày: hai ô trống với placeholder 'Từ ngày'/'Đến ngày'", () => {
    render(<NotificationListView {...base} />);
    const inputs = [...document.querySelectorAll(".ant-picker input")] as HTMLInputElement[];
    expect(inputs.map((i) => i.placeholder)).toEqual(["Từ ngày", "Đến ngày"]);
    expect(inputs.map((i) => i.value)).toEqual(["", ""]);
  });
});

// REGRESSION — INTENTIONAL BUG FIX so với HSK cũ: bản cũ `handleFilterChange('page', n)` luôn đặt lại `page: 0` nên bấm "3" vẫn tải trang đầu (chủ dự án
// đã duyệt giữ bản sửa, M3B.4). Các ca dưới đây khoá hành vi đúng để lỗi không quay lại.
describe("regression: phân trang đúng trang, giữ bộ lọc, về trang đầu khi đổi bộ lọc, trang không còn hợp lệ", () => {
  const total = 25;
  const pageResponder = (totalElements = total) => async (q?: { page?: number; size?: number; readStatus?: string }) => {
    const page = q?.page ?? 0;
    const size = q?.size ?? 10;
    const count = Math.max(0, Math.min(size, totalElements - page * size));
    return pageOf(Array.from({ length: count }, (_, i) => noti(page * size + i + 1)), { totalElements, totalPages: Math.ceil(totalElements / size), page });
  };
  const lastQuery = () => vi.mocked(fetchNotifications).mock.calls.at(-1)![0];
  const pager = () => document.querySelector(".pagination") as HTMLElement;

  it("bấm trang 3 lấy ĐÚNG trang 3 (page=2) và hiện đúng bản ghi 21–25, không quay về trang 0", async () => {
    vi.mocked(fetchNotifications).mockImplementation(pageResponder());
    renderPage();
    await screen.findByText("Thông báo 1");
    await userEvent.click(within(pager()).getByRole("button", { name: "3" }));
    await screen.findByText("Thông báo 21");
    expect(lastQuery()).toMatchObject({ page: 2, size: 10 });
    expect(screen.queryByText("Thông báo 1")).toBeNull();
    expect(screen.getAllByRole("heading", { level: 5 })).toHaveLength(5);
    expect(pager().querySelector("li.active")).toHaveTextContent("3");
  });

  it("Trước/Sau đi đúng một trang; số trang theo tổng bản ghi (25 => 3 trang; 11 => 2 trang)", async () => {
    vi.mocked(fetchNotifications).mockImplementation(pageResponder());
    renderPage();
    await screen.findByText("Thông báo 1");
    expect([...pager().querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Trước", "1", "2", "3", "Sau"]);
    await userEvent.click(within(pager()).getByRole("button", { name: "Sau" }));
    await screen.findByText("Thông báo 11");
    expect(lastQuery()).toMatchObject({ page: 1 });
    await userEvent.click(within(pager()).getByRole("button", { name: "Sau" }));
    await screen.findByText("Thông báo 21");
    expect(within(pager()).getByRole("button", { name: "Sau" }).closest("li")).toHaveClass("disabled");
    await userEvent.click(within(pager()).getByRole("button", { name: "Trước" }));
    await screen.findByText("Thông báo 11");
    expect(lastQuery()).toMatchObject({ page: 1 });
  });

  it("chuyển trang GIỮ NGUYÊN bộ lọc trạng thái", async () => {
    vi.mocked(fetchNotifications).mockImplementation(pageResponder());
    renderPage();
    await screen.findByText("Thông báo 1");
    await userEvent.selectOptions(screen.getByRole("combobox"), "UNREAD");
    await screen.findByText("Thông báo 1");
    await userEvent.click(within(pager()).getByRole("button", { name: "2" }));
    await screen.findByText("Thông báo 11");
    expect(lastQuery()).toMatchObject({ page: 1, readStatus: "UNREAD" });
  });

  it("đổi bộ lọc trạng thái khi đang ở trang 3 => về trang đầu (page=0)", async () => {
    vi.mocked(fetchNotifications).mockImplementation(pageResponder());
    renderPage();
    await screen.findByText("Thông báo 1");
    await userEvent.click(within(pager()).getByRole("button", { name: "3" }));
    await screen.findByText("Thông báo 21");
    await userEvent.selectOptions(screen.getByRole("combobox"), "READ");
    await screen.findByText("Thông báo 1");
    expect(lastQuery()).toMatchObject({ page: 0, readStatus: "READ" });
  });

  it("đổi khoảng ngày khi đang ở trang 2 => về trang đầu; chuyển trang giữ khoảng ngày", async () => {
    vi.mocked(fetchNotifications).mockImplementation(pageResponder());
    renderPage();
    await screen.findByText("Thông báo 1");
    const inputs = [...document.querySelectorAll(".ant-picker input")] as HTMLInputElement[];
    await userEvent.click(inputs[0]);
    await userEvent.type(inputs[0], "01/03/2026{Enter}");
    await userEvent.type(inputs[1], "31/03/2026{Enter}");
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 0, fromDate: expect.any(String), toDate: expect.any(String) }));
    const dateFilters = { fromDate: lastQuery()!.fromDate, toDate: lastQuery()!.toDate };
    await userEvent.click(within(pager()).getByRole("button", { name: "2" }));
    await screen.findByText("Thông báo 11");
    expect(lastQuery()).toMatchObject({ page: 1, ...dateFilters }); // chuyển trang giữ khoảng ngày
  });

  it("hiển thị đúng tổng/giới hạn: tổng đúng 10 => không có phân trang; 11 => có", async () => {
    vi.mocked(fetchNotifications).mockImplementation(pageResponder(10));
    const { unmount } = render(
      <Provider store={makeStore({ status: "authenticated", user: teacher })}>
        <ManagementShell area="instructor">
          <InstructorNotificationsPageContent />
        </ManagementShell>
      </Provider>,
    );
    await screen.findByText("Thông báo 1");
    expect(pager()).toBeNull();
    unmount();
    vi.mocked(fetchNotifications).mockImplementation(pageResponder(11));
    renderPage();
    await screen.findByText("Thông báo 1");
    expect([...pager().querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Trước", "1", "2", "Sau"]);
  });

  it("trang hiện tại không còn hợp lệ khi dữ liệu giảm (đọc/đổi ở nơi khác) => nhảy về trang cuối còn dữ liệu, không hiện trang trống", async () => {
    let totalNow = 25;
    vi.mocked(fetchNotifications).mockImplementation(async (q) => pageResponder(totalNow)(q));
    renderPage();
    await screen.findByText("Thông báo 1");
    await userEvent.click(within(pager()).getByRole("button", { name: "3" }));
    await screen.findByText("Thông báo 21");
    totalNow = 12; // chỉ còn 2 trang: trang index 2 không còn
    act(() => {
      window.dispatchEvent(new CustomEvent("notifications-updated"));
    });
    await screen.findByText("Thông báo 11"); // trang cuối còn dữ liệu (index 1)
    expect(lastQuery()).toMatchObject({ page: 1 });
    expect(screen.queryByText("Không tìm thấy thông báo nào")).toBeNull();
    expect(pager().querySelector("li.active")).toHaveTextContent("2");
  });

  it("dữ liệu về 0 bản ghi => trạng thái rỗng (không nhảy trang vô hạn)", async () => {
    let totalNow = 25;
    vi.mocked(fetchNotifications).mockImplementation(async (q) => pageResponder(totalNow)(q));
    renderPage();
    await screen.findByText("Thông báo 1");
    await userEvent.click(within(pager()).getByRole("button", { name: "3" }));
    await screen.findByText("Thông báo 21");
    totalNow = 0;
    act(() => {
      window.dispatchEvent(new CustomEvent("notifications-updated"));
    });
    expect(await screen.findByText("Không tìm thấy thông báo nào")).toBeInTheDocument();
  });
});
