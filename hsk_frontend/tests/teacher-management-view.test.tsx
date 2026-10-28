import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManagementShell } from "@/components/management/management-shell";
import { TeacherManagementPageContent } from "@/components/management/teacher-management/teacher-management-page-content";
import { confirmAction } from "@/components/shared/confirm-action";
import { useWriteGate } from "@/hooks/use-write-gate";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import * as client from "@/lib/api/teacher-management-client";
import { makeStore } from "@/redux/store";
import { adminUser } from "./fixtures/classes";
import { doneJob, idleJob, teacher, teachersFixture } from "./fixtures/teachers";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/teacher-management", useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/teacher-management-client", () => ({
  fetchTeachers: vi.fn(),
  fetchTeacherJobStatus: vi.fn(),
  fetchRecentlyCreatedTeachers: vi.fn(),
  syncTeachersFromCms: vi.fn(),
  createTeacher: vi.fn(),
  updateTeacher: vi.fn(),
  resendTeacherAccountEmail: vi.fn(),
  blockTeacher: vi.fn(),
  activateTeacher: vi.fn(),
  importTeachers: vi.fn(),
}));
vi.mock("@/hooks/use-write-gate", () => ({ useWriteGate: vi.fn() }));
vi.mock("@/components/shared/confirm-action", () => ({ confirmAction: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

// antd (cssinjs) chèn thêm <style> vào <head> ở mỗi lần render và cleanup() không gỡ; jsdom duyệt lại toàn bộ stylesheet cho mỗi
// getComputedStyle (Testing Library gọi khi tra role) nên thời gian mỗi ca tăng dần theo số ca đã chạy. Gỡ sau mỗi ca để giữ tốc độ ổn định.
afterEach(() => {
  document.querySelectorAll("style[data-css-hash], style[data-rc-order]").forEach((node) => node.remove());
});

beforeEach(() => {
  for (const fn of Object.values(client)) vi.mocked(fn).mockReset();
  vi.mocked(client.fetchTeachers).mockResolvedValue(teachersFixture);
  vi.mocked(client.fetchTeacherJobStatus).mockResolvedValue(idleJob);
  vi.mocked(client.fetchRecentlyCreatedTeachers).mockResolvedValue([]);
  vi.mocked(useWriteGate).mockReturnValue({ availability: "enabled", enabled: true, demo: true });
  vi.mocked(confirmAction).mockReset().mockResolvedValue(true);
  for (const fn of [toast.success, toast.error, toast.warning, toast.info]) vi.mocked(fn).mockClear();
});

function renderPage() {
  return render(
    <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
      <ManagementShell area="admin">
        <TeacherManagementPageContent />
      </ManagementShell>
    </Provider>,
  );
}

/** Ca mở antd Modal nhiều trường (form tạo/sửa, đồng bộ) tốn 3–5 giây trong jsdom khi máy bận; nới hạn để không hỏng vì tải máy. */
const HEAVY_TIMEOUT = 20_000;
/** Điền ô nhập một lần (fireEvent.change) thay cho gõ từng ký tự: mỗi ký tự làm antd Modal vẽ lại, hàng chục ký tự là vài giây trong jsdom. */
const fill = (element: HTMLElement, value: string) => fireEvent.change(element, { target: { value } });
const rows = () => document.querySelectorAll(".tm-teacher-cell");
const statValues = () => [...document.querySelectorAll(".tm-stat-card h3")].map((n) => n.textContent);
const dialog = () => screen.getByRole("dialog");
const waitForRows = async () => {
  await screen.findByText("Giảng viên 1");
};

describe("màn Quản lý giảng viên — khung, thống kê, bảng", () => {
  it("hero + 3 thẻ (12/8/4) + bảng 10 dòng/trang với avatar chữ cái, tag GIẢNG VIÊN, trạng thái; sidebar Admin; DOM .content>.container>.row", async () => {
    renderPage();
    expect(screen.getByTestId("teacher-list-loading")).toBeInTheDocument();
    expect(statValues()).toEqual(["0", "0", "0"]); // đang tải: số 0 như bản cũ
    await waitForRows();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Quản lý giảng viên");
    expect(statValues()).toEqual(["12", "8", "4"]);
    expect(rows()).toHaveLength(10);
    expect(document.querySelector(".teacher-management-page .content > .container > .row > .col-lg-9")).not.toBeNull();
    expect(document.querySelector(".management-sidebar-column")).not.toBeNull();
    const first = rows()[0].closest("tr") as HTMLElement;
    expect(within(first).getByText("G")).toHaveClass("tm-avatar");
    expect(within(first).getByText("GIẢNG VIÊN")).toBeInTheDocument();
    expect(within(first).getByText("Hoạt động")).toBeInTheDocument();
    expect(within(first).getByRole("button", { name: "Khóa Giảng viên 1" })).toBeInTheDocument();
    const third = rows()[2].closest("tr") as HTMLElement;
    expect(within(third).getByText("Đã khóa")).toBeInTheDocument();
    expect(within(third).getByRole("button", { name: "Mở khóa Giảng viên 3" })).toBeInTheDocument();
    expect(screen.queryByTestId("write-locked")).toBeNull();
    // trang 2: 2 dòng, dòng thiếu tên hiện "Chưa cập nhật"
    await userEvent.click(document.querySelector(".ant-pagination-item-2") as HTMLElement);
    expect(rows()).toHaveLength(2);
    expect(screen.getByText("Chưa cập nhật")).toBeInTheDocument();
  });

  it("dịch vụ chưa cấu hình => WAITING FOR BACKEND (không Thử lại), thẻ '—', không bảng", async () => {
    vi.mocked(client.fetchTeachers).mockRejectedValue(new ApiNotConfiguredError());
    vi.mocked(client.fetchTeacherJobStatus).mockRejectedValue(new ApiNotConfiguredError());
    renderPage();
    const notice = await screen.findByTestId("teacher-list-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(notice).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
    expect(statValues()).toEqual(["—", "—", "—"]);
    expect(rows()).toHaveLength(0);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("lỗi tải => khối lỗi có thông điệp + Thử lại tải lại được", async () => {
    vi.mocked(client.fetchTeachers).mockRejectedValueOnce(new ApiError("Máy chủ lỗi", 500));
    renderPage();
    const notice = await screen.findByTestId("teacher-list-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(notice).toHaveTextContent("Máy chủ lỗi");
    await userEvent.click(within(notice).getByRole("button", { name: "Thử lại" }));
    await waitForRows();
    expect(client.fetchTeachers).toHaveBeenCalledTimes(2);
  });

  it("danh sách rỗng => dòng 'Chưa có giảng viên nào', thẻ 0", async () => {
    vi.mocked(client.fetchTeachers).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Chưa có giảng viên nào")).toBeInTheDocument();
    expect(statValues()).toEqual(["0", "0", "0"]);
  });
});

describe("công tắc ghi ĐÓNG (WAITING FOR BACKEND)", () => {
  beforeEach(() => vi.mocked(useWriteGate).mockReturnValue({ availability: "waiting", enabled: false, demo: false }));

  it("WriteLockedNotice; khoá Đồng bộ CMS/Import/Tạo/Cấp lại mật khẩu/Sửa/Khóa; vẫn dùng Tải file mẫu và Tài khoản mới", async () => {
    renderPage();
    await waitForRows();
    expect(screen.getByTestId("write-locked")).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.getByRole("button", { name: /Đồng bộ CMS/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Import Excel/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Tạo giảng viên/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cấp lại mật khẩu cho Giảng viên 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Chỉnh sửa Giảng viên 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Khóa Giảng viên 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mở khóa Giảng viên 3" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Tải file mẫu/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Tài khoản mới/ })).toBeEnabled();
    expect(client.blockTeacher).not.toHaveBeenCalled();
  });
});

describe("thao tác ghi (công tắc mở — kiểm thử trên mock ở lớp client)", () => {
  it("Tạo giảng viên: modal có đủ trường; nút Tạo khoá khi thiếu dữ liệu; đủ => gọi createTeacher đúng payload, đóng form, mở 'Tài khoản vừa tạo' có bản ghi mới", async () => {
    const created = teacher(99, { email: "moi@example.test", fullName: "Giảng viên Mới", createdAt: new Date().toISOString(), emailStatus: "SUCCESS" });
    vi.mocked(client.createTeacher).mockResolvedValue({ teacher: created, emailStatus: "SUCCESS" });
    vi.mocked(client.fetchRecentlyCreatedTeachers).mockResolvedValue([created]);
    renderPage();
    await waitForRows();
    await userEvent.click(screen.getByRole("button", { name: /Tạo giảng viên/ }));
    const modal = dialog();
    expect(within(modal).getByText("Tạo giảng viên mới")).toBeInTheDocument();
    for (const label of ["Email", "Họ và tên", "Ảnh đại diện", "Mô tả ngắn", "Mô tả chi tiết", "Phong cách giảng dạy", "Bằng cấp / Chứng chỉ", "Video giới thiệu"]) {
      expect(within(modal).getByLabelText(new RegExp(`^${label.replace("/", "\\/")}`))).toBeInTheDocument();
    }
    const submit = within(modal).getByRole("button", { name: "Tạo giảng viên" });
    expect(submit).toBeDisabled();
    fill(within(modal).getByLabelText(/^Email/), "moi@example");
    expect(within(modal).getByLabelText(/^Email/)).toHaveClass("is-invalid"); // email chưa đúng định dạng
    expect(within(modal).getByText("• Email đúng định dạng")).toHaveClass("bad");
    fill(within(modal).getByLabelText(/^Email/), "moi@example.test");
    fill(within(modal).getByLabelText(/^Họ và tên/), " Giảng viên Mới ");
    fill(within(modal).getByLabelText(/^Bằng cấp/), "HSK 6");
    expect(within(modal).getByText("✓ Email đúng định dạng")).toHaveClass("ok");
    expect(within(modal).getByText("✓ Họ và tên không để trống")).toHaveClass("ok");
    expect(submit).toBeEnabled();
    await userEvent.click(submit);
    await waitFor(() => expect(client.createTeacher).toHaveBeenCalledWith({ email: "moi@example.test", fullName: "Giảng viên Mới", qualification: "HSK 6" }, true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tạo giảng viên thành công. Mật khẩu đã được gửi qua email."));
    await waitFor(() => expect(screen.queryByText("Tạo giảng viên mới")).toBeNull());
    const accounts = await screen.findByTestId("new-accounts-list");
    expect(within(accounts).getByText("Giảng viên Mới")).toBeInTheDocument();
    expect(within(accounts).getByText("✓ Email gửi thành công")).toBeInTheDocument();
    expect(screen.getByText("Tài khoản vừa tạo (1 mới)")).toBeInTheDocument();
    expect(client.fetchTeachers).toHaveBeenCalledTimes(2); // tải lại sau khi tạo
  }, HEAVY_TIMEOUT);

  it("tạo lỗi (409 email trùng) => toast thông điệp lỗi, form giữ nguyên để sửa, KHÔNG báo thành công", async () => {
    vi.mocked(client.createTeacher).mockRejectedValue(new ApiError("Email đã được dùng cho giảng viên khác", 409));
    renderPage();
    await waitForRows();
    await userEvent.click(screen.getByRole("button", { name: /Tạo giảng viên/ }));
    const modal = dialog();
    fill(within(modal).getByLabelText(/^Email/), "trung@example.test");
    fill(within(modal).getByLabelText(/^Họ và tên/), "Trùng");
    await userEvent.click(within(modal).getByRole("button", { name: "Tạo giảng viên" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Email đã được dùng cho giảng viên khác"));
    expect(toast.success).not.toHaveBeenCalled();
    expect(within(dialog()).getByLabelText(/^Email/)).toHaveValue("trung@example.test");
  }, HEAVY_TIMEOUT);

  it("Sửa: form điền sẵn, email khoá; lưu => updateTeacher không có email/status, toast, đóng", async () => {
    vi.mocked(client.fetchTeachers).mockResolvedValue([teacher(1, { qualification: "HSK 5", shortDescription: "Mô tả cũ" })]);
    vi.mocked(client.updateTeacher).mockResolvedValue(teacher(1, { qualification: "HSK 6" }));
    renderPage();
    await waitForRows();
    await userEvent.click(screen.getByRole("button", { name: "Chỉnh sửa Giảng viên 1" }));
    const modal = dialog();
    expect(within(modal).getByText("Cập nhật giảng viên")).toBeInTheDocument();
    expect(within(modal).getByLabelText(/^Email/)).toHaveValue("giangvien1@example.test");
    expect(within(modal).getByLabelText(/^Email/)).toBeDisabled();
    expect(within(modal).getByLabelText(/^Họ và tên/)).toHaveValue("Giảng viên 1");
    expect(within(modal).getByText("8/500 ký tự")).toBeInTheDocument(); // "Mô tả cũ" = 8 ký tự
    expect(within(modal).getByLabelText(/^Bằng cấp/)).toHaveValue("HSK 5");
    fill(within(modal).getByLabelText(/^Bằng cấp/), "HSK 6");
    await userEvent.click(within(modal).getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(client.updateTeacher).toHaveBeenCalledWith("gv-1", { fullName: "Giảng viên 1", shortDescription: "Mô tả cũ", qualification: "HSK 6", avatarUrl: undefined, fullDescription: undefined, teachingStyle: undefined, videoIntroLink: undefined }, true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cập nhật giảng viên thành công"));
    await waitFor(() => expect(screen.queryByText("Cập nhật giảng viên")).toBeNull());
  }, HEAVY_TIMEOUT);

  it("Khóa: hỏi xác nhận (confirmAction, nguy hiểm) => đồng ý gọi blockTeacher và tải lại; từ chối thì không gọi", async () => {
    vi.mocked(client.blockTeacher).mockResolvedValue(teacher(1, { status: "BLOCKED" }));
    renderPage();
    await waitForRows();
    vi.mocked(confirmAction).mockResolvedValueOnce(false);
    await userEvent.click(screen.getByRole("button", { name: "Khóa Giảng viên 1" }));
    await waitFor(() => expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xác nhận khóa giảng viên", okText: "Xác nhận khóa", danger: true })));
    expect(client.blockTeacher).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Khóa Giảng viên 1" }));
    await waitFor(() => expect(client.blockTeacher).toHaveBeenCalledWith("gv-1", true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã khóa quyền truy cập tài khoản giảng viên"));
    expect(client.fetchTeachers).toHaveBeenCalledTimes(2);
  });

  it("Mở khóa: xác nhận rồi gọi activateTeacher", async () => {
    vi.mocked(client.activateTeacher).mockResolvedValue(teacher(3));
    renderPage();
    await waitForRows();
    await userEvent.click(screen.getByRole("button", { name: "Mở khóa Giảng viên 3" }));
    await waitFor(() => expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xác nhận mở khóa giảng viên", okText: "Xác nhận mở khóa" })));
    await waitFor(() => expect(client.activateTeacher).toHaveBeenCalledWith("gv-3", true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã mở khóa tài khoản giảng viên"));
  });

  it("Cấp lại mật khẩu trong bảng => resendTeacherAccountEmail; FAILED => toast lỗi kèm lý do", async () => {
    vi.mocked(client.resendTeacherAccountEmail).mockResolvedValue({ teacher: teacher(2), emailStatus: "FAILED", emailStatusReason: "Hộp thư không tồn tại" });
    renderPage();
    await waitForRows();
    await userEvent.click(screen.getByRole("button", { name: "Cấp lại mật khẩu cho Giảng viên 2" }));
    await waitFor(() => expect(client.resendTeacherAccountEmail).toHaveBeenCalledWith("gv-2", true));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Gửi email thất bại: Hộp thư không tồn tại"));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("Tải file mẫu: tạo blob CSV (text/csv, BOM, tiêu đề cũ) và kích hoạt tải với tên Template_Import_Giang_Vien.csv — không gọi mạng", async () => {
    const blobs: Blob[] = [];
    vi.stubGlobal("URL", Object.assign(Object.create(URL), { createObjectURL: vi.fn((b: Blob) => (blobs.push(b), "blob:mock")), revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderPage();
    await waitForRows();
    await userEvent.click(screen.getByRole("button", { name: /Tải file mẫu/ }));
    expect(blobs).toHaveLength(1);
    expect(blobs[0].type).toBe("text/csv;charset=utf-8");
    // jsdom chưa có Blob.text(): đọc bằng FileReader (readAsText bỏ BOM theo chuẩn, nên BOM kiểm tra qua số byte = 3 byte thừa).
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blobs[0]);
    });
    expect(text.startsWith("Email (*),Họ và tên (*),Mô tả ngắn")).toBe(true);
    expect(blobs[0].size).toBe(new TextEncoder().encode(`﻿${text}`).length);
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    vi.unstubAllGlobals();
  });

  it("Import Excel: chọn file => importTeachers(file, demo); kết quả có item => mở 'Tài khoản vừa tạo'; toast số dòng", async () => {
    const imported = teacher(50, { fullName: "GV Import", createdAt: new Date().toISOString(), emailStatus: "SUCCESS" });
    vi.mocked(client.importTeachers).mockResolvedValue({ createdCount: 1, skippedCount: 1, skippedReasons: ["Dòng 3: Email chưa đúng định dạng"], items: [{ teacher: imported, emailStatus: "SUCCESS" }] });
    vi.mocked(client.fetchRecentlyCreatedTeachers).mockResolvedValue([imported]);
    renderPage();
    await waitForRows();
    const file = new File(["Email (*),Họ và tên (*)\r\na@b.vn,A\r\n"], "giang-vien.csv", { type: "text/csv" });
    await userEvent.upload(screen.getByTestId("teacher-import-input"), file);
    await waitFor(() => expect(client.importTeachers).toHaveBeenCalledWith(file, true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã nhập thành công 1 giảng viên từ Excel"));
    expect(toast.warning).toHaveBeenCalledWith("Bỏ qua 1 dòng không import được: Dòng 3: Email chưa đúng định dạng");
    const accounts = await screen.findByTestId("new-accounts-list");
    expect(within(accounts).getByText("GV Import")).toBeInTheDocument();
  });

  it("Đồng bộ CMS: mở modal idle => Bắt đầu => running (nút khoá) => DONE => 'Hoàn tất', thông điệp máy chủ, danh sách tải lại", async () => {
    vi.mocked(client.syncTeachersFromCms).mockResolvedValue({ jobId: "sync-1", status: "PROCESSING" });
    vi.mocked(client.fetchTeacherJobStatus).mockResolvedValueOnce(idleJob).mockResolvedValue(doneJob);
    renderPage();
    await waitForRows();
    await userEvent.click(screen.getByRole("button", { name: /Đồng bộ CMS/ }));
    const modal = dialog();
    expect(within(modal).getByText("Đồng bộ dữ liệu từ CMS")).toBeInTheDocument();
    expect(screen.getByTestId("teacher-sync-content")).toHaveAttribute("data-phase", "idle");
    expect(within(modal).getByText("Hệ thống sẽ lấy dữ liệu giảng viên mới nhất từ CMS.")).toBeInTheDocument();
    await userEvent.click(within(modal).getByRole("button", { name: "Bắt đầu đồng bộ" }));
    await waitFor(() => expect(client.syncTeachersFromCms).toHaveBeenCalledWith(true));
    await waitFor(() => expect(screen.getByTestId("teacher-sync-content")).toHaveAttribute("data-phase", "success"), { timeout: 3000 });
    expect(within(dialog()).getByText(doneJob.message as string)).toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: "Hoàn tất" })).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Đồng bộ CMS thành công", { id: "teacher-sync" });
    await waitFor(() => expect(client.fetchTeachers).toHaveBeenCalledTimes(2));
  }, HEAVY_TIMEOUT);

  it("Tài khoản mới: tải khi mở; FAILED có 'Đổi email & gửi lại' => sửa tại chỗ => Xác nhận gọi PUT {email} + resend rồi tải lại; rỗng => thông điệp 24 giờ", async () => {
    const failed = teacher(7, { fullName: "GV Lỗi mail", email: "loi@example.test", emailStatus: "FAILED", emailStatusReason: "Hộp thư không tồn tại" });
    vi.mocked(client.fetchRecentlyCreatedTeachers).mockResolvedValueOnce([failed]).mockResolvedValue([]);
    vi.mocked(client.updateTeacher).mockResolvedValue({ ...failed, email: "moi@example.test" });
    vi.mocked(client.resendTeacherAccountEmail).mockResolvedValue({ teacher: failed, emailStatus: "SUCCESS" });
    renderPage();
    await waitForRows();
    await userEvent.click(screen.getByRole("button", { name: /Tài khoản mới/ }));
    const list = await screen.findByTestId("new-accounts-list");
    await within(list).findByText("GV Lỗi mail");
    expect(within(list).getByText("✗ Gửi email thất bại")).toBeInTheDocument();
    expect(within(list).getByText("Hộp thư không tồn tại")).toBeInTheDocument();
    await userEvent.click(within(list).getByRole("button", { name: /Đổi email và gửi lại cho GV Lỗi mail/ }));
    const input = within(list).getByLabelText("Email mới cho GV Lỗi mail");
    expect(input).toHaveValue("loi@example.test");
    fill(input, "moi@example.test");
    await userEvent.click(within(list).getByRole("button", { name: "Xác nhận" }));
    await waitFor(() => expect(client.updateTeacher).toHaveBeenCalledWith("gv-7", { email: "moi@example.test" }, true));
    await waitFor(() => expect(client.resendTeacherAccountEmail).toHaveBeenCalledWith("gv-7", true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã cập nhật email và gửi lại thông tin tài khoản."));
    await waitFor(() => expect(client.fetchRecentlyCreatedTeachers).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Không có tài khoản mới trong 24 giờ.")).toBeInTheDocument();
  });

  it("Tài khoản mới: dịch vụ chưa cấu hình => WAITING FOR BACKEND trong modal (không nói 'không có tài khoản mới')", async () => {
    vi.mocked(client.fetchRecentlyCreatedTeachers).mockRejectedValue(new ApiNotConfiguredError());
    renderPage();
    await waitForRows();
    await userEvent.click(screen.getByRole("button", { name: /Tài khoản mới/ }));
    const notice = await screen.findByTestId("new-accounts-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(screen.queryByText("Không có tài khoản mới trong 24 giờ.")).toBeNull();
  });
});
