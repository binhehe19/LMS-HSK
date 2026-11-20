import { cleanup, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ManagementPlaceholderPage from "@/app/(management)/[...slug]/page";
import { MigrationPlaceholder } from "@/components/management/migration-placeholder/migration-placeholder";
import { ManagementShell } from "@/components/management/management-shell";
import { makeStore } from "@/redux/store";
import { adminUser } from "./fixtures/classes";

const back = vi.fn();
vi.mock("next/navigation", async () => {
  // notFound giữ nguyên hành vi thật của Next (ném lỗi NEXT_HTTP_ERROR_FALLBACK;404); chỉ giả router/pathname.
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return { ...actual, usePathname: () => "/pronunciation/manage", useRouter: () => ({ push: vi.fn(), back }) };
});

beforeEach(() => {
  back.mockClear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
});

function renderPlaceholder(pathname: string, roles: string[], area: "admin" | "instructor") {
  render(
    <Provider store={makeStore({ status: "authenticated", user: { ...adminUser, roles } })}>
      <ManagementShell area={area}>
        <MigrationPlaceholder pathname={pathname} />
      </ManagementShell>
    </Provider>,
  );
}

describe("MigrationPlaceholder", () => {
  it("nằm trong khung quản lý (sidebar giữ nguyên), nêu rõ chức năng đang chuyển đổi và tên mục menu", () => {
    renderPlaceholder("/pronunciation/manage", ["ROLE_ADMIN"], "admin");
    expect(screen.getByText("Chức năng đang được chuyển đổi")).toBeInTheDocument();
    expect(screen.getByTestId("migration-placeholder")).toHaveTextContent("Luyện phát âm");
    expect(screen.getByTestId("migration-placeholder")).toHaveAttribute("data-route", "/pronunciation/manage");
    expect(document.querySelector(".management-sidebar-column .sidebar-menu")).not.toBeNull();
    // Mục menu của route này vẫn hiện (không mất menu).
    expect(screen.getAllByText("Luyện phát âm").length).toBeGreaterThan(1);
  });

  it("Admin: có liên kết về màn hình đã chuyển đầu tiên của menu Admin (Overview, M5)", () => {
    renderPlaceholder("/admin/profile", ["ROLE_ADMIN"], "admin");
    const link = screen.getByTestId("placeholder-home-link");
    expect(link).toHaveAttribute("href", "/admin/dashboard");
    expect(link).toHaveTextContent("Overview");
    expect(screen.queryByTestId("placeholder-no-home")).toBeNull();
  });

  it("Teacher: có liên kết về màn đã chuyển (Tổng quan)", () => {
    renderPlaceholder("/pronunciation/manage", ["ROLE_TEACHER"], "instructor");
    const link = screen.getByTestId("placeholder-home-link");
    expect(link).toHaveAttribute("href", "/instructor/welcome");
    expect(link).toHaveTextContent("Tổng quan");
  });

  it("vai trò không có màn đã chuyển nào: KHÔNG có liên kết giả; nói rõ điều đó", () => {
    renderPlaceholder("/pronunciation/manage", ["ROLE_TEACHER_MANAGER"], "instructor");
    expect(screen.queryByTestId("placeholder-home-link")).toBeNull();
    expect(screen.getByTestId("placeholder-no-home")).toHaveTextContent("chưa có màn hình quản lý nào đã chuyển");
  });

  it("route không có trong menu vẫn hiện được (không tiêu đề cụ thể)", () => {
    renderPlaceholder("/admin/class-management/students", ["ROLE_ADMIN"], "admin");
    expect(screen.getByTestId("migration-placeholder")).toHaveTextContent("Màn hình này đang được chuyển");
  });

  it("nút 'Quay lại trang trước' chỉ có khi có trang trước (Navigation API), và gọi router.back", () => {
    const setNavigation = (value: unknown) => Object.defineProperty(window, "navigation", { configurable: true, value });
    setNavigation({ canGoBack: false });
    renderPlaceholder("/pronunciation/manage", ["ROLE_ADMIN"], "admin");
    expect(screen.queryByTestId("placeholder-back")).toBeNull();
    cleanup();
    setNavigation({ canGoBack: true });
    renderPlaceholder("/pronunciation/manage", ["ROLE_ADMIN"], "admin");
    screen.getByTestId("placeholder-back").click();
    expect(back).toHaveBeenCalledTimes(1);
    setNavigation(undefined);
  });

  it("trình duyệt không có Navigation API: dựa vào history.length", () => {
    Object.defineProperty(window, "navigation", { configurable: true, value: undefined });
    const original = Object.getOwnPropertyDescriptor(window.history, "length");
    Object.defineProperty(window.history, "length", { configurable: true, value: 1 });
    renderPlaceholder("/pronunciation/manage", ["ROLE_ADMIN"], "admin");
    expect(screen.queryByTestId("placeholder-back")).toBeNull();
    cleanup();
    Object.defineProperty(window.history, "length", { configurable: true, value: 3 });
    renderPlaceholder("/pronunciation/manage", ["ROLE_ADMIN"], "admin");
    expect(screen.getByTestId("placeholder-back")).toBeInTheDocument();
    if (original) Object.defineProperty(window.history, "length", original);
  });
});

describe("trang động [...slug]: chỉ NOT_MIGRATED mới có placeholder, còn lại là 404", () => {
  const call = (slug: string[]) => ManagementPlaceholderPage({ params: Promise.resolve({ slug }) });

  // Route HSK cũ hợp lệ CHƯA chuyển (sau M5 không còn mục menu nào là placeholder): Admin-only, dùng chung ALL5, và route con.
  it.each([["admin", "profile"], ["learning-path", "manage"], ["kanji-origin", "manage"], ["kanji-origin", "manage", "select-type"], ["admin", "learning-path", "manage"]])(
    "/%s => placeholder",
    async (...slug) => {
      const element = await call(slug);
      expect(element.props.pathname).toBe(`/${slug.join("/")}`);
    },
  );

  it.each([
    [["hanzi", "manage"]],
    [["random"]],
    [["admin", "does-not-exist"]],
    [["admin"]],
    [["kanji-origin", "manage", "extra"]],
    [["instructor", "welcome"]], // MIGRATED: trang thật do route tĩnh phục vụ, catch-all không phục vụ
    [["instructor", "list-class"]], // MIGRATED (M4A)
    [["instructor", "list-class", "list-lesson"]], // MIGRATED (M4B)
    [["admin", "dashboard"]], // MIGRATED (M5)
    [["instructor", "list-class", "submissions"]], // MIGRATED (M5)
    [["admin", "class-management", "students"]], // MIGRATED (M5)
    [["teacher-manager", "dashboard"]], // UNKNOWN (role chưa xác minh)
    [["admin", "courses"]], // OUT_OF_SCOPE
    [["quiz"]], // route học viên: ngoài phạm vi
  ])("%j => notFound() (HTTP 404)", async (slug) => {
    await expect(call(slug)).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });
});
