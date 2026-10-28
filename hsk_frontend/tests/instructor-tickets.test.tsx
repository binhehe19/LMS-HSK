import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManagementShell } from "@/components/management/management-shell";
import { InstructorTicketsPageContent } from "@/components/management/work-tickets/instructor-tickets-page-content";
import { useWriteGate } from "@/hooks/use-write-gate";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import * as client from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { TicketResponse } from "@/types/ticket";
import { adminUser } from "./fixtures/classes";

vi.mock("next/navigation", () => ({ usePathname: () => "/instructor/instructor-tickets", useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn(), getTicketAssignees: vi.fn(), createTicket: vi.fn(), updateTicket: vi.fn(), deleteTicket: vi.fn(), closeTicket: vi.fn(), doneTicket: vi.fn() }));
vi.mock("@/hooks/use-write-gate", () => ({ useWriteGate: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

// antd Table trong jsdom tính style rất chậm: bỏ kiểm tra pointer-events của user-event, dùng bộ chọn text/aria-label thay getByRole, nới timeout.
const user = userEvent.setup({ pointerEventsCheck: 0 });
vi.setConfig({ testTimeout: 15_000 });

const teacher = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "gv1@example.test", roles: ["ROLE_TEACHER"] };
const ticket = (id: string, over: Partial<TicketResponse> = {}): TicketResponse => ({ id, status: "OPEN", assignedId: "u-teacher-1", module: "QUIZ", description: `Việc ${id}`, createdAt: "2026-10-20T08:00:00", ...over });
const tickets: TicketResponse[] = [
  ticket("t1"),
  ticket("t2", { status: "DONE", module: "WRITING" }),
  ticket("t3", { status: "CLOSE", module: "FLASHCARD" }),
  ticket("t4", { assignedId: "someone-else", description: "Việc của người khác" }),
];

beforeEach(() => {
  window.sessionStorage.setItem("instructor_notified_u-teacher-1", "true"); // toast chào mừng ở sidebar không chen vào DOM
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  for (const fn of Object.values(client)) vi.mocked(fn).mockReset();
  vi.mocked(client.getTickets).mockResolvedValue(tickets);
  vi.mocked(client.doneTicket).mockResolvedValue(undefined);
  vi.mocked(useWriteGate).mockReturnValue({ availability: "enabled", enabled: true, demo: true });
  for (const fn of [toast.success, toast.error, toast.warning, toast.info]) vi.mocked(fn).mockClear();
});

function renderPage() {
  return render(
    <Provider store={makeStore({ status: "authenticated", user: teacher })}>
      <ManagementShell area="instructor">
        <InstructorTicketsPageContent />
      </ManagementShell>
    </Provider>,
  );
}

const rows = () => [...document.querySelectorAll("tr.ant-table-row")] as HTMLElement[];
const stats = () => ["total", "open", "done", "closed"].map((k) => screen.getByTestId(`ticket-stat-${k}`).textContent);
const doneBtn = (row: ParentNode) => row.querySelector('button[aria-label^="Báo cáo hoàn thành"]') as HTMLButtonElement | null;

describe("màn Phân công công việc của giảng viên", () => {
  it("chỉ hiện ticket của CHÍNH người dùng (3/4); 4 cột; thẻ 3/1/1/1; gọi getTickets(0, 50); nút Báo cáo chỉ ở Đang thực hiện, dòng khác 'Không có hành động'; khối lưu ý", async () => {
    renderPage();
    await screen.findByText("Việc t1");
    expect(client.getTickets).toHaveBeenCalledWith(0, 50);
    expect(document.querySelector(".tickets .page-title h4")).toHaveTextContent("Danh sách Phân công công việc");
    expect([...document.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["Module được giao", "Mô tả công việc", "Trạng thái", "Hành động"]);
    expect(rows()).toHaveLength(3);
    expect(screen.queryByText("Việc của người khác")).toBeNull();
    expect(stats()).toEqual(["3", "1", "1", "1"]);
    expect(within(rows()[0]).getByText("Đang thực hiện")).toBeInTheDocument();
    expect(doneBtn(rows()[0])).toBeEnabled();
    expect(within(rows()[1]).getByText("Đã báo cáo")).toBeInTheDocument();
    expect(within(rows()[1]).getByText("Không có hành động")).toBeInTheDocument();
    expect(doneBtn(rows()[1])).toBeNull();
    expect(within(rows()[2]).getByText("Đã đóng")).toBeInTheDocument();
    expect(screen.getByText(/Chế độ Xem duy nhất/)).toBeInTheDocument();
    expect(document.querySelector(".management-sidebar-column")).not.toBeNull();
    expect(screen.queryByTestId("write-locked")).toBeNull();
  });

  it("Báo cáo hoàn thành: doneTicket(id, true) + toast + tải lại; lỗi => toast thông điệp lỗi, không báo thành công", async () => {
    renderPage();
    await screen.findByText("Việc t1");
    await user.click(doneBtn(rows()[0]) as HTMLButtonElement);
    await waitFor(() => expect(client.doneTicket).toHaveBeenCalledWith("t1", true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã báo cáo hoàn thành công việc!"));
    await waitFor(() => expect(client.getTickets).toHaveBeenCalledTimes(2));
    vi.mocked(client.doneTicket).mockRejectedValueOnce(new ApiError("Ticket không được giao cho bạn", 403));
    await screen.findByText("Việc t1");
    await user.click(doneBtn(rows()[0]) as HTMLButtonElement);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Ticket không được giao cho bạn"));
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("bộ lọc: tìm theo mô tả (không theo tên người), tab 'Đã báo cáo', xoá lọc", async () => {
    renderPage();
    await screen.findByText("Việc t1");
    await user.type(screen.getByLabelText("Tìm kiếm ticket"), "việc t2");
    expect(rows()).toHaveLength(1);
    await user.click(screen.getByLabelText("Xóa tất cả bộ lọc"));
    expect(rows()).toHaveLength(3);
    await user.click(screen.getByText("Đã báo cáo", { selector: "button" }));
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getByText("Luyện viết")).toBeInTheDocument();
    expect(stats()).toEqual(["1", "0", "1", "0"]);
  });

  it("công tắc ghi đóng: WriteLockedNotice, nút Báo cáo bị khoá, không gọi doneTicket", async () => {
    vi.mocked(useWriteGate).mockReturnValue({ availability: "waiting", enabled: false, demo: false });
    renderPage();
    await screen.findByText("Việc t1");
    expect(screen.getByTestId("write-locked")).toHaveTextContent("WAITING FOR BACKEND");
    expect(doneBtn(rows()[0])).toBeDisabled();
    expect(client.doneTicket).not.toHaveBeenCalled();
  });

  it("chưa cấu hình => WAITING FOR BACKEND, thẻ '—', không toast; rỗng thật => 'Bạn chưa được phân công công việc nào'", async () => {
    vi.mocked(client.getTickets).mockRejectedValueOnce(new ApiNotConfiguredError());
    const { unmount } = renderPage();
    const notice = await screen.findByTestId("ticket-list-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(stats()).toEqual(["—", "—", "—", "—"]);
    expect(toast.error).not.toHaveBeenCalled();
    unmount();
    vi.mocked(client.getTickets).mockResolvedValue([ticket("x", { assignedId: "ai-do" })]); // chỉ ticket của người khác => với tôi là rỗng
    renderPage();
    expect(await screen.findByText("Bạn chưa được phân công công việc nào")).toBeInTheDocument();
    expect(stats()).toEqual(["0", "0", "0", "0"]);
  });
});
