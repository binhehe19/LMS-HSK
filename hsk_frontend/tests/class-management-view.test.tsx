import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";
import { ManagementShell } from "@/components/management/management-shell";
import { ClassManagementView } from "@/components/management/class-management/class-management-view";
import type { ClassListState } from "@/components/management/class-management/use-admin-classes";
import { classSummaryToGradingClass } from "@/lib/class-management/lms-class-adapter";
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
  it("đặt bảng ngay dưới banner và bộ lọc, tải lại từ nút trên banner", async () => {
    const onRetry = vi.fn();
    renderView({ kind: "ok", classes: classesFixture.slice(0, 1) }, { onRetry });
    expect(document.querySelectorAll(".management-sidebar-column")).toHaveLength(1);
    const toolbarRegion = screen.getByRole("region", { name: "Bộ lọc lớp học" });
    const toolbar = within(toolbarRegion);
    expect(toolbar.getByRole("heading", { level: 1, name: "Quản lý lớp học" })).toBeInTheDocument();
    expect(toolbar.queryByText("Admin · Chỉ xem")).toBeNull();
    expect(toolbar.getByRole("textbox", { name: "Tìm lớp học" })).toBeInTheDocument();
    const hero = toolbarRegion.querySelector<HTMLElement>(".acm-hero")!;
    await userEvent.click(within(hero).getByRole("button", { name: "Tải lại" }));
    expect(onRetry).toHaveBeenCalledOnce();
    const tableRegion = screen.getByRole("region", { name: "Danh sách lớp học" });
    expect(toolbarRegion.nextElementSibling).toBe(tableRegion);
    expect(within(tableRegion).getAllByRole("columnheader").map(cell => cell.textContent)).toEqual([
      "STT", "Lớp học", "Giáo trình / Khóa học", "Giáo viên", "Lịch học", "Khai giảng", "Trạng thái", "Thao tác",
    ]);
  });

  it("hiển thị họ tên cùng avatar chữ cái, hoặc Chưa phân công nếu thiếu giáo viên", () => {
    const courseName = "GT2 - TIẾNG TRUNG GIAO TIẾP VĂN PHÒNG - CÔNG SỞ";
    renderView({
      kind: "ok",
      classes: [
        { ...classesFixture[0], courseName, teacherName: "Nguyễn Thị Uyên Nhi" },
        { ...classesFixture[1], teacherName: undefined },
      ],
    });
    const course = screen.getByText(courseName);
    expect(course).toHaveClass("text-truncate");
    expect(course).toHaveAttribute("title", courseName);
    const teacher = screen.getByText("Nguyễn Thị Uyên Nhi");
    expect(teacher).toHaveClass("text-truncate");
    expect(teacher).toHaveAttribute("title", "Nguyễn Thị Uyên Nhi");
    const assigned = teacher.closest("td");
    expect(assigned?.querySelector(".ant-avatar")).toHaveTextContent("NN");
    const unassigned = screen.getByText("Chưa phân công").closest("td");
    expect(unassigned?.querySelector(".ant-avatar")).toBeNull();
  });

  it("phân trang 20 dòng và giữ nút số trang khi bỏ ô Đến trang", async () => {
    const classes = Array.from({ length: 101 }, (_, index) => ({ ...classesFixture[0], classId: String(index) }));
    renderView({ kind: "ok", classes });
    expect(document.querySelectorAll(".acm-row")).toHaveLength(20);
    expect(screen.getByText("101 bản ghi")).toBeInTheDocument();
    expect(screen.queryByText("Đến trang")).toBeNull();
    await userEvent.click(document.querySelector(".ant-pagination-item-6") as HTMLElement);
    expect(document.querySelectorAll(".acm-row")).toHaveLength(1);
    expect(document.querySelector(".acm-row td")).toHaveTextContent("101");
  });

  it("dùng giờ riêng của từng ngày trong lịch trả về từ LMS", () => {
    renderView({
      kind: "ok",
      classes: [classSummaryToGradingClass({
        id: "class-different-hours",
        schedulePatterns: [
          { dayOfWeek: "MONDAY", startTime: "08:00:00", endTime: "09:30:00" },
          { dayOfWeek: "WEDNESDAY", startTime: "18:15", endTime: "19:45" },
          { dayOfWeek: "SUNDAY", startTime: "10:00" },
        ],
      })],
    });
    expect(screen.getByText("T2 08:00")).toHaveAttribute("title", "08:00 – 09:30");
    expect(screen.getByText("T4 18:15")).toHaveAttribute("title", "18:15 – 19:45");
    expect(screen.getByText("CN 10:00")).toBeInTheDocument();
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

  it("mở danh sách học viên từ mã lớp và menu thao tác", async () => {
    const onOpenClass = vi.fn();
    renderView({ kind: "ok", classes: classesFixture.slice(0, 1) }, { onOpenClass });
    const row = within(document.querySelector(".acm-row") as HTMLElement);
    await userEvent.click(row.getByRole("button", { name: classesFixture[0].classCode }));
    expect(onOpenClass).toHaveBeenCalledWith(expect.objectContaining({ classId: classesFixture[0].classId }));
    onOpenClass.mockClear();
    await userEvent.click(row.getByRole("button", { name: `Thao tác ${classesFixture[0].classCode}` }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Xem học viên" }));
    expect(onOpenClass).toHaveBeenCalledWith(expect.objectContaining({ classId: classesFixture[0].classId }));
  }, 10_000);

  it("đang tải => Spin", () => {
    renderView({ kind: "loading" });
    expect(document.querySelector(".ant-spin")).not.toBeNull();
  });

  it("lỗi => thông báo + nút Thử lại, KHÔNG có dòng dữ liệu", async () => {
    const onRetry = vi.fn();
    renderView({ kind: "error", message: "Máy chủ lỗi" }, { onRetry });
    expect(screen.getByTestId("acm-state-error")).toHaveTextContent("Máy chủ lỗi");
    expect(document.querySelectorAll(".acm-row")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("chưa tích hợp => thông báo WAITING FOR BACKEND, không có nút Thử lại", () => {
    renderView({ kind: "not-integrated", message: "Chưa kết nối (WAITING FOR BACKEND)" }, { onRetry: vi.fn() });
    expect(screen.getByTestId("acm-state-not-integrated")).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.queryByRole("button", { name: /Thử lại/ })).toBeNull();
  });
});
