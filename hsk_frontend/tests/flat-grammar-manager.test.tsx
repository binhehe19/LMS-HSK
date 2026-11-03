// Test GrammarManagePageContent (FlatContentManager + lms-grammar-client.ts, API thật repo-lms) — mirror tests/flat-content-manager.test.tsx
// (Flashcard) nhưng cho module Ngữ pháp: cấp gói (loại GRAMMAR duy nhất), cấp mục (Điểm ngữ pháp), quyền + công tắc ghi, trạng thái dữ liệu.
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GrammarManagePageContent } from "@/components/management/content-grammar/grammar-manage-page-content";
import { ManagementShell } from "@/components/management/management-shell";
import { confirmAction } from "@/components/shared/confirm-action";
import { resetContentAccessCache } from "@/hooks/use-content-access";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import * as client from "@/lib/api/lms-grammar-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { ManagementArea } from "@/lib/management/area";
import type { ContentPackage } from "@/types/content";
import type { GrammarPoint } from "@/types/content-grammar";
import { adminUser } from "./fixtures/classes";

const nav = vi.hoisted(() => {
  let url = "/grammar/manage";
  const listeners = new Set<() => void>();
  return {
    push: [] as string[],
    set(next: string) {
      url = next;
      listeners.forEach((l) => l());
    },
    get: () => url,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
});
vi.mock("next/navigation", () => ({
  usePathname: () => nav.get().split("?")[0],
  useSearchParams: () => {
    const search = useSyncExternalStore(nav.subscribe, nav.get, nav.get);
    return new URLSearchParams(search.split("?")[1] ?? "");
  },
  useRouter: () => ({
    push: (to: string) => {
      nav.push.push(to);
      nav.set(to);
    },
    replace: (to: string) => nav.set(to),
    back: vi.fn(),
  }),
}));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/notification-client", () => ({ getUnreadCount: vi.fn(), fetchNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
vi.mock("@/components/shared/confirm-action", () => ({ confirmAction: vi.fn() }));
vi.mock("@/lib/api/lms-grammar-client", () => ({
  listGrammarPackages: vi.fn(),
  createGrammarPackage: vi.fn(),
  updateGrammarPackage: vi.fn(),
  deleteGrammarPackage: vi.fn(),
  publishGrammarPackage: vi.fn(),
  unpublishGrammarPackage: vi.fn(),
  listPackageGrammarPoints: vi.fn(),
  createGrammarItem: vi.fn(),
  updateGrammarItem: vi.fn(),
  deleteGrammarItem: vi.fn(),
}));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

vi.setConfig({ testTimeout: 30_000 });

const teacher = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "gv1@example.test", roles: ["ROLE_TEACHER"] };
const pkg = (i: number, over: Partial<ContentPackage> = {}): ContentPackage => ({ id: `p${i}`, name: `Gói ${i}`, type: "GRAMMAR", publishStatus: "DRAFT", description: `Mô tả ${i}`, createdAt: "2026-03-05T08:30:00Z", ...over });
const point = (i: number, over: Partial<GrammarPoint> = {}): GrammarPoint => ({ id: `g${i}`, studySetId: "", index: i - 1, title: `Điểm ${i}`, category: "Câu trần thuật", structure: `A${i} + 是 + B`, explanation: `Giải thích ${i}`, ...over });

beforeEach(() => {
  resetContentAccessCache();
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(confirmAction).mockReset().mockResolvedValue(true);
  for (const fn of Object.values(client)) if (typeof fn === "function" && "mockReset" in fn) vi.mocked(fn as unknown as ReturnType<typeof vi.fn>).mockReset();
  vi.mocked(client.listGrammarPackages).mockResolvedValue([pkg(1), pkg(2, { publishStatus: "PUBLISHED" })]);
  vi.mocked(client.listPackageGrammarPoints).mockResolvedValue([point(2), point(1)]);
  vi.mocked(client.createGrammarPackage).mockResolvedValue(pkg(9));
  vi.mocked(client.deleteGrammarPackage).mockResolvedValue(undefined);
  vi.mocked(client.publishGrammarPackage).mockResolvedValue(undefined);
  vi.mocked(client.unpublishGrammarPackage).mockResolvedValue(undefined);
  vi.mocked(client.createGrammarItem).mockResolvedValue(point(3));
  vi.mocked(client.updateGrammarItem).mockResolvedValue(point(1));
  vi.mocked(client.deleteGrammarItem).mockResolvedValue(undefined);
  for (const fn of [toast.success, toast.error, toast.info]) vi.mocked(fn).mockClear();
  nav.push.length = 0;
  nav.set("/grammar/manage");
});

function renderPage(user = adminUser, area: ManagementArea = "admin") {
  render(
    <Provider store={makeStore({ status: "authenticated", user })}>
      <ManagementShell area={area}>
        <GrammarManagePageContent />
      </ManagementShell>
    </Provider>,
  );
}

const packageRows = () => screen.getAllByTestId("content-package-row");
const modalOk = (modal: HTMLElement, name: RegExp | string) => within(modal).getByRole("button", { name });
const antModal = () => document.querySelector(".ant-modal") as HTMLElement;

describe("cấp gói (Admin)", () => {
  it("tải gói qua listGrammarPackages; huy hiệu Published/Draft; chỉ 1 loại Ngữ pháp", async () => {
    renderPage();
    await screen.findByText("Gói 1");
    expect(client.listGrammarPackages).toHaveBeenCalledWith();
    expect(packageRows()).toHaveLength(2);
    expect(within(packageRows()[0]).getByTestId("content-package-status")).toHaveTextContent("Draft");
    expect(within(packageRows()[1]).getByTestId("content-package-status")).toHaveTextContent("Published");
    expect(screen.getByRole("button", { name: "Tạo package" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 5, name: /Quản lý Ngữ pháp/ })).toBeInTheDocument();
    expect(screen.queryByTestId("flat-content-missing")).toBeNull();
  });

  it("Admin có nút Publish/Unpublish: xác nhận rồi gọi đúng hàm (packageId, demo), toast, tải lại danh sách", async () => {
    renderPage();
    await screen.findByText("Gói 1");
    await userEvent.click(screen.getByRole("button", { name: "Publish Gói 1" }));
    await waitFor(() => expect(client.publishGrammarPackage).toHaveBeenCalledWith("p1", false));
    expect(toast.success).toHaveBeenCalledWith('Package "Gói 1" đã được publish');
  });

  it("xoá gói: huỷ => không gọi API; đồng ý => deleteGrammarPackage + toast", async () => {
    vi.mocked(confirmAction).mockResolvedValueOnce(false);
    renderPage();
    await screen.findByText("Gói 1");
    await userEvent.click(screen.getByRole("button", { name: "Xóa Gói 1" }));
    expect(client.deleteGrammarPackage).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Xóa Gói 1" }));
    await waitFor(() => expect(client.deleteGrammarPackage).toHaveBeenCalledWith("p1", false));
    expect(toast.success).toHaveBeenCalledWith('Package "Gói 1" đã xóa thành công!');
  });

  it("tạo gói qua modal: thiếu tên => toast lỗi; đủ => createGrammarPackage, đóng modal, tải lại", async () => {
    renderPage();
    await screen.findByText("Gói 1");
    await userEvent.click(screen.getByRole("button", { name: "Tạo package" }));
    const modal = antModal();
    expect(within(modal).getByLabelText("Loại Package")).toHaveValue("GRAMMAR");
    await userEvent.click(modalOk(modal, "Tạo Package"));
    expect(toast.error).toHaveBeenCalledWith("Vui lòng nhập tên package");
    expect(client.createGrammarPackage).not.toHaveBeenCalled();
    await userEvent.type(within(modal).getByLabelText("Tên Package"), "  Ngữ pháp HSK 4  ");
    await userEvent.click(modalOk(modal, "Tạo Package"));
    await waitFor(() => expect(client.createGrammarPackage).toHaveBeenCalledWith({ name: "Ngữ pháp HSK 4", type: "GRAMMAR", description: undefined }, false));
    await waitFor(() => expect(document.querySelector(".ant-modal")).toBeNull());
  });
});

describe("cấp mục qua URL (?packageId=, không Folder/StudySet)", () => {
  it("bấm gói => push ?packageId; tải mục qua listPackageGrammarPoints; breadcrumb về cấp gói", async () => {
    renderPage();
    await userEvent.click(await screen.findByText("Gói 1"));
    expect(nav.push.at(-1)).toBe("/grammar/manage?packageId=p1");
    await screen.findAllByText("Điểm 1");
    expect(client.listPackageGrammarPoints).toHaveBeenCalledWith("p1");
    expect(screen.getAllByText("Gói 1").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: /Quản lý Ngữ pháp/ }));
    expect(nav.push.at(-1)).toBe("/grammar/manage");
  });

  it("vào thẳng URL có packageId (reload) => hiện cấp mục; packageId không tồn tại => khối 'Không tìm thấy'", async () => {
    nav.set("/grammar/manage?packageId=p1");
    renderPage();
    await screen.findAllByText("Điểm 1");
    expect(client.listPackageGrammarPoints).toHaveBeenCalledWith("p1");
    act(() => nav.set("/grammar/manage?packageId=khong-co"));
    const missing = await screen.findByTestId("flat-content-missing");
    await userEvent.click(within(missing).getByRole("button", { name: "Quay lại" }));
    expect(nav.push.at(-1)).toBe("/grammar/manage");
  });

  it("'Thêm điểm ngữ pháp' => modal form; thiếu trường bắt buộc => toast lỗi; đủ => createGrammarItem(packageId, input chuẩn hoá + index cuối, demo)", async () => {
    nav.set("/grammar/manage?packageId=p1");
    renderPage();
    await screen.findAllByText("Điểm 1");
    await userEvent.click(screen.getByRole("button", { name: "Thêm điểm ngữ pháp" }));
    const modal = antModal();
    expect(within(modal).getByTestId("grammar-point-form")).toBeInTheDocument();
    await userEvent.click(modalOk(modal, "Thêm điểm ngữ pháp"));
    expect(toast.error).toHaveBeenCalledWith("Vui lòng nhập tên điểm ngữ pháp");
    await userEvent.type(within(modal).getByLabelText(/Điểm ngữ pháp/), "Câu với 把");
    await userEvent.type(within(modal).getByLabelText(/Phân loại/), "Câu xử trí");
    await userEvent.type(within(modal).getByLabelText(/Cấu trúc/), "A + 把 + B + V");
    await userEvent.type(within(modal).getByLabelText(/Giải thích/), "Dùng để nhấn mạnh...");
    await userEvent.click(modalOk(modal, "Thêm điểm ngữ pháp"));
    await waitFor(() =>
      expect(client.createGrammarItem).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ title: "Câu với 把", category: "Câu xử trí", structure: "A + 把 + B + V", explanation: "Dùng để nhấn mạnh...", index: 2 }),
        false,
      ),
    );
    expect(toast.success).toHaveBeenCalledWith("Đã thêm điểm ngữ pháp mới");
  });

  it("'Chỉnh sửa' một điểm => updateGrammarItem(packageId, id, input, demo); 'Xóa' => deleteGrammarItem + toast", async () => {
    nav.set("/grammar/manage?packageId=p1");
    renderPage();
    await screen.findAllByText("Điểm 1");
    await userEvent.click(screen.getByRole("button", { name: "Chỉnh sửa Điểm 1" }));
    const modal = antModal();
    await userEvent.clear(within(modal).getByLabelText(/Giải thích/));
    await userEvent.type(within(modal).getByLabelText(/Giải thích/), "Giải thích mới");
    await userEvent.click(modalOk(modal, "Lưu thay đổi"));
    await waitFor(() => expect(client.updateGrammarItem).toHaveBeenCalledWith("p1", "g1", expect.objectContaining({ title: "Điểm 1", explanation: "Giải thích mới" }), false));
    expect(toast.success).toHaveBeenCalledWith("Cập nhật điểm ngữ pháp thành công!");
    await userEvent.click(screen.getByRole("button", { name: "Xóa Điểm 2" }));
    await waitFor(() => expect(client.deleteGrammarItem).toHaveBeenCalledWith("p1", "g2", false));
    expect(toast.success).toHaveBeenCalledWith('Đã xóa điểm ngữ pháp "Điểm 2"');
  });
});

describe("quyền theo ticket + công tắc ghi", () => {
  it("giảng viên KHÔNG có ticket GRAMMAR: Alert 'Chế độ Xem duy nhất', vẫn thấy gói, không nút ghi/publish", async () => {
    vi.mocked(getTickets).mockResolvedValue([{ id: "t1", status: "OPEN", assignedId: "u-teacher-1", module: "QUIZ" }] as never);
    renderPage(teacher, "instructor");
    await screen.findByText("Gói 1");
    expect(await screen.findByTestId("flat-content-readonly-alert")).toHaveTextContent("Chế độ Xem duy nhất");
    expect(screen.queryByRole("button", { name: "Tạo package" })).toBeNull();
  });

  it("công tắc ghi ĐÓNG (Admin): WriteLockedNotice, không nút ghi", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "");
    renderPage();
    await screen.findByText("Gói 1");
    expect(screen.getByTestId("write-locked")).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.queryByRole("button", { name: "Tạo package" })).toBeNull();
  });
});

describe("trạng thái dữ liệu", () => {
  it("dịch vụ chưa cấu hình => WAITING FOR BACKEND trong vùng danh sách, không toast", async () => {
    vi.mocked(client.listGrammarPackages).mockRejectedValue(new ApiNotConfiguredError());
    renderPage();
    const notice = await screen.findByTestId("content-packages-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("lỗi API => khối lỗi + 'Thử lại' tải lại", async () => {
    vi.mocked(client.listGrammarPackages).mockRejectedValueOnce(new ApiError("Máy chủ lỗi", 500)).mockResolvedValue([pkg(1)]);
    renderPage();
    const notice = await screen.findByTestId("content-packages-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    await userEvent.click(within(notice).getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Gói 1")).toBeInTheDocument();
  });

  it("cấp mục rỗng thật => 'Chưa có điểm ngữ pháp nào'", async () => {
    vi.mocked(client.listPackageGrammarPoints).mockResolvedValueOnce([]);
    nav.set("/grammar/manage?packageId=p1");
    renderPage();
    expect(await screen.findByTestId("flat-content-items-empty")).toHaveTextContent("Chưa có điểm ngữ pháp nào");
  });
});
