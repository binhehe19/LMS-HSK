import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminNotificationsPageContent } from "@/components/management/notifications/admin-notifications-page-content";
import { ManagementShell } from "@/components/management/management-shell";
import { fetchAdminUsers } from "@/lib/api/admin-user-client";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { getCampaignSendAvailability } from "@/lib/api/campaign-send-gate";
import { fetchCampaigns, fetchNotifications, getUnreadCount, sendCampaign } from "@/lib/api/notification-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { AdminUser, AdminUserListResponse } from "@/types/admin-user";
import type { CampaignPageResponse, CampaignResponse, NotificationPageResponse } from "@/types/notification";
import { adminUser } from "./fixtures/classes";

const push = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/settings/notifications", useRouter: () => ({ push, back: vi.fn() }) }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/notification-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/notification-client")>()),
  getUnreadCount: vi.fn(),
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  fetchCampaigns: vi.fn(),
  sendCampaign: vi.fn(),
}));
vi.mock("@/lib/api/admin-user-client", () => ({ fetchAdminUsers: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
vi.mock("@/lib/api/campaign-send-gate", () => ({ getCampaignSendAvailability: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const user = (i: number, over: Partial<AdminUser> = {}): AdminUser => ({ id: `u${i}`, email: `u${i}@example.test`, fullName: `Người dùng ${i}`, roles: ["ROLE_USER"], ...over });
const usersPage = (items: AdminUser[], over: Partial<AdminUserListResponse> = {}): AdminUserListResponse => ({
  items, totalElements: items.length, totalPages: 1, page: 0, size: 10, ...over,
});
const camp = (i: number, over: Partial<CampaignResponse> = {}): CampaignResponse => ({
  id: `c${i}`, title: `Chiến dịch ${i}`, message: `Nội dung ${i}`, audienceType: "SELECTED_USERS", status: "SUCCESS", createdAt: "2026-03-05T08:30:00", ...over,
});
const campaignsPage = (items: CampaignResponse[], over: Partial<CampaignPageResponse> = {}): CampaignPageResponse => ({
  items, totalElements: items.length, totalPages: 1, page: 0, size: 10, ...over,
});
const emptyList: NotificationPageResponse = { items: [], totalElements: 0, totalPages: 0, page: 0, size: 10, unreadCount: 0 };

beforeEach(() => {
  push.mockClear();
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(fetchNotifications).mockReset().mockResolvedValue(emptyList);
  vi.mocked(fetchCampaigns).mockReset().mockResolvedValue(campaignsPage([]));
  vi.mocked(fetchAdminUsers).mockReset().mockResolvedValue(usersPage([user(1), user(2), user(3)]));
  vi.mocked(sendCampaign).mockReset().mockResolvedValue(camp(99));
  vi.mocked(getCampaignSendAvailability).mockReset().mockReturnValue("enabled");
  for (const fn of [toast.success, toast.error, toast.info]) vi.mocked(fn).mockClear();
});

function renderPage() {
  render(
    <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
      <ManagementShell area="admin">
        <AdminNotificationsPageContent />
      </ManagementShell>
    </Provider>,
  );
}

const openComposer = async () => {
  await userEvent.click(await screen.findByRole("button", { name: /Gửi Thông Báo Mới/ }));
  return screen.getByTestId("notification-composer");
};
const recipientModal = () => screen.getByTestId("recipient-selector-modal");
const selectedText = () => within(recipientModal()).getByText((_, el) => el?.tagName === "SPAN" && !!el.textContent?.startsWith("Đã chọn:")).textContent ?? "";
const pagerText = () => within(recipientModal()).getByText((_, el) => el?.tagName === "SPAN" && /^Trang \d+ \/ \d+$/.test(el.textContent ?? "")).textContent;
const fillForm = async (title = "Tiêu đề thử", message = "Nội dung thử") => {
  await userEvent.type(screen.getByLabelText(/Tiêu đề thông báo/), title);
  await userEvent.type(screen.getByLabelText(/Nội dung thông báo/), message);
};
const pickRecipients = async (...names: string[]) => {
  await userEvent.click(screen.getByRole("button", { name: /Chọn người nhận/ }));
  await within(recipientModal()).findByText(names[0]);
  for (const name of names) await userEvent.click(within(within(recipientModal()).getByText(name).closest("tr") as HTMLElement).getByRole("button", { name: "Chọn" }));
  await userEvent.click(within(recipientModal()).getByRole("button", { name: /Hoàn tất chọn/ }));
};

describe("màn Quản lý thông báo của Admin — khung và danh sách (dùng lại màn Teacher)", () => {
  it("tiêu đề 'Quản lý thông báo', hai nút của Admin, khung trang không có g-4, danh sách thông báo của chính Admin", async () => {
    vi.mocked(fetchNotifications).mockResolvedValue({
      ...emptyList,
      items: [{ id: "n1", topic: "GENERAL", title: "Thông báo A", message: "ND A", resourceType: "", resourceId: "", payload: null, read: false, seen: false, createdAt: "2026-03-05T08:30:00", readAt: null, seenAt: null }],
      totalElements: 1, unreadCount: 1,
    });
    renderPage();
    expect(await screen.findByText("Thông báo A")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4 })).toHaveTextContent("Quản lý thông báo");
    expect(screen.getByRole("button", { name: /Thông báo đã gửi/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gửi Thông Báo Mới/ })).toBeInTheDocument();
    expect((document.querySelector(".content > .container > .row") as HTMLElement).className).toBe("row");
    expect(document.querySelector(".management-sidebar-column")).not.toBeNull(); // sidebar Admin
  });

  it("mở form: hai nút ở tiêu đề danh sách ẩn đi; Hủy/đóng quay lại như cũ", async () => {
    renderPage();
    const composer = await openComposer();
    expect(composer).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gửi Thông Báo Mới/ })).toBeNull();
    await userEvent.click(within(composer).getByRole("button", { name: "Hủy" }));
    expect(screen.queryByTestId("notification-composer")).toBeNull();
    expect(screen.getByRole("button", { name: /Gửi Thông Báo Mới/ })).toBeInTheDocument();
    await openComposer();
    await userEvent.click(screen.getByRole("button", { name: "Đóng form gửi thông báo" }));
    expect(screen.queryByTestId("notification-composer")).toBeNull();
  });
});

describe("form gửi thông báo — công tắc gửi ĐÓNG (backend chưa xác nhận hợp đồng)", () => {
  beforeEach(() => {
    vi.mocked(getCampaignSendAvailability).mockReturnValue("waiting");
  });

  it("hiện khối WAITING FOR BACKEND, khoá 'Xem trước & Gửi'; vẫn dùng được form; KHÔNG có đường nào tới sendCampaign", async () => {
    renderPage();
    await openComposer();
    expect(screen.getByTestId("campaign-send-notice")).toHaveTextContent("WAITING FOR BACKEND");
    const submit = screen.getByRole("button", { name: "Xem trước & Gửi" });
    expect(submit).toBeDisabled();
    await fillForm();
    await userEvent.click(submit); // bị khoá
    expect(screen.queryByTestId("campaign-preview-modal")).toBeNull();
    expect(sendCampaign).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled(); // không có "Đã gửi thành công" giả
  });
});

describe("form gửi thông báo — công tắc mở (kiểm thử trên MOCK ở lớp client)", () => {
  it("không có công tắc cảnh báo; thiếu tiêu đề/nội dung/người nhận => toast lỗi, không mở xác nhận, không gửi", async () => {
    renderPage();
    await openComposer();
    expect(screen.queryByTestId("campaign-send-notice")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Xem trước & Gửi" }));
    expect(toast.error).toHaveBeenCalledWith("Vui lòng nhập đầy đủ tiêu đề, nội dung và chọn ít nhất 1 người nhận.");
    expect(screen.queryByTestId("campaign-preview-modal")).toBeNull();
    await fillForm("   ", "x"); // chỉ khoảng trắng cũng là trống
    await userEvent.click(screen.getByRole("button", { name: "Xem trước & Gửi" }));
    expect(toast.error).toHaveBeenCalledTimes(2);
    expect(sendCampaign).not.toHaveBeenCalled();
  });

  it("đủ thông tin nhưng chưa chọn người nhận => vẫn lỗi", async () => {
    renderPage();
    await openComposer();
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Xem trước & Gửi" }));
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("campaign-preview-modal")).toBeNull();
  });

  it("luồng đầy đủ: chọn người nhận → xem trước (số người, nội dung) → xác nhận → gửi đúng nội dung một lần → toast thành công, đóng form, tải lại danh sách", async () => {
    renderPage();
    await openComposer();
    await fillForm("  Tiêu đề thử ", "Nội dung thử");
    await pickRecipients("Người dùng 1", "Người dùng 3");
    expect(screen.getByText(/Người nhận \(2\)/)).toBeInTheDocument();
    expect(screen.getAllByTestId("recipient-chip").map((c) => c.textContent)).toEqual(["Người dùng 1", "Người dùng 3"]);
    await userEvent.click(screen.getByRole("button", { name: "Xem trước & Gửi" }));
    const preview = screen.getByTestId("campaign-preview-modal");
    expect(within(preview).getByText("2", { selector: "strong" })).toBeInTheDocument();
    expect(within(preview).getByText("Nội dung thử")).toBeInTheDocument();
    const before = vi.mocked(fetchNotifications).mock.calls.length;
    await userEvent.click(within(preview).getByRole("button", { name: "Xác nhận & Gửi" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Thông báo đã được gửi thành công!"));
    expect(sendCampaign).toHaveBeenCalledTimes(1);
    // Tham số thứ hai = cờ chế độ xem trước cục bộ (false trong test: không phải bản demo).
    expect(sendCampaign).toHaveBeenCalledWith({ title: "Tiêu đề thử", message: "Nội dung thử", userIds: ["u1", "u3"] }, false);
    await waitFor(() => expect(screen.queryByTestId("notification-composer")).toBeNull());
    await waitFor(() => expect(vi.mocked(fetchNotifications).mock.calls.length).toBeGreaterThan(before));
    expect(screen.queryByTestId("campaign-preview-modal")).toBeNull();
  });

  it("chống gửi trùng: bấm xác nhận liên tiếp nhiều lần khi đang gửi chỉ tạo MỘT request; nút khoá + 'Đang gửi...'", async () => {
    let resolveSend: (c: CampaignResponse) => void = () => {};
    vi.mocked(sendCampaign).mockReturnValue(new Promise((r) => { resolveSend = r; }));
    renderPage();
    await openComposer();
    await fillForm();
    await pickRecipients("Người dùng 1");
    await userEvent.click(screen.getByRole("button", { name: "Xem trước & Gửi" }));
    const confirm = within(screen.getByTestId("campaign-preview-modal")).getByRole("button", { name: "Xác nhận & Gửi" });
    await act(async () => {
      confirm.click();
      confirm.click(); // trước khi React kịp vẽ lại
      confirm.click();
    });
    expect(sendCampaign).toHaveBeenCalledTimes(1);
    expect(within(screen.getByTestId("campaign-preview-modal")).getByRole("button", { name: /Đang gửi/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Xem trước & Gửi" })).toBeDisabled();
    await act(async () => resolveSend(camp(1)));
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(sendCampaign).toHaveBeenCalledTimes(1);
  });

  it("gửi lỗi: toast lỗi, KHÔNG báo thành công, giữ nguyên nội dung và người nhận để thử lại, đóng hộp xác nhận", async () => {
    vi.mocked(sendCampaign).mockRejectedValue(new ApiError("boom", 500));
    renderPage();
    await openComposer();
    await fillForm("Giữ lại", "Nội dung giữ lại");
    await pickRecipients("Người dùng 2");
    await userEvent.click(screen.getByRole("button", { name: "Xem trước & Gửi" }));
    await userEvent.click(within(screen.getByTestId("campaign-preview-modal")).getByRole("button", { name: "Xác nhận & Gửi" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Gửi thất bại, vui lòng thử lại."));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByTestId("campaign-preview-modal")).toBeNull();
    expect(screen.getByLabelText(/Tiêu đề thông báo/)).toHaveValue("Giữ lại");
    expect(screen.getByLabelText(/Nội dung thông báo/)).toHaveValue("Nội dung giữ lại");
    expect(screen.getAllByTestId("recipient-chip")).toHaveLength(1);
    // thử lại được (khoá đã mở)
    vi.mocked(sendCampaign).mockResolvedValue(camp(1));
    await userEvent.click(screen.getByRole("button", { name: "Xem trước & Gửi" }));
    await userEvent.click(within(screen.getByTestId("campaign-preview-modal")).getByRole("button", { name: "Xác nhận & Gửi" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(sendCampaign).toHaveBeenCalledTimes(2);
  });

  it("dịch vụ chưa cấu hình ở lúc gửi: báo 'chưa tích hợp', không báo thành công", async () => {
    vi.mocked(sendCampaign).mockRejectedValue(new ApiNotConfiguredError());
    renderPage();
    await openComposer();
    await fillForm();
    await pickRecipients("Người dùng 1");
    await userEvent.click(screen.getByRole("button", { name: "Xem trước & Gửi" }));
    await userEvent.click(within(screen.getByTestId("campaign-preview-modal")).getByRole("button", { name: "Xác nhận & Gửi" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Gửi thông báo chưa được tích hợp (chờ backend)."));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("chip người nhận: bỏ từng người, 'Xóa tất cả', và gộp '… và N người khác' khi quá 30", async () => {
    const many = Array.from({ length: 35 }, (_, i) => user(i + 1));
    vi.mocked(fetchAdminUsers).mockResolvedValue(usersPage(many, { totalElements: 35 }));
    renderPage();
    await openComposer();
    await userEvent.click(screen.getByRole("button", { name: /Chọn người nhận/ }));
    await within(recipientModal()).findByText("Người dùng 1");
    await userEvent.click(within(recipientModal()).getByRole("button", { name: "Chọn tất cả trang này" }));
    await userEvent.click(within(recipientModal()).getByRole("button", { name: /Hoàn tất chọn \(35\)/ }));
    expect(screen.getAllByTestId("recipient-chip")).toHaveLength(30);
    expect(screen.getByText("... và 5 người khác")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Bỏ chọn Người dùng 1" }));
    expect(screen.getByText(/Người nhận \(34\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Xóa tất cả/ }));
    expect(screen.getByText("Chưa có người dùng nào được chọn.")).toBeInTheDocument();
  });
});

describe("modal chọn người nhận", () => {
  it("tải danh sách khi mở (size 10, không gửi search/role rỗng), hiện họ tên/email/nhãn vai trò, 'Chưa cập nhật' khi thiếu tên", async () => {
    vi.mocked(fetchAdminUsers).mockResolvedValue(usersPage([user(1, { roles: ["ROLE_TEACHER", "ROLE_USER"] }), user(2, { fullName: undefined })]));
    renderPage();
    await openComposer();
    await userEvent.click(screen.getByRole("button", { name: /Chọn người nhận/ }));
    await within(recipientModal()).findByText("Người dùng 1");
    expect(fetchAdminUsers).toHaveBeenCalledWith({ page: 0, size: 10, search: "", role: undefined });
    const rows = within(recipientModal()).getAllByTestId("recipient-row");
    expect(within(rows[0]).getByText("TEACHER")).toBeInTheDocument();
    expect(within(rows[0]).getByText("USER")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Chưa cập nhật")).toBeInTheDocument();
    expect(selectedText()).toContain("0");
  });

  it("tìm kiếm chỉ áp dụng khi bấm 'Tìm kiếm' và về trang đầu; đổi vai trò gọi lại ngay với role và về trang đầu", async () => {
    renderPage();
    await openComposer();
    await userEvent.click(screen.getByRole("button", { name: /Chọn người nhận/ }));
    await within(recipientModal()).findByText("Người dùng 1");
    await userEvent.type(within(recipientModal()).getByPlaceholderText("Tìm theo tên, email..."), "an");
    expect(fetchAdminUsers).toHaveBeenCalledTimes(1); // gõ chưa gọi
    await userEvent.click(within(recipientModal()).getByRole("button", { name: "Tìm kiếm" }));
    await waitFor(() => expect(fetchAdminUsers).toHaveBeenLastCalledWith({ page: 0, size: 10, search: "an", role: undefined }));
    await userEvent.selectOptions(within(recipientModal()).getByLabelText("Lọc theo vai trò"), "ROLE_TEACHER");
    await waitFor(() => expect(fetchAdminUsers).toHaveBeenLastCalledWith({ page: 0, size: 10, search: "an", role: "ROLE_TEACHER" }));
    expect(within(recipientModal()).getByRole("button", { name: "Chọn tất cả TEACHER" })).toBeInTheDocument();
  });

  it("phân trang: Trang trước/sau gọi đúng trang, giữ bộ lọc; đổi bộ lọc khi đang ở trang 2 => về trang đầu", async () => {
    vi.mocked(fetchAdminUsers).mockImplementation(async (q) => usersPage([user((q?.page ?? 0) * 10 + 1)], { totalElements: 25, totalPages: 3, page: q?.page ?? 0 }));
    renderPage();
    await openComposer();
    await userEvent.click(screen.getByRole("button", { name: /Chọn người nhận/ }));
    await within(recipientModal()).findByText("Người dùng 1");
    expect(pagerText()).toBe("Trang 1 / 3");
    expect(within(recipientModal()).getByRole("button", { name: /Trang trước/ })).toBeDisabled();
    await userEvent.selectOptions(within(recipientModal()).getByLabelText("Lọc theo vai trò"), "ROLE_USER");
    await userEvent.click(within(recipientModal()).getByRole("button", { name: /Trang sau/ }));
    await waitFor(() => expect(fetchAdminUsers).toHaveBeenLastCalledWith({ page: 1, size: 10, search: "", role: "ROLE_USER" })); // giữ bộ lọc khi chuyển trang
    await within(recipientModal()).findByText("Người dùng 11");
    await userEvent.click(within(recipientModal()).getByRole("button", { name: /Trang sau/ }));
    await within(recipientModal()).findByText("Người dùng 21");
    expect(within(recipientModal()).getByRole("button", { name: /Trang sau/ })).toBeDisabled();
    await userEvent.selectOptions(within(recipientModal()).getByLabelText("Lọc theo vai trò"), "ROLE_TEACHER");
    await waitFor(() => expect(fetchAdminUsers).toHaveBeenLastCalledWith({ page: 0, size: 10, search: "", role: "ROLE_TEACHER" })); // đổi bộ lọc => trang đầu
  });

  it("thanh phân trang KHÔNG biến mất khi đang tải trang khác (giữ tổng số trang như bản cũ)", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    vi.mocked(fetchAdminUsers).mockImplementation(async (q) => {
      if ((q?.page ?? 0) === 1) await gate;
      return usersPage([user((q?.page ?? 0) + 1)], { totalElements: 25, totalPages: 3, page: q?.page ?? 0 });
    });
    renderPage();
    await openComposer();
    await userEvent.click(screen.getByRole("button", { name: /Chọn người nhận/ }));
    await within(recipientModal()).findByText("Người dùng 1");
    await userEvent.click(within(recipientModal()).getByRole("button", { name: /Trang sau/ }));
    expect(within(recipientModal()).getByText("Đang tải...")).toBeInTheDocument(); // đang tải trang 2
    expect(pagerText()).toBe("Trang 2 / 3");
    expect(within(recipientModal()).getByRole("button", { name: /Trang sau/ })).toBeInTheDocument();
    await act(async () => release());
    await within(recipientModal()).findByText("Người dùng 2");
  });

  it("trang hiện tại không còn hợp lệ (dữ liệu giảm) => nhảy về trang cuối còn dữ liệu", async () => {
    vi.mocked(fetchAdminUsers).mockImplementation(async (q) =>
      (q?.page ?? 0) >= 2 ? usersPage([], { totalElements: 11, totalPages: 2, page: q?.page ?? 0 }) : usersPage([user((q?.page ?? 0) + 1)], { totalElements: 25, totalPages: 3, page: q?.page ?? 0 }),
    );
    renderPage();
    await openComposer();
    await userEvent.click(screen.getByRole("button", { name: /Chọn người nhận/ }));
    await within(recipientModal()).findByText("Người dùng 1");
    await userEvent.click(within(recipientModal()).getByRole("button", { name: /Trang sau/ }));
    await within(recipientModal()).findByText("Người dùng 2");
    vi.mocked(fetchAdminUsers).mockImplementation(async (q) =>
      (q?.page ?? 0) >= 2 ? usersPage([], { totalElements: 11, totalPages: 2, page: q?.page ?? 0 }) : usersPage([user((q?.page ?? 0) + 1)], { totalElements: 11, totalPages: 2, page: q?.page ?? 0 }),
    );
    await userEvent.click(within(recipientModal()).getByRole("button", { name: /Trang sau/ })); // trang 3 (index 2) không còn
    await waitFor(() => expect(fetchAdminUsers).toHaveBeenLastCalledWith({ page: 1, size: 10, search: "", role: undefined }));
    await within(recipientModal()).findByText("Người dùng 2");
  });

  it("'Chọn tất cả trang này' thêm đúng người của trang; chọn/bỏ từng người cập nhật đếm", async () => {
    renderPage();
    await openComposer();
    await userEvent.click(screen.getByRole("button", { name: /Chọn người nhận/ }));
    await within(recipientModal()).findByText("Người dùng 1");
    await userEvent.click(within(recipientModal()).getByRole("button", { name: "Chọn tất cả trang này" }));
    expect(selectedText()).toContain("3");
    const row = within(recipientModal()).getAllByTestId("recipient-row")[0];
    await userEvent.click(within(row).getByRole("button", { name: "Bỏ chọn" }));
    expect(selectedText()).toContain("2");
    expect(within(recipientModal()).getByRole("button", { name: /Hoàn tất chọn \(2\)/ })).toBeInTheDocument();
  });

  it("'Chọn tất cả …' lấy hết người phù hợp bằng 2 lời gọi (size 1 rồi size = tổng) và báo thành công", async () => {
    const all = Array.from({ length: 12 }, (_, i) => user(i + 1));
    vi.mocked(fetchAdminUsers).mockImplementation(async (q) => (q?.size === 12 ? usersPage(all, { totalElements: 12 }) : usersPage(all.slice(0, q?.size ?? 10), { totalElements: 12, totalPages: 2 })));
    renderPage();
    await openComposer();
    await userEvent.click(screen.getByRole("button", { name: /Chọn người nhận/ }));
    await within(recipientModal()).findByText("Người dùng 1");
    await userEvent.click(within(recipientModal()).getByRole("button", { name: "Chọn tất cả người dùng" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã chọn tất cả 12 người dùng phù hợp"));
    expect(fetchAdminUsers).toHaveBeenCalledWith({ page: 0, size: 1, search: "", role: undefined });
    expect(fetchAdminUsers).toHaveBeenCalledWith({ page: 0, size: 12, search: "", role: undefined });
    expect(selectedText()).toContain("12");
  });

  it("'Chọn tất cả …' khi máy chủ chỉ trả một phần: thêm phần lấy được và BÁO LỖI (không báo 'đã chọn tất cả')", async () => {
    vi.mocked(fetchAdminUsers).mockImplementation(async (q) => usersPage(Array.from({ length: Math.min(q?.size ?? 10, 10) }, (_, i) => user(i + 1)), { totalElements: 50, totalPages: 5 }));
    renderPage();
    await openComposer();
    await userEvent.click(screen.getByRole("button", { name: /Chọn người nhận/ }));
    await within(recipientModal()).findByText("Người dùng 1");
    await userEvent.click(within(recipientModal()).getByRole("button", { name: "Chọn tất cả người dùng" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("10/50")));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("không có người phù hợp: toast thông tin; danh sách rỗng hiện 'Không tìm thấy người dùng'", async () => {
    vi.mocked(fetchAdminUsers).mockResolvedValue(usersPage([], { totalElements: 0, totalPages: 0 }));
    renderPage();
    await openComposer();
    await userEvent.click(screen.getByRole("button", { name: /Chọn người nhận/ }));
    expect(await within(recipientModal()).findByText("Không tìm thấy người dùng")).toBeInTheDocument();
    expect(within(recipientModal()).getByRole("button", { name: "Chọn tất cả trang này" })).toBeDisabled();
    expect(within(recipientModal()).getByRole("button", { name: "Chọn tất cả người dùng" })).toBeDisabled(); // không bộ lọc + không có ai
    await userEvent.type(within(recipientModal()).getByPlaceholderText("Tìm theo tên, email..."), "zzz");
    await userEvent.click(within(recipientModal()).getByRole("button", { name: "Chọn tất cả người dùng" }));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("Không có người dùng nào phù hợp để chọn"));
  });

  it("đang tải: spinner 'Đang tải...'", async () => {
    vi.mocked(fetchAdminUsers).mockReturnValue(new Promise(() => {}));
    renderPage();
    await openComposer();
    await userEvent.click(screen.getByRole("button", { name: /Chọn người nhận/ }));
    expect(within(recipientModal()).getByText("Đang tải...")).toBeInTheDocument();
  });

  it("dịch vụ người dùng chưa cấu hình: khối WAITING FOR BACKEND trong bảng, không toast lỗi, không dữ liệu giả", async () => {
    vi.mocked(fetchAdminUsers).mockRejectedValue(new ApiNotConfiguredError());
    renderPage();
    await openComposer();
    await userEvent.click(screen.getByRole("button", { name: /Chọn người nhận/ }));
    const notice = await within(recipientModal()).findByTestId("recipient-data-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(notice).toHaveTextContent("WAITING FOR BACKEND");
    expect(within(recipientModal()).queryByText("Không tìm thấy người dùng")).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("lỗi gọi: toast + khối lỗi + 'Thử lại' tải lại được; đóng modal giữ nguyên người đã chọn", async () => {
    vi.mocked(fetchAdminUsers).mockRejectedValueOnce(new ApiError("Máy chủ lỗi", 500)).mockResolvedValue(usersPage([user(1)]));
    renderPage();
    await openComposer();
    await userEvent.click(screen.getByRole("button", { name: /Chọn người nhận/ }));
    const notice = await within(recipientModal()).findByTestId("recipient-data-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(toast.error).toHaveBeenCalledWith("Không tải được danh sách người dùng");
    await userEvent.click(within(recipientModal()).getByRole("button", { name: "Thử lại" }));
    await within(recipientModal()).findByText("Người dùng 1");
    await userEvent.click(within(recipientModal()).getByRole("button", { name: "Chọn" }));
    await userEvent.click(within(recipientModal()).getByRole("button", { name: "Hủy" })); // đóng không làm mất lựa chọn
    expect(screen.queryByTestId("recipient-selector-modal")).toBeNull();
    expect(screen.getByText(/Người nhận \(1\)/)).toBeInTheDocument();
  });
});

describe("modal lịch sử chiến dịch (chỉ đọc)", () => {
  const openHistory = async () => {
    await userEvent.click(await screen.findByRole("button", { name: /Thông báo đã gửi/ }));
    return screen.getByTestId("campaign-history-modal");
  };

  it("liệt kê chiến dịch (tiêu đề, ngày DD/MM/YYYY HH:mm, đối tượng, trạng thái có màu), gọi fetchCampaigns(0, 10)", async () => {
    vi.mocked(fetchCampaigns).mockResolvedValue(campaignsPage([camp(1), camp(2, { status: "PROCESSING" }), camp(3, { status: "FAILED" })]));
    renderPage();
    const modal = await openHistory();
    await within(modal).findByText("Chiến dịch 1");
    expect(fetchCampaigns).toHaveBeenCalledWith(0, 10);
    const rows = within(modal).getAllByTestId("campaign-row");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("05/03/2026 08:30")).toBeInTheDocument();
    expect(within(rows[0]).getByText("SUCCESS").className).toContain("text-success");
    expect(within(rows[1]).getByText("PROCESSING").className).toContain("text-info");
    expect(within(rows[2]).getByText("FAILED").className).toContain("text-warning");
  });

  it("bấm một dòng: xem chi tiết (đầy đủ nội dung, ngày, đối tượng); 'Quay lại danh sách' về danh sách", async () => {
    vi.mocked(fetchCampaigns).mockResolvedValue(campaignsPage([camp(1, { message: "Dòng 1\nDòng 2" })]));
    renderPage();
    const modal = await openHistory();
    await userEvent.click(await within(modal).findByTestId("campaign-row"));
    const detail = within(modal).getByTestId("campaign-detail");
    expect(within(detail).getByRole("heading", { level: 4 })).toHaveTextContent("Chiến dịch 1");
    expect(detail).toHaveTextContent("Đã gửi lúc: 05/03/2026 08:30");
    expect(detail).toHaveTextContent("Đối tượng: SELECTED_USERS");
    expect(detail.querySelector(".notification-message-content")?.textContent).toBe("Dòng 1\nDòng 2");
    await userEvent.click(within(detail).getByRole("button", { name: /Quay lại danh sách/ }));
    expect(within(modal).getByTestId("campaign-row")).toBeInTheDocument();
  });

  it("phân trang lịch sử: Trước/Sau đúng trang; trang không còn hợp lệ => về trang cuối còn dữ liệu", async () => {
    vi.mocked(fetchCampaigns).mockImplementation(async (page = 0) => campaignsPage([camp(page + 1)], { totalElements: 25, totalPages: 3, page }));
    renderPage();
    const modal = await openHistory();
    await within(modal).findByText("Chiến dịch 1");
    expect(within(modal).getByRole("button", { name: /Trước/ })).toBeDisabled();
    await userEvent.click(within(modal).getByRole("button", { name: /Sau/ }));
    await within(modal).findByText("Chiến dịch 2");
    expect(fetchCampaigns).toHaveBeenLastCalledWith(1, 10);
    vi.mocked(fetchCampaigns).mockImplementation(async (page = 0) => (page >= 2 ? campaignsPage([], { totalElements: 11, totalPages: 2, page }) : campaignsPage([camp(page + 1)], { totalElements: 11, totalPages: 2, page })));
    await userEvent.click(within(modal).getByRole("button", { name: /Sau/ })); // trang index 2 không còn
    await waitFor(() => expect(fetchCampaigns).toHaveBeenLastCalledWith(1, 10));
    await within(modal).findByText("Chiến dịch 2");
  });

  it("rỗng thật => 'Chưa có thông báo nào được gửi.'; đang tải => spinner", async () => {
    vi.mocked(fetchCampaigns).mockResolvedValue(campaignsPage([]));
    renderPage();
    const modal = await openHistory();
    expect(await within(modal).findByText("Chưa có thông báo nào được gửi.")).toBeInTheDocument();
  });

  it("đang tải: 'Đang tải lịch sử...'", async () => {
    vi.mocked(fetchCampaigns).mockReturnValue(new Promise(() => {}));
    renderPage();
    const modal = await openHistory();
    expect(within(modal).getByText("Đang tải lịch sử...")).toBeInTheDocument();
  });

  it("chưa cấu hình => WAITING FOR BACKEND (KHÔNG nói 'chưa có thông báo nào được gửi'), không toast lỗi", async () => {
    vi.mocked(fetchCampaigns).mockRejectedValue(new ApiNotConfiguredError());
    renderPage();
    const modal = await openHistory();
    const notice = await within(modal).findByTestId("campaign-data-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(within(modal).queryByText("Chưa có thông báo nào được gửi.")).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("lỗi => toast + khối lỗi + 'Thử lại'; đóng modal bằng nút Đóng", async () => {
    vi.mocked(fetchCampaigns).mockRejectedValueOnce(new ApiError("Lịch sử lỗi", 500)).mockResolvedValue(campaignsPage([camp(1)]));
    renderPage();
    const modal = await openHistory();
    expect(await within(modal).findByTestId("campaign-data-notice")).toHaveAttribute("data-kind", "error");
    expect(toast.error).toHaveBeenCalledWith("Không tải được lịch sử thông báo");
    await userEvent.click(within(modal).getByRole("button", { name: "Thử lại" }));
    await within(modal).findByText("Chiến dịch 1");
    await userEvent.click(within(modal).getAllByRole("button", { name: "Đóng" }).at(-1)!);
    expect(screen.queryByTestId("campaign-history-modal")).toBeNull();
  });
});
