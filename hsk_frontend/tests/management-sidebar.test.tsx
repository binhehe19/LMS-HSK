import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManagementSidebar } from "@/components/management/management-sidebar";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { logoutRemote } from "@/lib/api/auth-client";
import { fetchNotifications, getUnreadCount, markAllNotificationsRead, markNotificationRead } from "@/lib/api/notification-client";
import { getTickets } from "@/lib/api/ticket-client";
import { getNavTargetStatus } from "@/lib/management/route-registry";
import { makeStore } from "@/redux/store";
import { adminUser } from "./fixtures/classes";
import instructorGolden from "./fixtures/instructor-nav.golden.json";

const router = { push: vi.fn() };
let pathname = "/admin/class-management";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => router }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/api/notification-client", () => ({
  getUnreadCount: vi.fn(),
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
const assign = vi.fn();

const teacherUser = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "teacher@example.test", roles: ["ROLE_TEACHER"] };

beforeEach(() => {
  assign.mockClear();
  router.push.mockClear();
  vi.mocked(logoutRemote).mockClear();
  // Mặc định: dịch vụ thông báo/ticket CHƯA cấu hình (WAITING FOR BACKEND).
  vi.mocked(getUnreadCount).mockReset().mockRejectedValue(new ApiNotConfiguredError());
  vi.mocked(fetchNotifications).mockReset().mockRejectedValue(new ApiNotConfiguredError());
  vi.mocked(markNotificationRead).mockReset().mockResolvedValue({} as never);
  vi.mocked(markAllNotificationsRead).mockReset().mockResolvedValue(undefined);
  vi.mocked(getTickets).mockReset().mockRejectedValue(new ApiNotConfiguredError());
  window.sessionStorage.clear();
  window.localStorage.clear();
  pathname = "/admin/class-management";
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { href: "http://localhost:3100/admin/class-management", hostname: "localhost", assign },
  });
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
});

function renderSidebar(area: "admin" | "instructor" = "admin", user = area === "admin" ? adminUser : teacherUser) {
  const store = makeStore({ status: "authenticated", user });
  render(
    <Provider store={store}>
      <ManagementSidebar area={area} />
    </Provider>,
  );
  return store;
}

describe("ManagementSidebar — khu vực Admin", () => {
  it("hiển thị người dùng hiện tại, phụ đề 'LMS · Admin' và đánh dấu 'Quản lý lớp học' đang active", () => {
    renderSidebar();
    expect(screen.getByText("Quản Trị Viên")).toBeInTheDocument();
    expect(screen.getByText("admin@example.test")).toBeInTheDocument();
    expect(screen.getByText("LMS · Admin")).toBeInTheDocument();
    const active = document.querySelector(".sidebar-menu a.active");
    expect(active?.textContent).toContain("Quản lý lớp học");
  });

  it("liên kết ngoài (Quản lý người dùng, Cài đặt) mở tab mới tới Authentication_Frontend", () => {
    renderSidebar();
    const users = screen.getByText("Quản lý người dùng").closest("a");
    expect(users).toHaveAttribute("href", "http://auth.test.invalid/admin/users");
    expect(users).toHaveAttribute("target", "_blank");
    expect(users).toHaveAttribute("rel", "noopener noreferrer");
    expect(users).toHaveAttribute("data-migration-status", "external");
  });

  it("đăng xuất: gọi logoutRemote, đổi trạng thái 'signed-out', chuyển /login KHÔNG kèm redirect (như HSK cũ)", async () => {
    const store = renderSidebar();
    await userEvent.click(screen.getByRole("link", { name: "Đăng xuất" }));
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(logoutRemote).toHaveBeenCalledTimes(1);
    expect(store.getState().auth.status).toBe("signed-out");
    expect(assign).toHaveBeenCalledWith("http://auth.test.invalid/login");
  });

  it("thu gọn sidebar đổi class và lưu localStorage; mở lại thì bỏ class", async () => {
    renderSidebar();
    const column = document.querySelector(".management-sidebar-column") as HTMLElement;
    expect(column.className).not.toContain("is-collapsed");
    await userEvent.click(screen.getByRole("button", { name: "Thu gọn menu" }));
    expect(column.className).toContain("is-collapsed");
    expect(window.localStorage.getItem("management-sidebar-collapsed")).toBe("true");
    // Thu gọn: mỗi mục có title/aria-label để người dùng vẫn biết mục là gì.
    expect(screen.getByRole("link", { name: "Quản lý lớp học" })).toHaveAttribute("title", "Quản lý lớp học");
    await userEvent.click(screen.getByRole("button", { name: /Mở rộng menu|Thu gọn menu/ }));
    expect(column.className).not.toContain("is-collapsed");
  });

  it("đánh dấu trạng thái đích theo registry trên từng mục (số lượng từng trạng thái: tests/route-registry.test.ts); 1 unknown ('Yêu cầu hỗ trợ': HSK cũ không có PrivateRoute), 1 external; không mục nào bị ẩn", () => {
    renderSidebar();
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".sidebar-middle .sidebar-menu a"));
    expect(links).toHaveLength(22);
    for (const a of links) {
      const href = a.getAttribute("href") ?? "";
      expect(a.dataset.migrationStatus, `${a.textContent} (${href})`).toBe(getNavTargetStatus(href).toLowerCase().replace("_", "-"));
    }
    expect(links.filter((a) => a.dataset.migrationStatus === "migrated").map((a) => a.textContent)).toContain("Quản lý lớp học");
    expect(links.filter((a) => a.dataset.migrationStatus === "unknown").map((a) => a.textContent)).toEqual(["Yêu cầu hỗ trợ"]);
    expect(links.filter((a) => a.dataset.migrationStatus === "external").map((a) => a.textContent)).toEqual(["Quản lý người dùng"]);
  });

  it("lưu và khôi phục vị trí cuộn của menu bằng khóa riêng của Admin", () => {
    window.sessionStorage.setItem("admin-sidebar-scroll", "120");
    renderSidebar();
    expect((document.querySelector(".sidebar-middle") as HTMLElement).scrollTop).toBe(120);
  });
});

describe("ManagementSidebar — khu vực Giảng viên", () => {
  beforeEach(() => {
    pathname = "/instructor/list-class";
  });

  it("hiển thị menu đúng golden của HSK cũ (thứ tự, nhãn, nhóm) và phụ đề 'LMS · Quản lý'", () => {
    renderSidebar("instructor");
    expect(screen.getByText("LMS · Quản lý")).toBeInTheDocument();
    expect(screen.getByText("Giáo Viên Một")).toBeInTheDocument();
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".sidebar-middle .sidebar-menu a"));
    expect(links.map((a) => a.textContent)).toEqual(instructorGolden.items.map((i) => i.title));
    const headers = Array.from(document.querySelectorAll(".menu-header-label")).map((h) => h.textContent);
    expect(headers).toEqual(instructorGolden.items.flatMap((i) => (i.header ? [i.header] : [])));
  });

  it("không có mục của Admin (Bảng thống kê, Quản lý Giảng viên, Quản lý người dùng) trong menu giảng viên", () => {
    renderSidebar("instructor");
    for (const title of ["Bảng thống kê", "Quản lý Giảng viên", "Quản lý người dùng", "Overview", "Quản lý thông báo"]) {
      expect(screen.queryByText(title)).toBeNull();
    }
  });

  it("'Quản lý lớp học' active ở list-class (đã chuyển, M4A); Tổng quan đã chuyển; Yêu cầu hỗ trợ vẫn unknown (HSK cũ không có PrivateRoute)", () => {
    renderSidebar("instructor");
    expect(document.querySelector(".sidebar-menu a.active")?.textContent).toContain("Quản lý lớp học");
    const klass = screen.getByText("Quản lý lớp học").closest("a")!;
    expect(klass).toHaveAttribute("data-migration-status", "migrated");
    expect(screen.getByText("Tổng quan").closest("a")).toHaveAttribute("data-migration-status", "migrated");
    expect(screen.getByText("Yêu cầu hỗ trợ").closest("a")).toHaveAttribute("data-migration-status", "unknown");
  });

  it("dùng khóa cuộn riêng của giảng viên và tên mặc định 'Giảng viên' khi thiếu họ tên và email", () => {
    window.sessionStorage.setItem("instructor-sidebar-scroll", "90");
    renderSidebar("instructor", { ...teacherUser, fullName: undefined, email: "" });
    expect((document.querySelector(".sidebar-middle") as HTMLElement).scrollTop).toBe(90);
    expect(document.querySelector(".sbp-name")?.textContent).toBe("Giảng viên");
    expect(document.querySelector(".sbp-name")).toHaveClass("d-flex");
  });

  it("đăng xuất giống Admin", async () => {
    const store = renderSidebar("instructor");
    await userEvent.click(screen.getByRole("link", { name: "Đăng xuất" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("http://auth.test.invalid/login"));
    expect(store.getState().auth.status).toBe("signed-out");
  });
});

describe("chuông thông báo và huy hiệu — chưa cấu hình dịch vụ (WAITING FOR BACKEND)", () => {
  it("vẫn hiện chuông, KHÔNG có số/huy hiệu giả; mở dropdown báo 'chưa tích hợp'; không gọi lại mạng định kỳ", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderSidebar();
      const bell = screen.getByTestId("notification-bell");
      await waitFor(() => expect(bell).toHaveAttribute("data-unread-status", "waiting"));
      expect(document.querySelector(".noti-badge")).toBeNull();
      expect(screen.queryByTestId("menu-unread-badge")).toBeNull();

      await userEvent.click(bell);
      expect(await screen.findByTestId("notification-waiting")).toHaveTextContent("chưa được tích hợp");
      expect(screen.getByTestId("notification-dropdown")).toHaveClass("show");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(90_000);
      });
      expect(getUnreadCount).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("chuông thông báo và huy hiệu — có dữ liệu (mock ở lớp client)", () => {
  const noti = (over: Record<string, unknown> = {}) => ({
    id: "n1",
    topic: "GENERAL",
    title: "Tiêu đề 1",
    message: "Nội dung 1",
    resourceType: "",
    resourceId: "",
    payload: null,
    read: false,
    seen: false,
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    readAt: null,
    seenAt: null,
    ...over,
  });

  it("Admin: số chưa đọc hiện ở chuông và ở 'Quản lý thông báo'; >99 hiện '99+'", async () => {
    vi.mocked(getUnreadCount).mockResolvedValue(150);
    renderSidebar();
    await waitFor(() => expect(document.querySelector(".noti-badge")?.textContent).toBe("99+"));
    const badge = within(screen.getByText("Quản lý thông báo").closest("a")!).getByTestId("menu-unread-badge");
    expect(badge).toHaveTextContent("99+");
    // Chỉ MỘT mục có huy hiệu ở Admin.
    expect(screen.getAllByTestId("menu-unread-badge")).toHaveLength(1);
  });

  it("Giảng viên: huy hiệu nằm ở 'Thông báo của tôi'; số 0 thì không hiện", async () => {
    vi.mocked(getUnreadCount).mockResolvedValue(3);
    pathname = "/instructor/list-class";
    renderSidebar("instructor");
    await waitFor(() => expect(document.querySelector(".noti-badge")?.textContent).toBe("3"));
    expect(within(screen.getByText("Thông báo của tôi").closest("a")!).getByTestId("menu-unread-badge")).toHaveTextContent("3");
  });

  it("số 0 => không có huy hiệu nào", async () => {
    vi.mocked(getUnreadCount).mockResolvedValue(0);
    renderSidebar();
    await waitFor(() => expect(screen.getByTestId("notification-bell")).toHaveAttribute("data-unread-status", "ready"));
    expect(document.querySelector(".noti-badge")).toBeNull();
    expect(screen.queryByTestId("menu-unread-badge")).toBeNull();
  });

  it("mở dropdown: tải 10 thông báo mới nhất, hiện thời gian tương đối tiếng Việt; Escape và bấm ra ngoài đều đóng", async () => {
    vi.mocked(getUnreadCount).mockResolvedValue(1);
    vi.mocked(fetchNotifications).mockResolvedValue({ items: [noti()], totalElements: 1, totalPages: 1, page: 0, size: 10, unreadCount: 1 });
    renderSidebar();
    await waitFor(() => expect(document.querySelector(".noti-badge")).not.toBeNull());
    await userEvent.click(screen.getByTestId("notification-bell"));
    expect(await screen.findByText("Tiêu đề 1")).toBeInTheDocument();
    expect(screen.getByText(/phút trước/)).toBeInTheDocument();
    expect(fetchNotifications).toHaveBeenCalledWith({ size: 10 });
    const dropdown = screen.getByTestId("notification-dropdown");
    expect(dropdown).toHaveClass("show");

    await userEvent.keyboard("{Escape}");
    expect(dropdown).not.toHaveClass("show");

    await userEvent.click(screen.getByTestId("notification-bell"));
    expect(dropdown).toHaveClass("show");
    await userEvent.click(document.body);
    expect(dropdown).not.toHaveClass("show");
  });

  it("bấm thông báo chưa đọc: đánh dấu đã đọc, báo sidebar đếm lại, điều hướng tới targetUrl nội bộ", async () => {
    vi.mocked(getUnreadCount).mockResolvedValue(1);
    vi.mocked(fetchNotifications).mockResolvedValue({
      items: [noti({ payload: { targetUrl: "/admin/class-management" } })],
      totalElements: 1, totalPages: 1, page: 0, size: 10, unreadCount: 1,
    });
    renderSidebar();
    await waitFor(() => expect(document.querySelector(".noti-badge")).not.toBeNull());
    await userEvent.click(screen.getByTestId("notification-bell"));
    await userEvent.click(await screen.findByText("Tiêu đề 1"));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/class-management"));
    expect(markNotificationRead).toHaveBeenCalledWith("n1");
    await waitFor(() => expect(getUnreadCount).toHaveBeenCalledTimes(2)); // sự kiện notifications-updated
  });

  it("targetUrl là URL tuyệt đối/ngoài ứng dụng bị bỏ qua, quay về danh sách thông báo của khu vực", async () => {
    vi.mocked(getUnreadCount).mockResolvedValue(1);
    vi.mocked(fetchNotifications).mockResolvedValue({
      items: [noti({ read: true, payload: { targetUrl: "https://evil.example/x" } })],
      totalElements: 1, totalPages: 1, page: 0, size: 10, unreadCount: 0,
    });
    renderSidebar();
    await userEvent.click(screen.getByTestId("notification-bell"));
    await userEvent.click(await screen.findByText("Tiêu đề 1"));
    expect(router.push).toHaveBeenCalledWith("/admin/settings/notifications");
    expect(markNotificationRead).not.toHaveBeenCalled(); // đã đọc rồi
  });

  it("lỗi đánh dấu đã đọc không chặn điều hướng (như bản cũ)", async () => {
    vi.mocked(getUnreadCount).mockResolvedValue(1);
    vi.mocked(markNotificationRead).mockRejectedValue(new ApiError("boom", 500));
    vi.mocked(fetchNotifications).mockResolvedValue({ items: [noti()], totalElements: 1, totalPages: 1, page: 0, size: 10, unreadCount: 1 });
    renderSidebar();
    await userEvent.click(screen.getByTestId("notification-bell"));
    await userEvent.click(await screen.findByText("Tiêu đề 1"));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/settings/notifications"));
  });

  it("'Đọc tất cả' gọi API và báo sidebar đếm lại", async () => {
    vi.mocked(getUnreadCount).mockResolvedValue(2);
    vi.mocked(fetchNotifications).mockResolvedValue({ items: [noti()], totalElements: 1, totalPages: 1, page: 0, size: 10, unreadCount: 2 });
    renderSidebar();
    await userEvent.click(screen.getByTestId("notification-bell"));
    await screen.findByText("Tiêu đề 1");
    vi.mocked(getUnreadCount).mockResolvedValue(0);
    await userEvent.click(screen.getByText("Đọc tất cả"));
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(document.querySelector(".noti-badge")).toBeNull());
  });

  it("dropdown rỗng và dropdown lỗi có thông điệp riêng, không lẫn với 'chưa tích hợp'", async () => {
    vi.mocked(getUnreadCount).mockResolvedValue(0);
    vi.mocked(fetchNotifications).mockResolvedValueOnce({ items: [], totalElements: 0, totalPages: 0, page: 0, size: 10, unreadCount: 0 });
    renderSidebar();
    await userEvent.click(screen.getByTestId("notification-bell"));
    expect(await screen.findByText("Không có thông báo nào")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    vi.mocked(fetchNotifications).mockRejectedValueOnce(new ApiError("x", 500));
    await userEvent.click(screen.getByTestId("notification-bell"));
    expect(await screen.findByTestId("notification-error")).toHaveTextContent("Không tải được thông báo");
    expect(screen.queryByTestId("notification-waiting")).toBeNull();
  });

  it("lỗi khi đếm giữ nguyên số thật gần nhất, không bịa số", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(getUnreadCount).mockResolvedValueOnce(4).mockRejectedValue(new ApiError("x", 500));
      renderSidebar();
      await waitFor(() => expect(document.querySelector(".noti-badge")?.textContent).toBe("4"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(screen.getByTestId("notification-bell")).toHaveAttribute("data-unread-status", "error");
      expect(document.querySelector(".noti-badge")?.textContent).toBe("4");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("toast ticket trong sidebar", () => {
  it("Admin: hiện toast biến thể 'manager' đếm mọi ticket; khóa phiên theo người dùng ngăn hiện lại", async () => {
    vi.mocked(getTickets).mockResolvedValue([
      { id: "1", status: "OPEN", assignedId: "x" },
      { id: "2", status: "DONE", assignedId: "y" },
    ]);
    renderSidebar();
    const toast = await screen.findByTestId("ticket-welcome-toast");
    expect(toast).toHaveClass("is-manager");
    expect(toast).toHaveTextContent("Đang mở: 1");
    expect(toast).toHaveTextContent("Đang chờ duyệt: 1");
    expect(screen.getByText("Quản lý ngay").closest("a")).toHaveAttribute("href", "/admin/tickets");
    expect(window.sessionStorage.getItem("tm_notified_u-admin-1")).toBe("true");
  });

  it("Giảng viên: chỉ đếm ticket giao cho chính mình, biến thể 'instructor', liên kết tới danh sách công việc", async () => {
    pathname = "/instructor/list-class";
    vi.mocked(getTickets).mockResolvedValue([
      { id: "1", status: "OPEN", assignedId: "u-teacher-1" },
      { id: "2", status: "OPEN", assignedId: "someone-else" },
      { id: "3", status: "DONE", assignedId: "u-teacher-1" },
      { id: "4", status: "CLOSE", assignedId: "u-teacher-1" },
    ]);
    renderSidebar("instructor");
    const toast = await screen.findByTestId("ticket-welcome-toast");
    expect(toast).toHaveClass("is-instructor");
    expect(toast).toHaveTextContent("Đang thực hiện: 1");
    expect(toast).toHaveTextContent("Đã báo cáo: 1");
    expect(screen.getByText("Xem danh sách").closest("a")).toHaveAttribute("href", "/instructor/instructor-tickets");
  });

  it("chưa cấu hình dịch vụ ticket: không hiện toast, không ghi khóa phiên", async () => {
    renderSidebar();
    await waitFor(() => expect(getTickets).toHaveBeenCalled());
    expect(screen.queryByTestId("ticket-welcome-toast")).toBeNull();
    expect(window.sessionStorage.getItem("tm_notified_u-admin-1")).toBeNull();
  });

  it("không có ticket OPEN/DONE: không hiện toast nhưng đã ghi khóa (không hỏi lại trong phiên)", async () => {
    vi.mocked(getTickets).mockResolvedValue([{ id: "1", status: "CLOSE", assignedId: "x" }]);
    renderSidebar();
    await waitFor(() => expect(window.sessionStorage.getItem("tm_notified_u-admin-1")).toBe("true"));
    expect(screen.queryByTestId("ticket-welcome-toast")).toBeNull();
  });

  it("đã có khóa phiên: không gọi API; nút đóng ẩn toast", async () => {
    window.sessionStorage.setItem("tm_notified_u-admin-1", "true");
    renderSidebar();
    await new Promise((r) => setTimeout(r, 20));
    expect(getTickets).not.toHaveBeenCalled();

    window.sessionStorage.clear();
    vi.mocked(getTickets).mockResolvedValue([{ id: "1", status: "OPEN", assignedId: "x" }]);
    cleanup();
    renderSidebar();
    await userEvent.click(await screen.findByRole("button", { name: "Đóng" }));
    expect(screen.queryByTestId("ticket-welcome-toast")).toBeNull();
  });

  it("tự đóng sau 10 giây", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(getTickets).mockResolvedValue([{ id: "1", status: "OPEN", assignedId: "x" }]);
      renderSidebar();
      await screen.findByTestId("ticket-welcome-toast");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(screen.queryByTestId("ticket-welcome-toast")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
