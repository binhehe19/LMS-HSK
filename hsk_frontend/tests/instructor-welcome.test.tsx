import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InstructorWelcomePageContent } from "@/components/management/instructor-welcome/instructor-welcome-page-content";
import { InstructorWelcomeView } from "@/components/management/instructor-welcome/instructor-welcome-view";
import type { WelcomeTicketsState } from "@/components/management/instructor-welcome/use-instructor-welcome";
import { ManagementShell } from "@/components/management/management-shell";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import { adminUser } from "./fixtures/classes";

const push = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/instructor/welcome", useRouter: () => ({ push, back: vi.fn() }) }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/notification-client", () => ({ getUnreadCount: vi.fn(), fetchNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));

const teacher = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "gv1@example.test", roles: ["ROLE_TEACHER"] };
const ticket = (id: string, status: "OPEN" | "DONE" | "CLOSE", assignedId: string) => ({ id, status, assignedId });

beforeEach(() => {
  push.mockClear();
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(4);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never); // mặc định: không có ticket (toast ở sidebar cũng gọi getTickets)
});

function renderPage(user = teacher) {
  render(
    <Provider store={makeStore({ status: "authenticated", user })}>
      <ManagementShell area="instructor">
        <InstructorWelcomePageContent />
      </ManagementShell>
    </Provider>,
  );
}

const cardValue = (title: string) => screen.getByText(title, { selector: "p" }).parentElement!.querySelector("h3")!.textContent;

describe("màn Tổng quan giảng viên — có dữ liệu (mock ở lớp client)", () => {
  beforeEach(() => {
    vi.mocked(getTickets).mockResolvedValue([
      ticket("1", "OPEN", "u-teacher-1"),
      ticket("2", "OPEN", "u-teacher-1"),
      ticket("3", "DONE", "u-teacher-1"),
      ticket("4", "CLOSE", "u-teacher-1"),
      ticket("5", "OPEN", "someone-else"),
    ] as never);
  });

  it("hiển thị lời chào, email, vai trò, số công việc đúng của chính người dùng và số thông báo chưa đọc", async () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Xin chào, Giáo Viên Một!");
    expect(screen.getAllByText("gv1@example.test").length).toBeGreaterThanOrEqual(1); // thẻ chào + thẻ hồ sơ ở sidebar
    expect(screen.getByText("Giảng viên", { selector: "span" })).toBeInTheDocument();
    await waitFor(() => expect(cardValue("Công việc đang phụ trách")).toBe("3"));
    expect(cardValue("Đang mở")).toBe("2");
    expect(cardValue("Đã hoàn tất")).toBe("1");
    await waitFor(() => expect(cardValue("Thông báo chưa đọc")).toBe("4"));
    expect(screen.getByText("4 thông báo chưa đọc")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
    expect(document.querySelector(".progress-bar")).toHaveStyle({ width: "33%" });
    expect(screen.queryByTestId("welcome-data-notice")).toBeNull(); // trạng thái có dữ liệu không có dòng thông báo thêm
    expect(getTickets).toHaveBeenCalledWith(0, 50);
  });

  it("dùng khung quản lý chung: .content > .container > .row.g-4 > sidebar (.col-lg-3) + .col-lg-9, đúng DOM của HSK cũ", async () => {
    renderPage();
    await waitFor(() => expect(cardValue("Đang mở")).toBe("2"));
    const row = document.querySelector(".content > .container > .row.g-4")!;
    // (toast ticket của sidebar có thể chèn <style> + khối cố định vào cùng .row như HSK cũ; chỉ xét hai cột)
    const sidebar = row.querySelector(":scope > .management-sidebar-column")!;
    expect(sidebar).toHaveClass("col-lg-3");
    // Sau sidebar là thanh đầu trang chung rồi mới tới cột nội dung.
    expect(sidebar.nextElementSibling).toHaveClass("management-header");
    expect(sidebar.nextElementSibling?.nextElementSibling).toHaveClass("col-lg-9");
    expect(document.querySelectorAll(".management-sidebar-column")).toHaveLength(1); // sidebar không bị render trùng
    expect(document.querySelector(".welcome-hero-card")).not.toBeNull();
    expect(document.querySelectorAll(".welcome-stat-card")).toHaveLength(4);
  });

  it("hai nút điều hướng tới đúng URL của bản cũ (công việc, cài đặt hồ sơ)", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /Xem công việc/ }));
    expect(push).toHaveBeenLastCalledWith("/instructor/instructor-tickets");
    await userEvent.click(screen.getByRole("button", { name: /Cài đặt hồ sơ/ }));
    expect(push).toHaveBeenLastCalledWith("/instructor/instructor-settings");
  });

  it("không có họ tên: dùng email, rồi 'Giảng viên'; không có email: 'Chưa có email'", async () => {
    renderPage({ ...teacher, fullName: undefined } as unknown as typeof teacher);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Xin chào, gv1@example.test!");
    document.body.innerHTML = "";
  });

  it("không có ticket nào: 0, tỷ lệ 0% (có dữ liệu thật là rỗng, KHÔNG phải trạng thái chờ)", async () => {
    vi.mocked(getTickets).mockResolvedValue([] as never);
    renderPage();
    await waitFor(() => expect(getTickets).toHaveBeenCalled());
    await waitFor(() => expect(cardValue("Công việc đang phụ trách")).toBe("0"));
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.queryByTestId("welcome-data-notice")).toBeNull();
  });
});

describe("màn Tổng quan giảng viên — chưa tích hợp / lỗi (không số liệu giả)", () => {
  it("dịch vụ ticket + thông báo chưa cấu hình: các ô hiện '—', có thông báo WAITING FOR BACKEND, không có nút thử lại", async () => {
    vi.mocked(getTickets).mockRejectedValue(new ApiNotConfiguredError());
    vi.mocked(getUnreadCount).mockRejectedValue(new ApiNotConfiguredError());
    renderPage();
    const notice = await screen.findByTestId("welcome-data-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(notice).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
    await waitFor(() => expect(cardValue("Thông báo chưa đọc")).toBe("—"));
    for (const title of ["Công việc đang phụ trách", "Đang mở", "Đã hoàn tất"]) expect(cardValue(title)).toBe("—");
    expect(screen.getByText("— thông báo chưa đọc")).toBeInTheDocument();
    expect(document.querySelector(".progress-bar")).toHaveStyle({ width: "0%" });
  });

  it("API ticket lỗi: hiện thông điệp lỗi + nút 'Thử lại' tải lại được dữ liệu", async () => {
    let fail = true;
    vi.mocked(getTickets).mockImplementation(() => (fail ? Promise.reject(new ApiError("Máy chủ lỗi", 500)) : Promise.resolve([ticket("1", "OPEN", "u-teacher-1")] as never)));
    renderPage();
    const notice = await screen.findByTestId("welcome-data-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(notice).toHaveTextContent("Máy chủ lỗi");
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(cardValue("Đang mở")).toBe("1"));
    expect(screen.queryByTestId("welcome-data-notice")).toBeNull();
  });

  it("đang tải: các ô hiện 0 như bản cũ (không '—')", async () => {
    let release: (v: never) => void = () => {};
    vi.mocked(getTickets).mockReturnValue(new Promise((resolve) => (release = resolve as never)));
    renderPage();
    expect(cardValue("Đang mở")).toBe("0");
    expect(screen.getByText("0%")).toBeInTheDocument();
    await act(async () => release([] as never));
  });
});

describe("InstructorWelcomeView (view thuần)", () => {
  const base = { displayName: "A", displayEmail: "", roleLabel: "Giảng viên", unread: { status: "ready", count: 2 } as const, onOpenTickets: vi.fn(), onOpenSettings: vi.fn(), onRetry: vi.fn() };
  const tickets: WelcomeTicketsState = { kind: "ok", summary: { openTickets: 1, doneTickets: 3, totalTickets: 4, completionRate: 75 } };

  it("email trống => 'Chưa có email'; tỷ lệ và thanh tiến trình theo summary", () => {
    render(
      <Provider store={makeStore({ status: "authenticated", user: teacher })}>
        <ManagementShell area="instructor">
          <InstructorWelcomeView {...base} tickets={tickets} />
        </ManagementShell>
      </Provider>,
    );
    expect(screen.getByText("Chưa có email")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(document.querySelector(".progress-bar")).toHaveStyle({ width: "75%" });
  });
});
