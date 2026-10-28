import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManagementShell } from "@/components/management/management-shell";
import { AdminTicketsPageContent } from "@/components/management/work-tickets/admin-tickets-page-content";
import { confirmAction } from "@/components/shared/confirm-action";
import { useWriteGate } from "@/hooks/use-write-gate";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import * as client from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { TicketAssigneeOptionResponse, TicketResponse } from "@/types/ticket";
import { adminUser } from "./fixtures/classes";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/tickets", useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn(), getTicketAssignees: vi.fn(), createTicket: vi.fn(), updateTicket: vi.fn(), deleteTicket: vi.fn(), closeTicket: vi.fn(), doneTicket: vi.fn() }));
vi.mock("@/hooks/use-write-gate", () => ({ useWriteGate: vi.fn() }));
vi.mock("@/components/shared/confirm-action", () => ({ confirmAction: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

// antd Table/Modal trong jsdom tính style rất chậm (getComputedStyle duyệt hàng nghìn rule cssinjs): bỏ kiểm tra pointer-events của user-event,
// dùng bộ chọn text/aria-label thay getByRole (getByRole gọi getComputedStyle cho mọi ứng viên và tổ tiên) và nới timeout vì vitest chạy nhiều file song song.
const user = userEvent.setup({ pointerEventsCheck: 0 });
vi.setConfig({ testTimeout: 15_000 });

const ticket = (id: string, over: Partial<TicketResponse> = {}): TicketResponse => ({
  id, status: "OPEN", assignedId: "gv-1", assignedName: "Nguyễn Văn An", assignedEmail: "an@example.test", module: "QUIZ", description: `Mô tả ${id}`, createdAt: "2026-10-20T08:00:00", ...over,
});
const tickets: TicketResponse[] = [
  ticket("t1"),
  ticket("t2", { status: "DONE", module: "WRITING", assignedId: "gv-2", assignedName: "Trần Thị Bình", assignedEmail: "binh@example.test", createdAt: "2026-10-22T08:00:00" }),
  ticket("t3", { status: "CLOSE", module: "FLASHCARD", description: "Việc cũ đã đóng" }),
];
const assignees: TicketAssigneeOptionResponse[] = [
  { id: "gv-1", email: "an@example.test", fullName: "Nguyễn Văn An", roles: ["ROLE_TEACHER"] },
  { id: "gv-2", email: "binh@example.test", fullName: "Trần Thị Bình", roles: ["ROLE_TEACHER"] },
  { id: "ctv-1", email: "ctv@example.test", fullName: "Cộng Tác Viên", roles: ["ROLE_COLLABORATOR"] },
];

beforeEach(() => {
  window.sessionStorage.setItem("tm_notified_u-admin-1", "true"); // toast chào mừng ở sidebar đã hiện trong phiên => không chen vào DOM
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  for (const fn of Object.values(client)) vi.mocked(fn).mockReset();
  vi.mocked(client.getTickets).mockResolvedValue(tickets);
  vi.mocked(client.getTicketAssignees).mockResolvedValue(assignees);
  vi.mocked(client.createTicket).mockResolvedValue(ticket("new"));
  vi.mocked(client.updateTicket).mockResolvedValue(ticket("t1"));
  vi.mocked(client.closeTicket).mockResolvedValue(undefined);
  vi.mocked(client.deleteTicket).mockResolvedValue(undefined);
  vi.mocked(useWriteGate).mockReturnValue({ availability: "enabled", enabled: true, demo: true });
  vi.mocked(confirmAction).mockReset().mockResolvedValue(true);
  for (const fn of [toast.success, toast.error, toast.warning, toast.info]) vi.mocked(fn).mockClear();
});

function renderPage() {
  return render(
    <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
      <ManagementShell area="admin">
        <AdminTicketsPageContent />
      </ManagementShell>
    </Provider>,
  );
}

const rows = () => [...document.querySelectorAll("tr.ant-table-row")] as HTMLElement[];
const stat = (key: string) => screen.getByTestId(`ticket-stat-${key}`).textContent;
const stats = () => ["total", "open", "done", "closed"].map(stat);
/** Nút hành động trong một dòng theo tiền tố aria-label ("Đóng ticket", "Chỉnh sửa ticket", "Xóa ticket"). */
const actionBtn = (row: ParentNode, prefix: string) => row.querySelector(`button[aria-label^="${prefix}"]`) as HTMLButtonElement | null;
const createButton = () => screen.getByText("Tạo Phân công mới").closest("button") as HTMLButtonElement;
const statusTab = (label: string) => screen.getByText(label, { selector: "button" });
const waitForRows = async () => {
  await screen.findByText("Mô tả t1");
};
const modal = () => screen.getByTestId("ticket-form-modal");
const submitButton = (label: string) => within(modal()).getByText(label).closest("button") as HTMLButtonElement;

describe("màn Phân công công việc (Admin) — khung, thống kê, bảng", () => {
  it("tiêu đề, 4 thẻ đếm trên danh sách, 6 cột, dòng có tên/email/module/trạng thái/ngày; gọi getTickets(0, 100); DOM .content > .container > .row", async () => {
    renderPage();
    expect(stats()).toEqual(["0", "0", "0", "0"]); // đang tải: số 0 như bản cũ
    await waitForRows();
    expect(client.getTickets).toHaveBeenCalledWith(0, 100);
    expect(document.querySelector(".tickets .page-title h4")).toHaveTextContent("Phân công công việc & Quyền hạn");
    expect(stats()).toEqual(["3", "1", "1", "1"]);
    expect([...document.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["Người được giao", "Module", "Mô tả", "Trạng thái", "Ngày tạo", "Hành động"]);
    expect(rows()).toHaveLength(3);
    const first = rows()[0];
    expect(within(first).getByText("Nguyễn Văn An")).toBeInTheDocument();
    expect(within(first).getByText("an@example.test")).toBeInTheDocument();
    expect(within(first).getByText("Trắc nghiệm (Quiz)")).toBeInTheDocument();
    expect(within(first).getByText("Đang mở")).toBeInTheDocument();
    expect(within(first).getByText("20/10/2026")).toBeInTheDocument();
    expect(within(rows()[1]).getByText("Chờ duyệt")).toBeInTheDocument();
    expect(within(rows()[2]).getByText("Đã đóng")).toBeInTheDocument();
    expect((document.querySelector(".content > .container > .row") as HTMLElement).className).toBe("row");
    expect(document.querySelector(".management-sidebar-column")).not.toBeNull();
    expect(screen.queryByTestId("write-locked")).toBeNull();
    // hành động theo trạng thái: OPEN có Đóng + Sửa; DONE chỉ Đóng; CLOSE chỉ Xoá
    expect(actionBtn(first, "Đóng ticket")).toBeEnabled();
    expect(actionBtn(first, "Chỉnh sửa ticket")).toBeEnabled();
    expect(actionBtn(rows()[1], "Chỉnh sửa ticket")).toBeNull();
    expect(actionBtn(rows()[2], "Xóa ticket")).toBeEnabled();
    expect(actionBtn(rows()[2], "Đóng ticket")).toBeNull();
  });

  it("bộ lọc: tab trạng thái, tìm theo email, chọn module; thẻ đếm theo kết quả lọc; không khớp => dòng rỗng tiếng Việt; nút xoá lọc về đủ", async () => {
    renderPage();
    await waitForRows();
    await user.click(statusTab("Chờ duyệt"));
    expect(rows()).toHaveLength(1);
    expect(stats()).toEqual(["1", "0", "1", "0"]);
    await user.click(statusTab("Tất cả"));
    await user.type(screen.getByLabelText("Tìm kiếm ticket"), "BINH@");
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getByText("Trần Thị Bình")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Lọc theo module"), "FLASHCARD");
    expect(rows()).toHaveLength(0);
    expect(screen.getByText("Không có ticket phù hợp bộ lọc")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Xóa tất cả bộ lọc"));
    expect(rows()).toHaveLength(3);
    expect(screen.getByLabelText("Tìm kiếm ticket")).toHaveValue("");
  });
});

describe("tạo / sửa phân công (công tắc mở — mock ở lớp client)", () => {
  it("tạo: mở modal mới tải người được giao; chọn 1 người + module WRITING (FLASHCARD mặc định) + mô tả => createTicket cho TỪNG tổ hợp, toast, đóng modal, tải lại", async () => {
    renderPage();
    await waitForRows();
    expect(client.getTicketAssignees).not.toHaveBeenCalled();
    await user.click(createButton());
    expect(modal()).toHaveAttribute("data-mode", "add");
    expect(client.getTicketAssignees).toHaveBeenCalledTimes(1);
    expect(submitButton("Xác nhận & Cấp quyền")).toBeDisabled(); // chưa chọn người
    await user.click(await within(modal()).findByLabelText("Chọn Nguyễn Văn An"));
    expect(within(modal()).getByLabelText("Module Thẻ ghi nhớ (Flashcard)")).toHaveAttribute("aria-pressed", "true");
    await user.click(within(modal()).getByLabelText("Module Luyện viết"));
    expect(within(modal()).getByText("Đã chọn 1 người & 2 module")).toBeInTheDocument();
    await user.type(within(modal()).getByLabelText(/Ghi chú công việc/), "Việc mới");
    await user.click(submitButton("Xác nhận & Cấp quyền"));
    await waitFor(() => expect(client.createTicket).toHaveBeenCalledTimes(2));
    expect(client.createTicket).toHaveBeenNthCalledWith(1, { assignedId: "gv-1", module: "FLASHCARD", description: "Việc mới" }, true);
    expect(client.createTicket).toHaveBeenNthCalledWith(2, { assignedId: "gv-1", module: "WRITING", description: "Việc mới" }, true);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã phân công thành công 2 ticket"));
    await waitFor(() => expect(screen.queryByTestId("ticket-form-modal")).toBeNull());
    expect(client.getTickets).toHaveBeenCalledTimes(2); // tải lại
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("tạo thiếu mô tả => toast.warning thông điệp cũ, không gọi API; một tổ hợp lỗi => toast 'Có 1 yêu cầu thất bại' nhưng vẫn báo số đã tạo", async () => {
    renderPage();
    await waitForRows();
    await user.click(createButton());
    await user.click(await within(modal()).findByLabelText("Chọn Cộng Tác Viên"));
    await user.click(submitButton("Xác nhận & Cấp quyền"));
    expect(toast.warning).toHaveBeenCalledWith("Vui lòng chọn ít nhất 1 người dùng, 1 module và nhập mô tả");
    expect(client.createTicket).not.toHaveBeenCalled();
    vi.mocked(client.createTicket).mockResolvedValueOnce(ticket("ok")).mockRejectedValueOnce(new ApiError("Trùng", 409));
    await user.click(within(modal()).getByLabelText("Module Luyện nghe"));
    await user.type(within(modal()).getByLabelText(/Ghi chú công việc/), "x");
    await user.click(submitButton("Xác nhận & Cấp quyền"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã phân công thành công 1 ticket"));
    expect(toast.error).toHaveBeenCalledWith("Có 1 yêu cầu thất bại");
  });

  it("sửa: form điền sẵn (người, module, mô tả); chọn module khác THAY THẾ (chọn một); lưu => updateTicket(id, {assignedId, module, description}, true), toast, tải lại", async () => {
    renderPage();
    await waitForRows();
    await user.click(actionBtn(rows()[0], "Chỉnh sửa ticket") as HTMLButtonElement);
    expect(modal()).toHaveAttribute("data-mode", "edit");
    expect(within(modal()).getByText("Chỉnh sửa Phân công")).toBeInTheDocument();
    expect(within(modal()).getByLabelText(/Ghi chú công việc/)).toHaveValue("Mô tả t1");
    expect(await within(modal()).findByLabelText("Chọn Nguyễn Văn An")).toHaveAttribute("aria-pressed", "true");
    expect(within(modal()).getByLabelText("Module Trắc nghiệm (Quiz)")).toHaveAttribute("aria-pressed", "true");
    await user.click(within(modal()).getByLabelText("Module Luyện viết"));
    expect(within(modal()).getByLabelText("Module Trắc nghiệm (Quiz)")).toHaveAttribute("aria-pressed", "false");
    await user.click(within(modal()).getByLabelText("Chọn Trần Thị Bình"));
    expect(within(modal()).getByText("Đã chọn 1 người & 1 module")).toBeInTheDocument();
    await user.click(submitButton("Lưu thay đổi"));
    await waitFor(() => expect(client.updateTicket).toHaveBeenCalledWith("t1", { assignedId: "gv-2", module: "WRITING", description: "Mô tả t1" }, true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cập nhật ticket thành công"));
    await waitFor(() => expect(screen.queryByTestId("ticket-form-modal")).toBeNull());
    expect(client.getTickets).toHaveBeenCalledTimes(2);
  });

  it("danh sách người được giao chưa cấu hình/lỗi hiện trong cột 1 (WAITING / Thử lại), không bịa danh sách rỗng", async () => {
    vi.mocked(client.getTicketAssignees).mockRejectedValueOnce(new ApiError("Lỗi người dùng", 500)).mockResolvedValue(assignees);
    renderPage();
    await waitForRows();
    await user.click(createButton());
    const notice = await within(modal()).findByTestId("assignee-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(notice).toHaveTextContent("Lỗi người dùng");
    expect(within(modal()).queryByText("Không có người dùng phù hợp")).toBeNull();
    await user.click(within(notice).getByText("Thử lại"));
    expect(await within(modal()).findByLabelText("Chọn Nguyễn Văn An")).toBeInTheDocument();
  });
});

describe("đóng / xoá", () => {
  it("Đóng: closeTicket(id, true) + toast + tải lại; lỗi => toast thông điệp lỗi, KHÔNG báo thành công", async () => {
    renderPage();
    await waitForRows();
    await user.click(actionBtn(rows()[0], "Đóng ticket") as HTMLButtonElement);
    await waitFor(() => expect(client.closeTicket).toHaveBeenCalledWith("t1", true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã đóng ticket và thu hồi quyền"));
    expect(client.getTickets).toHaveBeenCalledTimes(2);
    vi.mocked(client.closeTicket).mockRejectedValueOnce(new ApiError("Bạn không có quyền thực hiện thao tác này.", 403));
    await waitForRows();
    await user.click(actionBtn(rows()[1], "Đóng ticket") as HTMLButtonElement);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Bạn không có quyền thực hiện thao tác này."));
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("Xoá: hỏi xác nhận (confirmAction, chữ của bản cũ); từ chối => không gọi; đồng ý => deleteTicket(id, true) + toast + tải lại", async () => {
    vi.mocked(confirmAction).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    renderPage();
    await waitForRows();
    const remove = () => user.click(actionBtn(rows()[2], "Xóa ticket") as HTMLButtonElement);
    await remove();
    await waitFor(() => expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xác nhận xóa?", okText: "Xác nhận Xóa", danger: true })));
    expect(client.deleteTicket).not.toHaveBeenCalled();
    await remove();
    await waitFor(() => expect(client.deleteTicket).toHaveBeenCalledWith("t3", true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã xóa ticket thành công"));
    expect(client.getTickets).toHaveBeenCalledTimes(2);
  });
});

describe("công tắc ghi ĐÓNG và trạng thái dữ liệu", () => {
  it("công tắc đóng: WriteLockedNotice; Tạo/Đóng/Sửa/Xoá bị khoá; không có lời gọi ghi nào", async () => {
    vi.mocked(useWriteGate).mockReturnValue({ availability: "waiting", enabled: false, demo: false });
    renderPage();
    await waitForRows();
    expect(screen.getByTestId("write-locked")).toHaveTextContent("WAITING FOR BACKEND");
    expect(createButton()).toBeDisabled();
    expect(actionBtn(rows()[0], "Đóng ticket")).toBeDisabled();
    expect(actionBtn(rows()[0], "Chỉnh sửa ticket")).toBeDisabled();
    expect(actionBtn(rows()[2], "Xóa ticket")).toBeDisabled();
    expect(client.closeTicket).not.toHaveBeenCalled();
    expect(client.createTicket).not.toHaveBeenCalled();
  });

  it("dịch vụ chưa cấu hình => WAITING FOR BACKEND, thẻ '—', không bảng, không toast; nút Tạo khoá", async () => {
    vi.mocked(client.getTickets).mockRejectedValue(new ApiNotConfiguredError());
    renderPage();
    const notice = await screen.findByTestId("ticket-list-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(notice).toHaveTextContent("WAITING FOR BACKEND");
    expect(within(notice).queryByText("Thử lại")).toBeNull();
    expect(stats()).toEqual(["—", "—", "—", "—"]);
    expect(document.querySelector(".ant-table")).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
    expect(createButton()).toBeDisabled();
  });

  it("API lỗi => toast (như bản cũ) + khối lỗi có Thử lại tải lại được; rỗng thật => 'Chưa có ticket nào' và thẻ 0", async () => {
    vi.mocked(client.getTickets).mockRejectedValueOnce(new ApiError("Máy chủ lỗi", 500)).mockResolvedValue([]);
    renderPage();
    const notice = await screen.findByTestId("ticket-list-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(notice).toHaveTextContent("Máy chủ lỗi");
    expect(toast.error).toHaveBeenCalledWith("Máy chủ lỗi");
    await user.click(within(notice).getByText("Thử lại"));
    expect(await screen.findByText("Chưa có ticket nào")).toBeInTheDocument();
    expect(stats()).toEqual(["0", "0", "0", "0"]);
    expect(client.getTickets).toHaveBeenCalledTimes(2);
  });
});
