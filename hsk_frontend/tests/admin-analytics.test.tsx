import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAnalyticsPageContent } from "@/components/management/admin-analytics/admin-analytics-page-content";
import { AdminAnalyticsView } from "@/components/management/admin-analytics/admin-analytics-view";
import { useAdminAnalytics } from "@/components/management/admin-analytics/use-admin-analytics";
import { ManagementShell } from "@/components/management/management-shell";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import type { AnalyticsDays } from "@/lib/admin-overview/analytics-model";
import { getAnalyticsOverview } from "@/lib/api/admin-overview-client";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { AnalyticsOverview } from "@/types/admin-overview";
import { analyticsFixture } from "./fixtures/admin-overview";
import { adminUser } from "./fixtures/classes";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/analytics", useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/notification-client", () => ({ getUnreadCount: vi.fn(), fetchNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
vi.mock("@/lib/api/admin-overview-client", () => ({ getDashboardOverview: vi.fn(), getAnalyticsOverview: vi.fn() }));
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
  vi.mocked(getAnalyticsOverview).mockReset();
});

function wrap(node: React.ReactNode) {
  return render(
    <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
      <ManagementShell area="admin">{node}</ManagementShell>
    </Provider>,
  );
}
const renderView = (state: FetchState<AnalyticsOverview>, props: { days?: AnalyticsDays; onDaysChange?: (d: AnalyticsDays) => void; onRetry?: () => void } = {}) =>
  wrap(<AdminAnalyticsView state={state} days={props.days ?? 7} onDaysChange={props.onDaysChange ?? vi.fn()} onRetry={props.onRetry ?? vi.fn()} />);
const summary = (label: string) => document.querySelector(`[data-testid="analytics-summary-value"][data-stat="${label}"]`)?.textContent;
const charts = () => [...document.querySelectorAll('[data-testid="apex-chart"]')] as HTMLElement[];
const dayButton = (d: number) => screen.getByRole("button", { name: `${d} ngày` });

describe("AdminAnalyticsView (view thuần, fixture)", () => {
  it("có dữ liệu: 3 thẻ (số rút gọn, TB/ngày theo cửa sổ), biểu đồ area theo ngày + donut theo module, bảng Top hành vi với nhãn tiếng Việt và mã lạ giữ nguyên", () => {
    renderView({ kind: "ok", data: analyticsFixture });
    expect(screen.getByText("Phân tích hành vi học viên")).toBeInTheDocument();
    expect(summary("Tổng sự kiện")).toBe("12.6K");
    expect(summary("Học viên hoạt động")).toBe("342");
    expect(summary("TB sự kiện/ngày")).toBe("1.8K"); // 12600 / 7 = 1800
    const [area, donut] = charts();
    expect(area).toHaveAttribute("data-type", "area");
    expect(area).toHaveAttribute("data-labels", JSON.stringify(["21/10", "22/10", "23/10", "24/10", "25/10", "26/10", "27/10"]));
    expect(donut).toHaveAttribute("data-type", "donut");
    expect(donut).toHaveAttribute("data-labels", JSON.stringify(["Điều hướng", "Flashcard", "Quiz"]));
    const rows = within(screen.getByTestId("analytics-events-table")).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell")[1].textContent)).toEqual(["Xem trang", "Lật thẻ", "Bắt đầu bài học", "mystery_event"]);
    expect(rows.map((r) => within(r).getAllByRole("cell")[2].textContent)).toEqual(["5.2K", "2.1K", "1.8K", "900"]);
    expect(screen.queryByTestId("analytics-notice")).toBeNull();
    expect((document.querySelector(".content > .container > .row") as HTMLElement).className).toBe("row"); // bản cũ dùng .row trơn
  });

  it("nút 7/14/30 ngày: nút đang chọn là btn-primary + aria-pressed; bấm nút khác gọi onDaysChange", async () => {
    const onDaysChange = vi.fn();
    renderView({ kind: "ok", data: analyticsFixture }, { days: 7, onDaysChange });
    expect(dayButton(7)).toHaveClass("btn-primary");
    expect(dayButton(7)).toHaveAttribute("aria-pressed", "true");
    expect(dayButton(14)).toHaveClass("btn-outline-secondary");
    expect(dayButton(14)).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(dayButton(14));
    await userEvent.click(dayButton(30));
    expect(onDaysChange.mock.calls).toEqual([[14], [30]]);
  });

  it("TB sự kiện/ngày đổi theo cửa sổ đang chọn (bản cũ chia cho selectedDays)", () => {
    renderView({ kind: "ok", data: analyticsFixture }, { days: 30 });
    expect(summary("TB sự kiện/ngày")).toBe("420"); // 12600 / 30
  });

  it("đang tải: spinner + 'Đang tải dữ liệu phân tích...', không có thẻ số liệu", () => {
    renderView({ kind: "loading" });
    expect(screen.getByTestId("analytics-loading")).toHaveTextContent("Đang tải dữ liệu phân tích...");
    expect(document.querySelector(".spinner-border")).not.toBeNull();
    expect(document.querySelectorAll('[data-testid="analytics-summary-value"]')).toHaveLength(0);
    // nút chọn ngày vẫn dùng được trong lúc tải
    expect(dayButton(30)).toBeEnabled();
  });

  it("chưa tích hợp: WAITING FOR BACKEND không có 'Thử lại'; lỗi: thông điệp + 'Thử lại' gọi onRetry", async () => {
    const { unmount } = renderView({ kind: "waiting" });
    const waiting = screen.getByTestId("analytics-notice");
    expect(waiting).toHaveAttribute("data-kind", "waiting");
    expect(waiting).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
    expect(charts()).toHaveLength(0);
    unmount();

    const onRetry = vi.fn();
    renderView({ kind: "error", message: "Máy chủ lỗi" }, { onRetry });
    const failed = screen.getByTestId("analytics-notice");
    expect(failed).toHaveAttribute("data-kind", "error");
    expect(failed).toHaveTextContent("Máy chủ lỗi");
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("dữ liệu rỗng thật: thẻ hiện 0, ba khối 'Chưa có dữ liệu', không có biểu đồ, không có dòng lỗi", () => {
    renderView({ kind: "ok", data: { ...analyticsFixture, totalEvents: 0, activeUsers: 0, eventBreakdown: [], moduleBreakdown: [], dailyTrend: [] } });
    expect(summary("Tổng sự kiện")).toBe("0");
    expect(summary("TB sự kiện/ngày")).toBe("0");
    expect(screen.getByTestId("analytics-trend-empty")).toHaveTextContent("Chưa có dữ liệu");
    expect(screen.getByTestId("analytics-modules-empty")).toHaveTextContent("Chưa có dữ liệu");
    expect(screen.getByTestId("analytics-events-empty")).toHaveTextContent("Chưa có dữ liệu");
    expect(charts()).toHaveLength(0);
    expect(screen.queryByTestId("analytics-notice")).toBeNull();
  });
});

describe("useAdminAnalytics (hook, client giả)", () => {
  it("khoá theo days: đổi 7 => 14 gọi lại với 14 và BỎ phản hồi trễ của cửa sổ cũ", async () => {
    let releaseSeven: (v: AnalyticsOverview) => void = () => {};
    vi.mocked(getAnalyticsOverview).mockImplementation((days: number) =>
      days === 7 ? new Promise<AnalyticsOverview>((r) => (releaseSeven = r)) : Promise.resolve({ ...analyticsFixture, period: { from: "2026-10-14", to: "2026-10-27", days: 14 }, totalEvents: 25_000 }),
    );
    const { result, rerender } = renderHook(({ days }: { days: AnalyticsDays }) => useAdminAnalytics(days), { initialProps: { days: 7 } });
    expect(result.current.state.kind).toBe("loading");
    rerender({ days: 14 });
    await waitFor(() => expect(result.current.state).toMatchObject({ kind: "ok", data: { totalEvents: 25_000 } }));
    await act(async () => releaseSeven({ ...analyticsFixture, totalEvents: 1 })); // phản hồi của 7 ngày về sau: không được ghi đè
    expect(result.current.state).toMatchObject({ kind: "ok", data: { totalEvents: 25_000 } });
    expect(vi.mocked(getAnalyticsOverview).mock.calls.map((c) => c[0])).toEqual([7, 14]);
  });

  it("chưa cấu hình => waiting; phản hồi sai hợp đồng => error 'không đúng định dạng'", async () => {
    vi.mocked(getAnalyticsOverview).mockRejectedValueOnce(new ApiNotConfiguredError());
    const waiting = renderHook(() => useAdminAnalytics(7));
    await waitFor(() => expect(waiting.result.current.state.kind).toBe("waiting"));

    vi.mocked(getAnalyticsOverview).mockResolvedValueOnce({ totalEvents: 5 } as never);
    const malformed = renderHook(() => useAdminAnalytics(7));
    await waitFor(() => expect(malformed.result.current.state.kind).toBe("error"));
    expect(JSON.stringify(malformed.result.current.state)).toContain("không đúng định dạng");
  });
});

describe("AdminAnalyticsPageContent (container)", () => {
  it("mặc định 7 ngày; bấm '30 ngày' tải lại với 30 và hiện số liệu mới; lỗi có 'Thử lại'", async () => {
    vi.mocked(getAnalyticsOverview).mockImplementation((days: number) => (days === 7 ? Promise.resolve(analyticsFixture) : Promise.resolve({ ...analyticsFixture, totalEvents: 36_000, period: { from: "2026-09-28", to: "2026-10-27", days: 30 } })));
    wrap(<AdminAnalyticsPageContent />);
    await waitFor(() => expect(summary("Tổng sự kiện")).toBe("12.6K"));
    expect(getAnalyticsOverview).toHaveBeenCalledWith(7);
    await userEvent.click(dayButton(30));
    await waitFor(() => expect(summary("Tổng sự kiện")).toBe("36.0K"));
    expect(summary("TB sự kiện/ngày")).toBe("1.2K"); // 36000 / 30
    expect(getAnalyticsOverview).toHaveBeenLastCalledWith(30);

    vi.mocked(getAnalyticsOverview).mockRejectedValueOnce(new ApiError("Hệ thống đang tạm thời gián đoạn", 503)).mockResolvedValueOnce(analyticsFixture);
    await userEvent.click(dayButton(14));
    expect(await screen.findByTestId("analytics-notice")).toHaveTextContent("Hệ thống đang tạm thời gián đoạn");
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(summary("Tổng sự kiện")).toBe("12.6K"));
  });
});
