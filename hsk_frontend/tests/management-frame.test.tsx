import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import { ManagementShell } from "@/components/management/management-shell";
import { makeStore } from "@/redux/store";
import { adminUser } from "./fixtures/classes";

vi.mock("next/navigation", () => ({ usePathname: () => "/instructor/list-class", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
// Không mock notification/ticket client: biến môi trường để trống nên chúng ném ApiNotConfiguredError (WAITING FOR BACKEND) như thật.

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
});

function renderFrame(area: "admin" | "instructor") {
  render(
    <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
      <ManagementShell area={area}>
        <ManagementPageFrame contentClassName="demo-page">
          <p data-testid="page-body">nội dung trang</p>
        </ManagementPageFrame>
      </ManagementShell>
    </Provider>,
  );
}

describe("ManagementPageFrame + ManagementShell", () => {
  it("khung: .content > .container > .row > (sidebar .col-lg-3 + thanh đầu trang + .col-lg-9)", () => {
    renderFrame("admin");
    const content = document.querySelector(".content.demo-page")!;
    const row = content.querySelector(":scope > .container > .row")!;
    expect(row.children).toHaveLength(3);
    expect(row.children[0]).toHaveClass("col-lg-3", "management-sidebar-column");
    expect(row.children[1]).toHaveClass("management-header");
    expect(row.children[2]).toHaveClass("col-lg-9");
    // Thanh đầu trang tách khỏi vùng nội dung: không nằm trong cột nội dung (cột này tự cuộn).
    expect(row.children[2]).toContainElement(screen.getByTestId("page-body"));
    expect(row.children[2]).not.toContainElement(row.children[1] as HTMLElement);
    expect(document.querySelector(".main-wrapper .sidebar-overlay")).not.toBeNull();
  });

  it("area=admin hiện sidebar Admin; area=instructor hiện sidebar Giảng viên (không lẫn menu)", () => {
    renderFrame("admin");
    expect(screen.getByText("LMS · Admin")).toBeInTheDocument();
    expect(screen.getByText("Người dùng")).toBeInTheDocument();
    expect(screen.queryByText("Thông báo của tôi")).toBeNull();
  });

  it("area=instructor", () => {
    renderFrame("instructor");
    expect(screen.getByText("LMS · Quản lý")).toBeInTheDocument();
    expect(screen.getByText("Thông báo của tôi")).toBeInTheDocument();
    expect(screen.queryByText("Người dùng")).toBeNull();
  });

  it("dùng khung ngoài ManagementShell là lỗi lập trình, không âm thầm chọn một vai trò", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
          <ManagementPageFrame>x</ManagementPageFrame>
        </Provider>,
      ),
    ).toThrow(/ManagementShell/);
    spy.mockRestore();
  });
});
