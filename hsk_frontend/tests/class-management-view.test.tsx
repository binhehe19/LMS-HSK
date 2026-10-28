import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";
import { ManagementShell } from "@/components/management/management-shell";
import { ClassManagementView } from "@/components/management/class-management/class-management-view";
import type { ClassListState } from "@/components/management/class-management/use-admin-classes";
import { makeStore } from "@/redux/store";
import { adminUser, classesFixture } from "./fixtures/classes";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/class-management", useRouter: () => ({ push: vi.fn() }) }));

function renderView(state: ClassListState, props: { onRetry?: () => void; onOpenClass?: () => void } = {}) {
  const store = makeStore({ status: "authenticated", user: adminUser });
  return render(
    <Provider store={store}>
      <ManagementShell area="admin">
        <ClassManagementView state={state} onRetry={props.onRetry} onOpenClass={props.onOpenClass ?? vi.fn()} />
      </ManagementShell>
    </Provider>,
  );
}

describe("ClassManagementView (giao diện thuần, dữ liệu fixture — MOCK/NOT INTEGRATED, chỉ trong test)", () => {
  it("hiển thị sidebar đúng một lần và khung hero/bảng của bản cũ", () => {
    renderView({ kind: "ok", classes: classesFixture });
    expect(document.querySelectorAll(".management-sidebar-column")).toHaveLength(1);
    expect(screen.getByText("Quản lý lớp học", { selector: "h2" })).toBeInTheDocument();
    expect(document.querySelector(".content.acm-page-bg > .container > .row > .col-lg-3")).not.toBeNull();
    expect(document.querySelector(".content.acm-page-bg > .container > .row > .col-lg-9")).not.toBeNull();
  });

  it("phân trang 10 dòng/trang, tổng khớp dữ liệu", async () => {
    renderView({ kind: "ok", classes: classesFixture });
    expect(document.querySelectorAll(".acm-row")).toHaveLength(10);
    expect(screen.getByText("Danh sách lớp học (12)")).toBeInTheDocument();
    await userEvent.click(document.querySelector(".ant-pagination-item-2") as HTMLElement);
    expect(document.querySelectorAll(".acm-row")).toHaveLength(2);
  });

  it("lọc theo từ khóa (mã lớp/khóa/giáo viên) và về trang 1", async () => {
    renderView({ kind: "ok", classes: classesFixture });
    await userEvent.type(screen.getByPlaceholderText("Mã lớp, khóa học, giáo viên..."), "hsk3");
    const rows = document.querySelectorAll(".acm-row");
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => expect(row.textContent?.toLowerCase()).toContain("hsk3"));
  });

  it("không có kết quả => trạng thái rỗng của bản cũ", async () => {
    renderView({ kind: "ok", classes: classesFixture });
    await userEvent.type(screen.getByPlaceholderText("Mã lớp, khóa học, giáo viên..."), "zzzz");
    expect(screen.getByText(/Không tìm thấy lớp học phù hợp/)).toBeInTheDocument();
  });

  it("bấm mã lớp gọi onOpenClass với đúng lớp", async () => {
    const onOpenClass = vi.fn();
    renderView({ kind: "ok", classes: classesFixture }, { onOpenClass });
    await userEvent.click(within(document.querySelector(".acm-row") as HTMLElement).getByRole("button"));
    expect(onOpenClass).toHaveBeenCalledWith(expect.objectContaining({ classId: classesFixture[0].classId }));
  });

  it("đang tải => Spin, thẻ thống kê 0", () => {
    renderView({ kind: "loading" });
    expect(document.querySelector(".ant-spin")).not.toBeNull();
    expect([...document.querySelectorAll(".acm-stat-value")].map((n) => n.textContent)).toEqual(["0", "0", "0", "0"]);
  });

  it("lỗi => thông báo + nút Thử lại, thẻ thống kê '—', KHÔNG có dòng dữ liệu", async () => {
    const onRetry = vi.fn();
    renderView({ kind: "error", message: "Máy chủ lỗi" }, { onRetry });
    expect(screen.getByTestId("acm-state-error")).toHaveTextContent("Máy chủ lỗi");
    expect(document.querySelectorAll(".acm-row")).toHaveLength(0);
    expect([...document.querySelectorAll(".acm-stat-value")].map((n) => n.textContent)).toEqual(["—", "—", "—", "—"]);
    await userEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("chưa tích hợp => thông báo WAITING FOR BACKEND, không có nút Thử lại", () => {
    renderView({ kind: "not-integrated", message: "Chưa kết nối (WAITING FOR BACKEND)" }, { onRetry: vi.fn() });
    expect(screen.getByTestId("acm-state-not-integrated")).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.queryByRole("button", { name: /Thử lại/ })).toBeNull();
  });
});
