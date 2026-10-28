import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManagementShell } from "@/components/management/management-shell";
import { MembershipManagementPageContent } from "@/components/management/membership-management/membership-management-page-content";
import { confirmAction } from "@/components/shared/confirm-action";
import { useWriteGate } from "@/hooks/use-write-gate";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import * as client from "@/lib/api/payment-client";
import { getTickets } from "@/lib/api/ticket-client";
import { truncateDescription } from "@/lib/payment/payment-model";
import { makeStore } from "@/redux/store";
import type { MembershipPlan } from "@/types/payment";
import { adminUser } from "./fixtures/classes";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/membership-management", useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
vi.mock("@/lib/api/payment-client", () => ({ getPaymentSummary: vi.fn(), getTransactionReport: vi.fn(), listAdminMembershipPlans: vi.fn(), createMembershipPlan: vi.fn(), updateMembershipPlan: vi.fn(), deleteMembershipPlan: vi.fn() }));
vi.mock("@/hooks/use-write-gate", () => ({ useWriteGate: vi.fn() }));
vi.mock("@/components/shared/confirm-action", () => ({ confirmAction: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

// antd Table/Modal/Tooltip trong jsdom tính style rất chậm (getComputedStyle duyệt hàng nghìn rule cssinjs): bỏ kiểm tra pointer-events của user-event,
// dùng bộ chọn text/aria-label thay getByRole (getByRole gọi getComputedStyle cho mọi ứng viên và tổ tiên) và nới timeout vì vitest chạy nhiều file song song.
const user = userEvent.setup({ pointerEventsCheck: 0 });
vi.setConfig({ testTimeout: 20_000 }); // antd Button (hiệu ứng wave đọc getComputedStyle mỗi lần bấm) + Modal: ca "sửa" ~10s khi máy bận

const nbsp = (s: string | null | undefined) => (s ?? "").replace(/ /g, " ");
const plan = (id: string, over: Partial<MembershipPlan> = {}): MembershipPlan => ({ id, name: `Gói ${id}`, description: `Mô tả gói ${id}`, price: 199000, durationInDays: 30, active: true, ...over });
const plans: MembershipPlan[] = [plan("p1", { name: "VIP 1 tháng" }), plan("p2", { name: "VIP 12 tháng", price: 1990000, durationInDays: 365, description: "Tiết kiệm 20% khi đăng ký theo năm. Chứng chỉ và lộ trình ưu tiên." }), plan("p3", { name: "Gói ẩn", active: false })];

beforeEach(() => {
  window.sessionStorage.setItem("tm_notified_u-admin-1", "true");
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.mocked(getTickets).mockReset().mockResolvedValue([]);
  for (const fn of Object.values(client)) vi.mocked(fn).mockReset();
  vi.mocked(client.listAdminMembershipPlans).mockResolvedValue(plans);
  vi.mocked(client.createMembershipPlan).mockResolvedValue(plan("new"));
  vi.mocked(client.updateMembershipPlan).mockResolvedValue(plan("p1"));
  vi.mocked(client.deleteMembershipPlan).mockResolvedValue(undefined);
  vi.mocked(useWriteGate).mockReturnValue({ availability: "enabled", enabled: true, demo: true });
  vi.mocked(confirmAction).mockReset().mockResolvedValue(true);
  for (const fn of [toast.success, toast.error, toast.warning, toast.info]) vi.mocked(fn).mockClear();
});

function renderPage() {
  return render(
    <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
      <ManagementShell area="admin">
        <MembershipManagementPageContent />
      </ManagementShell>
    </Provider>,
  );
}

const rows = () => [...document.querySelectorAll("tr.ant-table-row")] as HTMLElement[];
const btn = (scope: ParentNode, label: string) => scope.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
const createButton = () => screen.getByText("Tạo gói mới").closest("button") as HTMLButtonElement;
const dialog = () => document.querySelector(".ant-modal") as HTMLElement;
const okButton = (label: string) => within(dialog()).getByText(label).closest("button") as HTMLButtonElement;
const activeSwitch = () => document.getElementById("plan-active") as HTMLButtonElement;
const waitForRows = async () => {
  await screen.findByText("VIP 1 tháng");
};

describe("màn Quản lý Gói thành viên VIP — bảng", () => {
  it("DOM .content.membership-management, tiêu đề, nút Tạo gói mới; cột Tên gói (mô tả rút gọn 40), Giá vi-VN, Thời hạn, Trạng thái Đang bán/Đã ẩn, Thao tác; ô tìm kiếm của DataTable", async () => {
    renderPage();
    await waitForRows();
    expect(client.listAdminMembershipPlans).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".content.membership-management > .container > .row > .col-lg-9")).not.toBeNull();
    expect(document.querySelector(".membership-header h5")).toHaveTextContent("Quản lý Gói thành viên VIP");
    expect(createButton()).toHaveClass("btn-gold");
    expect(createButton()).toBeEnabled();
    expect([...document.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["Tên gói", "Giá (VNĐ)", "Thời hạn", "Trạng thái", "Thao tác"]);
    expect(rows()).toHaveLength(3);
    const shortDesc = within(rows()[1]).getByText(truncateDescription(plans[1].description));
    expect(shortDesc.textContent?.endsWith("...")).toBe(true);
    expect(shortDesc.textContent).toHaveLength(43); // 40 ký tự + "..."
    expect(nbsp(within(rows()[0]).getAllByRole("cell")[1].textContent)).toBe("199.000 ₫");
    expect(nbsp(within(rows()[1]).getAllByRole("cell")[1].textContent)).toBe("1.990.000 ₫");
    expect(within(rows()[1]).getByText("365 ngày")).toBeInTheDocument();
    expect(within(rows()[0]).getByText("Đang bán")).toHaveClass("bg-success-light");
    expect(within(rows()[2]).getByText("Đã ẩn")).toHaveClass("bg-danger-light");
    expect(btn(rows()[0], "Chỉnh sửa VIP 1 tháng")).toBeEnabled();
    expect(btn(rows()[0], "Xóa VIP 1 tháng")).toBeEnabled();
    expect(screen.getByLabelText("Tìm kiếm trong bảng")).toBeInTheDocument();
    expect(document.querySelectorAll(".plan-icon-wrapper")).toHaveLength(3);
    expect(screen.queryByTestId("write-locked")).toBeNull();
  });

  it("API lỗi => khối lỗi + Thử lại, KHÔNG có 2 gói MOCK 'VIP Monthly/Yearly' của bản cũ; chưa cấu hình => WAITING FOR BACKEND; rỗng thật => dòng rỗng", async () => {
    vi.mocked(client.listAdminMembershipPlans).mockRejectedValueOnce(new ApiError("Máy chủ lỗi", 500)).mockResolvedValueOnce([]);
    const { unmount } = renderPage();
    const notice = await screen.findByTestId("membership-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(notice).toHaveTextContent("Máy chủ lỗi");
    expect(screen.queryByText("VIP Monthly")).toBeNull();
    expect(createButton()).toBeDisabled();
    await user.click(within(notice).getByText("Thử lại"));
    expect(await screen.findByText("Chưa có gói thành viên nào")).toBeInTheDocument();
    unmount();
    vi.mocked(client.listAdminMembershipPlans).mockRejectedValue(new ApiNotConfiguredError());
    renderPage();
    const waiting = await screen.findByTestId("membership-notice");
    expect(waiting).toHaveAttribute("data-kind", "waiting");
    expect(within(waiting).queryByText("Thử lại")).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("thao tác ghi (công tắc mở — mock ở lớp client)", () => {
  it("tạo: thiếu tên/giá => toast lỗi của bản cũ, không gọi API; đủ => createMembershipPlan(body, true), toast 'Tạo gói thành công', đóng modal, tải lại", async () => {
    renderPage();
    await waitForRows();
    await user.click(createButton());
    expect(within(dialog()).getByText("Tạo gói VIP mới")).toBeInTheDocument();
    await user.click(okButton("Tạo ngay"));
    expect(toast.error).toHaveBeenCalledWith("Vui lòng điền đầy đủ tên và giá hợp lệ");
    expect(client.createMembershipPlan).not.toHaveBeenCalled();
    await user.type(within(dialog()).getByLabelText(/Tên gói/), " VIP Mới ");
    await user.type(within(dialog()).getByLabelText(/Mô tả gói/), "Đặc quyền");
    const price = within(dialog()).getByLabelText(/Giá tiền/);
    await user.clear(price);
    await user.type(price, "250000");
    const duration = within(dialog()).getByLabelText(/Thời hạn/);
    await user.clear(duration);
    await user.type(duration, "60");
    expect(activeSwitch()).toHaveAttribute("aria-checked", "true");
    await user.click(activeSwitch());
    await user.click(okButton("Tạo ngay"));
    await waitFor(() => expect(client.createMembershipPlan).toHaveBeenCalledWith({ name: "VIP Mới", description: "Đặc quyền", price: 250000, durationInDays: 60, active: false }, true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tạo gói thành công"));
    await waitFor(() => expect(screen.queryByTestId("membership-plan-form")).toBeNull());
    expect(client.listAdminMembershipPlans).toHaveBeenCalledTimes(2);
  });

  it("sửa: form điền sẵn; đổi tên => updateMembershipPlan(id, body, true), toast 'Cập nhật gói thành công'; lỗi API => toast thông điệp, form giữ nguyên", async () => {
    renderPage();
    await waitForRows();
    await user.click(btn(rows()[1], "Chỉnh sửa VIP 12 tháng"));
    expect(within(dialog()).getByText("Chỉnh sửa gói VIP")).toBeInTheDocument();
    expect(within(dialog()).getByLabelText(/Tên gói/)).toHaveValue("VIP 12 tháng");
    expect(within(dialog()).getByLabelText(/Giá tiền/)).toHaveValue("1,990,000");
    expect(within(dialog()).getByLabelText(/Thời hạn/)).toHaveValue("365");
    expect(activeSwitch()).toHaveAttribute("aria-checked", "true");
    const name = within(dialog()).getByLabelText(/Tên gói/);
    await user.clear(name);
    await user.type(name, "VIP Năm");
    await user.click(okButton("Cập nhật"));
    await waitFor(() => expect(client.updateMembershipPlan).toHaveBeenCalledWith("p2", { name: "VIP Năm", description: plans[1].description, price: 1990000, durationInDays: 365, active: true }, true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cập nhật gói thành công"));
    await waitFor(() => expect(screen.queryByTestId("membership-plan-form")).toBeNull());

    vi.mocked(client.updateMembershipPlan).mockRejectedValueOnce(new ApiError("Tên gói đã tồn tại", 409));
    await waitForRows();
    await user.click(btn(rows()[0], "Chỉnh sửa VIP 1 tháng"));
    await user.click(okButton("Cập nhật"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Tên gói đã tồn tại"));
    expect(within(dialog()).getByLabelText(/Tên gói/)).toHaveValue("VIP 1 tháng");
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("xoá: confirmAction với chữ của bản cũ; từ chối => không gọi; đồng ý => deleteMembershipPlan(id, true) + toast; lỗi 409 => toast thông điệp máy chủ", async () => {
    vi.mocked(confirmAction).mockResolvedValueOnce(false).mockResolvedValue(true);
    renderPage();
    await waitForRows();
    const remove = () => user.click(btn(rows()[0], "Xóa VIP 1 tháng"));
    await remove();
    await waitFor(() => expect(confirmAction).toHaveBeenCalledWith({ title: "Xác nhận xóa gói", content: "Bạn có chắc chắn muốn xóa gói thành viên này không?", okText: "Xóa", cancelText: "Hủy", danger: true }));
    expect(client.deleteMembershipPlan).not.toHaveBeenCalled();
    await remove();
    await waitFor(() => expect(client.deleteMembershipPlan).toHaveBeenCalledWith("p1", true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Xóa gói thành công"));
    expect(client.listAdminMembershipPlans).toHaveBeenCalledTimes(2);
    vi.mocked(client.deleteMembershipPlan).mockRejectedValueOnce(new ApiError("Gói đã có giao dịch hoàn thành", 409));
    await waitForRows();
    await remove();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Gói đã có giao dịch hoàn thành"));
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("công tắc ghi đóng: WriteLockedNotice; Tạo/Sửa/Xoá bị khoá; không có lời gọi ghi", async () => {
    vi.mocked(useWriteGate).mockReturnValue({ availability: "waiting", enabled: false, demo: false });
    renderPage();
    await waitForRows();
    expect(screen.getByTestId("write-locked")).toHaveTextContent("WAITING FOR BACKEND");
    expect(createButton()).toBeDisabled();
    expect(btn(rows()[0], "Chỉnh sửa VIP 1 tháng")).toBeDisabled();
    expect(btn(rows()[0], "Xóa VIP 1 tháng")).toBeDisabled();
    expect(client.createMembershipPlan).not.toHaveBeenCalled();
    expect(client.deleteMembershipPlan).not.toHaveBeenCalled();
  });
});
