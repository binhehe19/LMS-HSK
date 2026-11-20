import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConfigProvider, theme } from "antd";
import type { ReactNode } from "react";
import StudentShell from "@/components/student/dashboard/student-shell";
import StudentAuth from "@/components/student/student-auth";
import { StudentContentState, StudentFetchError } from "@/components/student/student-content-state";
import { brandTheme, desktopTheme } from "@/theme/brand-tokens";

const route = vi.hoisted(() => ({ pathname: "/student/student-quiz" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/student/student-data", () => ({
  StudentDataProvider: ({ children }: { children: ReactNode }) => children,
  useStudentIdentity: () => ({ name: "Học viên", avatarUrl: "/assets/avatar.png" }),
  useStudentData: () => ({ history: { loading: false } }),
}));
vi.mock("@/components/auth/auth-initializer", () => ({ AuthInitializer: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/auth/require-auth", () => ({ RequireAuth: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/student/student-notifications", () => ({ default: () => null }));
afterEach(() => vi.restoreAllMocks());

it("dùng chung điều hướng cho cả trang có sidebar, nội dung rộng và nội dung tràn lề", () => {
  const { rerender } = render(<StudentShell>Trang học viên</StudentShell>);
  const nav = within(screen.getByRole("navigation", { name: "Điều hướng chính" }));
  expect(nav.getByRole("link", { name: "Luyện tập" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("navigation", { name: "Bảng điều khiển học sinh" })).toBeInTheDocument();

  route.pathname = "/quiz-session/attempt/result";
  rerender(<StudentShell layout="wide">Kết quả</StudentShell>);
  expect(nav.getByRole("link", { name: "Thời khóa biểu" })).toHaveAttribute("aria-current", "location");
  expect(screen.getByRole("main").closest("[data-layout]")).toHaveAttribute("data-layout", "wide");
  expect(screen.queryByRole("navigation", { name: "Bảng điều khiển học sinh" })).not.toBeInTheDocument();

  rerender(<StudentShell layout="bleed" spacing="game">Game</StudentShell>);
  const frame = screen.getByRole("main").closest("[data-layout]");
  expect(frame).toHaveAttribute("data-layout", "bleed");
  expect(frame).toHaveAttribute("data-spacing", "game");

  route.pathname = "/vocabulary/example";
  rerender(<StudentShell layout="wide">Chi tiết từ vựng</StudentShell>);
  expect(nav.getByRole("link", { name: "Từ điển" })).toHaveAttribute("aria-current", "location");
  expect(nav.getByRole("link", { name: "Thời khóa biểu" })).not.toHaveAttribute("aria-current");
});

it("dùng thông báo Ant Design trên desktop và giữ thông báo hiện tại trên mobile", () => {
  const matchMedia = window.matchMedia.bind(window);
  const media = vi.spyOn(window, "matchMedia").mockImplementation(query => ({
    ...matchMedia(query),
    matches: query === "(min-width: 992px)",
  }));
  const retry = vi.fn();
  const notice = <StudentFetchError title="Lỗi tải" description="Internal Server Error" mobileContent="Lỗi kết nối" onRetry={retry} />;
  const { rerender } = render(notice);
  const alert = screen.getByRole("alert");
  expect(alert).toHaveAttribute("data-kind", "error");
  expect(alert).toHaveTextContent("Lỗi tải");
  expect(alert).not.toHaveTextContent("Internal Server Error");
  fireEvent.click(within(alert).getByRole("button", { name: "Thử lại" }));
  expect(retry).toHaveBeenCalledOnce();

  media.mockRestore();
  rerender(<StudentFetchError title="Lỗi tải" description="Internal Server Error" mobileContent="Lỗi kết nối" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Lỗi kết nối");

  rerender(<StudentContentState kind="loading">Đang tải</StudentContentState>);
  expect(screen.getByRole("status")).toHaveAttribute("data-state", "loading");
  rerender(<StudentContentState kind="empty">Chưa có dữ liệu</StudentContentState>);
  expect(screen.getByRole("status")).toHaveAttribute("data-state", "empty");
});

it("chỉ áp dụng token desktop của Admin trong khung học viên ở breakpoint desktop", () => {
  const matchMedia = window.matchMedia.bind(window);
  let desktop = true;
  vi.spyOn(window, "matchMedia").mockImplementation(query => ({
    ...matchMedia(query),
    matches: desktop && query === "(min-width: 992px)",
  }));
  function ActiveRadius() {
    return <span>{theme.useToken().token.borderRadius}</span>;
  }
  const view = () => <ConfigProvider theme={brandTheme}><StudentAuth><ActiveRadius /></StudentAuth></ConfigProvider>;
  const { rerender } = render(view());
  const radius = String(desktopTheme.token?.borderRadius);
  expect(screen.getByText(radius)).toBeInTheDocument();

  desktop = false;
  rerender(view());
  expect(screen.queryByText(radius)).not.toBeInTheDocument();
});
