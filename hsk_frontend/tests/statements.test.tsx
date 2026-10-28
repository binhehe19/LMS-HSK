import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManagementShell } from "@/components/management/management-shell";
import { StatementsPageContent } from "@/components/management/statements/statements-page-content";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import * as client from "@/lib/api/payment-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { PaymentSummary, TransactionReportItem, TransactionReportPage, TransactionReportQuery } from "@/types/payment";
import { adminUser } from "./fixtures/classes";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/statements", useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
vi.mock("@/lib/api/payment-client", () => ({ getPaymentSummary: vi.fn(), getTransactionReport: vi.fn(), listAdminMembershipPlans: vi.fn(), createMembershipPlan: vi.fn(), updateMembershipPlan: vi.fn(), deleteMembershipPlan: vi.fn() }));

// antd Table/Select trong jsdom tính style rất chậm: bỏ kiểm tra pointer-events của user-event, tránh getByRole không giới hạn phạm vi, nới timeout.
const user = userEvent.setup({ pointerEventsCheck: 0 });
vi.setConfig({ testTimeout: 15_000 });

const nbsp = (s: string | null | undefined) => (s ?? "").replace(/ /g, " ");
const summary: PaymentSummary ={ totalRevenue: 3500000, totalTransactions: 12, totalStudents: 7, totalCoursesSold: 5, totalMembershipsSold: 3 };
const tx = (code: number, over: Partial<TransactionReportItem> = {}): TransactionReportItem => ({
  orderId: `o${code}`, orderCode: code, status: "COMPLETED", createdAt: "2026-10-20T08:00:00", paidAt: "2026-10-20T09:15:00", totalPrice: 1500000,
  buyer: { userId: `u${code}`, username: `user${code}`, fullName: `Người mua ${code}` },
  courses: [{ packageId: `c${code}`, packageName: `Khoá học ${code}`, price: 1500000, itemType: "COURSE" }],
  ...over,
});
/** 12 giao dịch, 2 trang (10 + 2); đơn 2 là gói thành viên, đơn 3 đã huỷ và có 2 mục. */
const all = Array.from({ length: 12 }, (_, i) => {
  const code = i + 1;
  if (code === 2) return tx(code, { courses: [{ packageId: "m1", packageName: "VIP 1 tháng", price: 199000, itemType: "MEMBERSHIP" }], totalPrice: 199000 });
  if (code === 3) return tx(code, { status: "CANCELLED", paidAt: undefined, courses: [{ packageId: "c3", packageName: "Khoá học 3", price: 1 }, { packageId: "m1", packageName: "VIP 1 tháng", price: 199000, itemType: "MEMBERSHIP" }] });
  return tx(code);
});
const pageOf = (q: TransactionReportQuery): TransactionReportPage => ({ content: all.slice(q.page * q.size, (q.page + 1) * q.size), totalPages: 2, totalElements: all.length });

beforeEach(() => {
  window.sessionStorage.setItem("tm_notified_u-admin-1", "true");
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.mocked(getTickets).mockReset().mockResolvedValue([]);
  for (const fn of Object.values(client)) vi.mocked(fn).mockReset();
  vi.mocked(client.getPaymentSummary).mockResolvedValue(summary);
  vi.mocked(client.getTransactionReport).mockImplementation(async (q) => pageOf(q));
});

function renderPage() {
  return render(
    <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
      <ManagementShell area="admin">
        <StatementsPageContent />
      </ManagementShell>
    </Provider>,
  );
}

const rows = () => [...document.querySelectorAll("tr.ant-table-row")] as HTMLElement[];
const card = (key: keyof PaymentSummary) => nbsp(screen.getByTestId(`statement-${key}`).textContent);
const openSelect = (id: string) => fireEvent.mouseDown(document.getElementById(id)!.closest(".ant-select")!.querySelector(".ant-select-selector")!);
const pickOption = async (label: string) => {
  const option = await screen.findByText(label, { selector: ".ant-select-item-option-content" });
  fireEvent.click(option);
};

describe("màn Sao kê — thẻ tổng và bảng giao dịch", () => {
  it("4 thẻ định dạng VND/số; 7 cột; dòng: #mã, người mua, nội dung, Tag loại, ngày, trạng thái, tiền; gọi trang 0 size 10 sort mặc định; tổng phân trang từ máy chủ", async () => {
    renderPage();
    expect(card("totalRevenue")).toBe("0 ₫"); // đang tải: 0 như bản cũ
    await screen.findByText("Người mua 1");
    expect(client.getTransactionReport).toHaveBeenCalledWith({ page: 0, size: 10, sort: "createdAt,desc" });
    expect(document.querySelector(".page-title h5")).toHaveTextContent("Sao kê");
    expect(card("totalRevenue")).toBe("3.500.000 ₫");
    expect(card("totalTransactions")).toBe("12");
    expect(card("totalCoursesSold")).toBe("5");
    expect(card("totalMembershipsSold")).toBe("3");
    expect([...document.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["Mã đơn", "Người mua", "Nội dung thanh toán", "Loại", "Ngày thanh toán", "Trạng thái", "Tổng tiền"]);
    expect(rows()).toHaveLength(10);
    const first = rows()[0];
    expect(within(first).getByText("#1")).toBeInTheDocument();
    expect(within(first).getByText("U")).toBeInTheDocument(); // chữ cái đầu username
    expect(within(first).getByText("Khoá học 1")).toBeInTheDocument();
    expect(within(first).getByText("Khóa học")).toHaveClass("ant-tag");
    expect(within(first).getByText("20/10/2026 09:15")).toBeInTheDocument();
    expect(within(first).getByText("Hoàn thành")).toBeInTheDocument();
    expect(nbsp(within(first).getAllByRole("cell")[6].textContent)).toBe("1.500.000 ₫");
    const second = rows()[1];
    expect(within(second).getByText("Trả phí")).toHaveClass("ant-tag-gold");
    const third = rows()[2];
    expect(within(third).getByText("Đã hủy")).toBeInTheDocument();
    expect(within(third).getByText("-")).toBeInTheDocument();
    expect(within(third).getByText("+1 khóa khác")).toBeInTheDocument();
    expect(screen.getByText("Hiển thị 1-10 trong tổng số 12")).toBeInTheDocument();
    expect((document.querySelector(".content > .container > .row") as HTMLElement).className).toBe("row");
  });

  it("phân trang phía máy chủ: bấm trang 2 => gọi page=1, hiện 2 dòng còn lại", async () => {
    renderPage();
    await screen.findByText("Người mua 1");
    await user.click(document.querySelector(".ant-pagination-item-2") as HTMLElement);
    await screen.findByText("Người mua 11");
    expect(client.getTransactionReport).toHaveBeenLastCalledWith({ page: 1, size: 10, sort: "createdAt,desc" });
    expect(rows()).toHaveLength(2);
    expect(screen.getByText("Hiển thị 11-12 trong tổng số 12")).toBeInTheDocument();
  });

  it("đổi sắp xếp => gọi lại với sort mới và về trang đầu", async () => {
    renderPage();
    await screen.findByText("Người mua 1");
    await user.click(document.querySelector(".ant-pagination-item-2") as HTMLElement);
    await screen.findByText("Người mua 11");
    openSelect("statement-sort");
    await pickOption("Giá trị cao nhất");
    await waitFor(() => expect(client.getTransactionReport).toHaveBeenLastCalledWith({ page: 0, size: 10, sort: "totalPrice,desc" }));
  });

  it("lọc loại 'Trả phí' và tìm kiếm chạy trên TRANG HIỆN TẠI (không gọi API); không khớp => dòng rỗng riêng", async () => {
    renderPage();
    await screen.findByText("Người mua 1");
    const calls = vi.mocked(client.getTransactionReport).mock.calls.length;
    openSelect("statement-type");
    await pickOption("Trả phí");
    await waitFor(() => expect(rows()).toHaveLength(2)); // đơn 2 (gói) + đơn 3 (khoá + gói)
    await user.type(screen.getByLabelText("Tìm kiếm"), "người mua 3");
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getByText("#3")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Tìm kiếm"), "zzz");
    expect(screen.getByText("Không có giao dịch phù hợp trên trang này")).toBeInTheDocument();
    expect(client.getTransactionReport).toHaveBeenCalledTimes(calls);
  });
});

describe("màn Sao kê — chưa tích hợp / lỗi (không số liệu giả)", () => {
  it("tổng quan lỗi => khối lỗi + thẻ '—' + Thử lại tải lại; trường thiếu => '—' (không 0 giả)", async () => {
    vi.mocked(client.getPaymentSummary).mockRejectedValueOnce(new ApiError("Lỗi tổng quan", 500)).mockResolvedValue({ totalRevenue: 10, totalTransactions: 1 });
    renderPage();
    const notice = await screen.findByTestId("statement-summary-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(notice).toHaveTextContent("Lỗi tổng quan");
    expect(card("totalRevenue")).toBe("—");
    expect(card("totalTransactions")).toBe("—");
    await user.click(within(notice).getByText("Thử lại"));
    await waitFor(() => expect(card("totalRevenue")).toBe("10 ₫"));
    expect(card("totalMembershipsSold")).toBe("—");
    expect(card("totalCoursesSold")).toBe("—");
  });

  it("giao dịch chưa cấu hình => WAITING FOR BACKEND (không Thử lại), không bảng; giao dịch lỗi => khối lỗi có Thử lại", async () => {
    vi.mocked(client.getTransactionReport).mockRejectedValueOnce(new ApiNotConfiguredError());
    const { unmount } = renderPage();
    const waiting = await screen.findByTestId("statement-report-notice");
    expect(waiting).toHaveAttribute("data-kind", "waiting");
    expect(waiting).toHaveTextContent("WAITING FOR BACKEND");
    expect(within(waiting).queryByText("Thử lại")).toBeNull();
    expect(document.querySelector(".ant-table")).toBeNull();
    unmount();
    vi.mocked(client.getTransactionReport).mockRejectedValueOnce(new ApiError("Lỗi giao dịch", 500)).mockImplementation(async (q) => pageOf(q));
    renderPage();
    const error = await screen.findByTestId("statement-report-notice");
    expect(error).toHaveTextContent("Lỗi giao dịch");
    await user.click(within(error).getByText("Thử lại"));
    expect(await screen.findByText("Người mua 1")).toBeInTheDocument();
  });

  it("phản hồi không có mảng content => lỗi hợp đồng (không bảng rỗng giả)", async () => {
    vi.mocked(client.getTransactionReport).mockResolvedValue({ items: [] } as unknown as TransactionReportPage);
    renderPage();
    expect(await screen.findByTestId("statement-report-notice")).toHaveTextContent("không đúng định dạng");
  });
});
