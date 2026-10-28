import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDashboardPageContent } from "@/components/management/admin-dashboard/admin-dashboard-page-content";
import { AdminDashboardView } from "@/components/management/admin-dashboard/admin-dashboard-view";
import { useAdminDashboard } from "@/components/management/admin-dashboard/use-admin-dashboard";
import { ManagementShell } from "@/components/management/management-shell";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { getDashboardOverview } from "@/lib/api/admin-overview-client";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { DashboardOverview } from "@/types/admin-overview";
import { dashboardFixture } from "./fixtures/admin-overview";
import { adminUser } from "./fixtures/classes";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/dashboard", useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/notification-client", () => ({ getUnreadCount: vi.fn(), fetchNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
vi.mock("@/lib/api/admin-overview-client", () => ({ getDashboardOverview: vi.fn(), getAnalyticsOverview: vi.fn() }));
// ApexCharts cần SVG/layout thật của trình duyệt; trong jsdom chỉ kiểm tra props truyền vào biểu đồ.
vi.mock("@/components/shared/apex-chart", () => ({
  ApexChart: ({ type, series, options }: { type?: string; series?: unknown; options?: { labels?: string[]; xaxis?: { categories?: string[] } } }) => (
    <div data-testid="apex-chart" data-type={type} data-series={JSON.stringify(series)} data-labels={JSON.stringify(options?.labels ?? options?.xaxis?.categories ?? null)} />
  ),
}));

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  // Chuông ở sidebar không thuộc màn này: để lời gọi treo (không resolve) nên không có cập nhật state ngoài act() sau các test view đồng bộ.
  vi.mocked(getUnreadCount).mockReset().mockReturnValue(new Promise<number>(() => {}));
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(getDashboardOverview).mockReset();
});

function wrap(node: React.ReactNode) {
  return render(
    <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
      <ManagementShell area="admin">{node}</ManagementShell>
    </Provider>,
  );
}
const renderView = (state: FetchState<DashboardOverview>, onRetry = vi.fn()) => wrap(<AdminDashboardView state={state} onRetry={onRetry} />);
const statValue = (title: string) => document.querySelector(`[data-testid="dash-stat-value"][data-stat="${title}"]`)?.textContent;
const revenueValue = (title: string) => document.querySelector(`[data-testid="dash-revenue-value"][data-stat="${title}"]`)?.textContent;
const charts = () => [...document.querySelectorAll('[data-testid="apex-chart"]')] as HTMLElement[];

describe("AdminDashboardView (view thuần, fixture)", () => {
  it("có dữ liệu: 4 thẻ người dùng + hàng BỔ SUNG 'Lớp học & chấm bài' + 3 thẻ doanh thu (vi-VN, VNĐ) + 2 biểu đồ theo dữ liệu API; không có dòng thông báo", () => {
    renderView({ kind: "ok", data: dashboardFixture });
    expect(screen.getByText("Thống kê người dùng")).toBeInTheDocument();
    expect(statValue("Tổng người dùng")).toBe("1.234");
    expect(statValue("Giảng viên")).toBe("48");
    expect(statValue("Quản lý giảng viên")).toBe("3");
    expect(statValue("Học viên")).toBe("1.150");
    // hàng bổ sung so với HSK cũ
    expect(screen.getByTestId("dash-class-grading-row")).toHaveTextContent("Lớp học & chấm bài");
    expect(statValue("Lớp đang học")).toBe("7");
    expect(statValue("Bài chờ chấm")).toBe("19");
    expect(statValue("Bài nộp tuần này")).toBe("86");
    expect(statValue("Đã trả bài tuần này")).toBe("54");
    expect(revenueValue("Tổng doanh thu hệ thống")).toBe("185.000.000 VNĐ");
    expect(revenueValue("Doanh thu Khóa học Video")).toBe("120.000.000 VNĐ");
    expect(revenueValue("Doanh thu Gói Thành viên")).toBe("65.000.000 VNĐ");
    expect(screen.getByTestId("dash-revenue-note")).toHaveTextContent("giả lập");
    expect(screen.getByText(/30 ngày gần nhất/)).toBeInTheDocument();
    const [bar, donut] = charts();
    expect(bar).toHaveAttribute("data-type", "bar");
    expect(bar).toHaveAttribute("data-labels", JSON.stringify(["Khóa học Video", "Gói Thành viên"]));
    expect(bar).toHaveAttribute("data-series", JSON.stringify([{ name: "Doanh thu", data: [120_000_000, 65_000_000] }]));
    expect(donut).toHaveAttribute("data-type", "donut");
    expect(donut).toHaveAttribute("data-labels", JSON.stringify(["HSK 3", "HSK 4", "Giao tiếp"]));
    expect(donut).toHaveAttribute("data-series", JSON.stringify([2, 3, 1]));
    expect(screen.queryByTestId("dashboard-notice")).toBeNull();
    expect(document.querySelector(".content > .container > .row.g-4 > .col-lg-9")).not.toBeNull(); // DOM .row g-4 của bản cũ
    expect(document.querySelectorAll(".management-sidebar-column")).toHaveLength(1);
  });

  it("doanh thu 0 và không có khóa học => trạng thái rỗng của bản cũ ('Chưa phát sinh doanh thu', 'Chưa có khóa học'), không vẽ biểu đồ, không có ghi chú", () => {
    renderView({ kind: "ok", data: { ...dashboardFixture, revenue: { total: 0, videoCourse: 0, membership: 0, byChannel: [] }, courseDistribution: [] } });
    expect(screen.getByTestId("dash-revenue-empty")).toHaveTextContent("Chưa phát sinh doanh thu");
    expect(screen.getByTestId("dash-courses-empty")).toHaveTextContent("Chưa có khóa học");
    expect(charts()).toHaveLength(0);
    expect(screen.queryByTestId("dash-revenue-note")).toBeNull();
    expect(revenueValue("Tổng doanh thu hệ thống")).toBe("0 VNĐ");
  });

  it("đang tải: placeholder trong các ô (như bản cũ), spinner ở hai biểu đồ, không có '—'", () => {
    renderView({ kind: "loading" });
    expect(document.querySelectorAll(".placeholder")).toHaveLength(11); // 8 thẻ thống kê + 3 thẻ doanh thu
    expect(document.querySelectorAll(".spinner-border")).toHaveLength(2);
    expect(document.body.textContent).not.toContain("—");
    expect(screen.queryByTestId("dashboard-notice")).toBeNull();
  });

  it("chưa tích hợp: WAITING FOR BACKEND không có 'Thử lại', mọi ô '—', biểu đồ hiện 'Chưa có dữ liệu để hiển thị' (không nói 'Chưa phát sinh doanh thu')", () => {
    renderView({ kind: "waiting" }, vi.fn());
    const notice = screen.getByTestId("dashboard-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(notice).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
    expect([...document.querySelectorAll('[data-testid="dash-stat-value"]')].map((n) => n.textContent)).toEqual(Array(8).fill("—"));
    expect([...document.querySelectorAll('[data-testid="dash-revenue-value"]')].map((n) => n.textContent)).toEqual(Array(3).fill("—"));
    expect(screen.getByTestId("dash-revenue-unavailable")).toBeInTheDocument();
    expect(screen.getByTestId("dash-courses-unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Chưa phát sinh doanh thu")).toBeNull();
    expect(charts()).toHaveLength(0);
  });

  it("lỗi: thông điệp lỗi + 'Thử lại' gọi onRetry; các ô '—'", async () => {
    const onRetry = vi.fn();
    renderView({ kind: "error", message: "Máy chủ lỗi" }, onRetry);
    const notice = screen.getByTestId("dashboard-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(notice).toHaveTextContent("Máy chủ lỗi");
    expect(statValue("Tổng người dùng")).toBe("—");
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("useAdminDashboard (hook, client giả)", () => {
  it("gọi getDashboardOverview(30) đúng một lần, loading => ok", async () => {
    vi.mocked(getDashboardOverview).mockResolvedValue(dashboardFixture);
    const { result } = renderHook(() => useAdminDashboard());
    expect(result.current.state).toEqual({ kind: "loading" });
    await waitFor(() => expect(result.current.state).toMatchObject({ kind: "ok", data: dashboardFixture }));
    expect(getDashboardOverview).toHaveBeenCalledTimes(1);
    expect(getDashboardOverview).toHaveBeenCalledWith(30);
  });

  it("chưa cấu hình => waiting; ApiError => error với thông điệp; phản hồi sai hợp đồng => error 'không đúng định dạng' (không hiện số 0 giả)", async () => {
    vi.mocked(getDashboardOverview).mockRejectedValueOnce(new ApiNotConfiguredError());
    const waiting = renderHook(() => useAdminDashboard());
    await waitFor(() => expect(waiting.result.current.state.kind).toBe("waiting"));

    vi.mocked(getDashboardOverview).mockRejectedValueOnce(new ApiError("Bạn không có quyền thực hiện thao tác này.", 403));
    const failed = renderHook(() => useAdminDashboard());
    await waitFor(() => expect(failed.result.current.state).toMatchObject({ kind: "error", message: "Bạn không có quyền thực hiện thao tác này." }));

    vi.mocked(getDashboardOverview).mockResolvedValueOnce({ totalUsers: 5 } as never);
    const malformed = renderHook(() => useAdminDashboard());
    await waitFor(() => expect(malformed.result.current.state.kind).toBe("error"));
    expect(JSON.stringify(malformed.result.current.state)).toContain("không đúng định dạng");
  });

  it("reload gọi API lần nữa và lấy được dữ liệu sau lỗi", async () => {
    vi.mocked(getDashboardOverview).mockRejectedValueOnce(new ApiError("lỗi", 500)).mockResolvedValueOnce(dashboardFixture);
    const { result } = renderHook(() => useAdminDashboard());
    await waitFor(() => expect(result.current.state.kind).toBe("error"));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.state.kind).toBe("ok"));
    expect(getDashboardOverview).toHaveBeenCalledTimes(2);
  });
});

describe("AdminDashboardPageContent (container + khung quản lý)", () => {
  it("tải một lần với cửa sổ 30 ngày và hiện số liệu; 'Thử lại' sau lỗi tải lại được", async () => {
    vi.mocked(getDashboardOverview).mockRejectedValueOnce(new ApiError("Máy chủ lỗi", 500)).mockResolvedValueOnce(dashboardFixture);
    wrap(<AdminDashboardPageContent />);
    expect(await screen.findByTestId("dashboard-notice")).toHaveTextContent("Máy chủ lỗi");
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(statValue("Tổng người dùng")).toBe("1.234"));
    expect(screen.queryByTestId("dashboard-notice")).toBeNull();
    expect(getDashboardOverview).toHaveBeenCalledTimes(2);
    expect(getDashboardOverview).toHaveBeenLastCalledWith(30);
  });
});
