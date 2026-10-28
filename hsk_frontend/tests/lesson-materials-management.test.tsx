import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LessonMaterialsManagementPageContent } from "@/components/management/lesson-materials-management/lesson-materials-management-page-content";
import { ManagementShell } from "@/components/management/management-shell";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { archiveMaterialGroup, createMaterial, createMaterialGroup, listGroupMaterials, listMaterialGroups, listMaterials, updateMaterialGroup, updateMaterialStatus } from "@/lib/api/lesson-materials-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { fileUrl, isStorageApiConfigured, uploadFile } from "@/lib/api/storage-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { LessonMaterial, LessonMaterialGroup } from "@/types/lesson-materials";
import { adminUser } from "./fixtures/classes";

vi.mock("next/navigation", () => ({ usePathname: () => "/learning-path/lesson-materials/manage", useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/notification-client", () => ({ getUnreadCount: vi.fn(), fetchNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
vi.mock("@/lib/api/storage-client", () => ({ uploadFile: vi.fn(), fileUrl: vi.fn(), isStorageApiConfigured: vi.fn() }));
vi.mock("@/lib/api/lesson-materials-client", () => ({
  listMaterialGroups: vi.fn(),
  listGroupMaterials: vi.fn(),
  listMaterials: vi.fn(),
  createMaterialGroup: vi.fn(),
  updateMaterialGroup: vi.fn(),
  archiveMaterialGroup: vi.fn(),
  createMaterial: vi.fn(),
  bulkCreateMaterials: vi.fn(),
  updateMaterialStatus: vi.fn(),
}));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

const group = (id: string, name: string, status: LessonMaterialGroup["status"] = "ACTIVE"): LessonMaterialGroup => ({ id, name, status, description: `Mô tả ${name}` });
const material = (id: string, over: Partial<LessonMaterial> = {}): LessonMaterial => ({ id, title: `Tài liệu ${id}`, type: "SLIDE", category: "LESSON", status: "DRAFT", fileId: `f-${id}`, filename: `${id}.pdf`, mimeType: "application/pdf", sizeBytes: 2048, groupId: "g1", ...over });
const groups = [group("g1", "HSK 3"), group("g2", "HSK 4"), group("g3", "HSK 2 (cũ)", "ARCHIVED")];
const materials = [material("s1"), material("s2", { status: "PUBLISHED" }), material("gr1", { type: "GRAMMAR", filename: "gr1.png", mimeType: "image/png" }), material("u1", { groupId: null, title: "Chưa phân loại 1" }), material("x1", { groupId: "g2" })];
const page = (content: LessonMaterial[]) => ({ content, totalElements: content.length, totalPages: 1, size: 200, number: 0 });

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.stubEnv("NEXT_PUBLIC_WRITE_LESSON_MATERIALS", "");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(isStorageApiConfigured).mockReset().mockReturnValue(true);
  vi.mocked(fileUrl).mockReset().mockImplementation((id) => (id ? `/api/storage/file/${id}?disposition=inline` : null));
  vi.mocked(uploadFile).mockReset();
  vi.mocked(listMaterialGroups).mockReset().mockResolvedValue(groups);
  vi.mocked(listMaterials).mockReset().mockResolvedValue(page(materials));
  vi.mocked(listGroupMaterials).mockReset().mockImplementation(async (id) => ({ group: groups.find((g) => g.id === id) as LessonMaterialGroup, materialsByType: { GRAMMAR: materials.filter((m) => m.groupId === id && m.type === "GRAMMAR"), SLIDE: materials.filter((m) => m.groupId === id && m.type === "SLIDE") } }));
  for (const fn of [createMaterialGroup, updateMaterialGroup, archiveMaterialGroup, createMaterial, updateMaterialStatus]) vi.mocked(fn).mockReset();
  for (const fn of [toast.success, toast.error, toast.info]) vi.mocked(fn).mockClear();
});

function renderPage() {
  render(
    <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
      <ManagementShell area="admin">
        <LessonMaterialsManagementPageContent />
      </ManagementShell>
    </Provider>,
  );
}

const groupCard = (name: string) => screen.getByText(name, { selector: "h6" }).closest("[data-testid='lm-group-card']") as HTMLElement;

describe("màn Quản lý tài liệu học tập — hai cột", () => {
  it("cột trái: bộ tài liệu với trạng thái + số Slides/Ngữ pháp đếm từ danh sách tổng, ngăn 'Chưa phân loại'; cột phải: placeholder; nút ghi khoá khi công tắc đóng", async () => {
    renderPage();
    await screen.findByText("HSK 3", { selector: "h6" });
    expect(listMaterialGroups).toHaveBeenCalledTimes(1);
    expect(listMaterials).toHaveBeenCalledWith({ size: 200 });
    expect(screen.getAllByTestId("lm-group-card")).toHaveLength(3);
    expect(groupCard("HSK 3")).toHaveTextContent("2 Slides");
    expect(groupCard("HSK 3")).toHaveTextContent("1 Ngữ pháp");
    expect(within(groupCard("HSK 2 (cũ)")).getByText("Đã lưu trữ")).toHaveClass("archived");
    expect(screen.getByTestId("lm-ungrouped-card")).toHaveTextContent("1 Slides");
    expect(screen.getByTestId("lm-placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("write-locked")).toBeInTheDocument();
    for (const name of ["Thêm bộ tài liệu", "Thêm nhiều tài liệu", "Thêm tài liệu"]) expect(screen.getByRole("button", { name: new RegExp(name) })).toBeDisabled();
    expect(within(groupCard("HSK 3")).getByRole("button", { name: /Sửa/ })).toBeDisabled();
  });

  it("chọn bộ => GET /groups/{id}/materials, bảng đúng thứ tự cột, liên kết tệp từ repo-storage, hành động vòng đời theo trạng thái; tab Ngữ pháp lọc; tìm bộ", async () => {
    renderPage();
    await screen.findByText("HSK 3", { selector: "h6" });
    await userEvent.click(within(groupCard("HSK 3")).getByRole("button", { name: /HSK 3/ }));
    const table = await screen.findByTestId("lm-table");
    expect(listGroupMaterials).toHaveBeenCalledWith("g1");
    expect([...table.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["Tên tài liệu", "Danh mục", "Loại", "Tệp", "Dung lượng", "Trạng thái", "Thao tác"]);
    expect(screen.getAllByTestId("lm-material-row")).toHaveLength(3);
    const row = screen.getByText("Tài liệu s1").closest("tr") as HTMLElement;
    expect(within(row).getByRole("link", { name: "s1.pdf" })).toHaveAttribute("href", "/api/storage/file/f-s1?disposition=inline");
    expect(within(row).getByText("2.0 KB")).toBeInTheDocument();
    expect(within(row).getByText("Bản nháp")).toHaveClass("draft");
    expect(within(row).getAllByRole("button").map((b) => b.textContent)).toEqual(["Xuất bản", "Lưu trữ"]);
    const published = screen.getByText("Tài liệu s2").closest("tr") as HTMLElement;
    expect(within(published).getAllByRole("button").map((b) => b.textContent)).toEqual(["Chuyển về nháp", "Lưu trữ"]);
    await userEvent.click(screen.getByRole("tab", { name: "Ngữ pháp" }));
    expect(screen.getAllByTestId("lm-material-row")).toHaveLength(1);
    await userEvent.click(screen.getByRole("tab", { name: "Giáo trình" }));
    expect(screen.getByTestId("lm-detail-empty")).toHaveTextContent("Chưa có tài liệu Giáo trình trong bộ này.");
    await userEvent.type(screen.getByLabelText("Tìm bộ tài liệu"), "hsk 4");
    expect(screen.getAllByTestId("lm-group-card")).toHaveLength(1);
  });

  it("'Chưa phân loại' lấy từ danh sách tổng, không gọi thêm API", async () => {
    renderPage();
    await screen.findByText("HSK 3", { selector: "h6" });
    await userEvent.click(within(screen.getByTestId("lm-ungrouped-card")).getByRole("button"));
    await screen.findByTestId("lm-table");
    expect(screen.getAllByTestId("lm-material-row")).toHaveLength(1);
    expect(screen.getByText("Chưa phân loại 1")).toBeInTheDocument();
    expect(listGroupMaterials).not.toHaveBeenCalled();
  });

  it("thêm bộ (công tắc mở): trùng tên phía client => toast lỗi không gọi API; tên mới => POST /groups, toast, tải lại", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_LESSON_MATERIALS", "enabled");
    vi.mocked(createMaterialGroup).mockResolvedValue(group("g9", "HSK 6"));
    renderPage();
    await screen.findByText("HSK 3", { selector: "h6" });
    await userEvent.click(screen.getByRole("button", { name: /Thêm bộ tài liệu/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Tên bộ tài liệu"), "hsk 2 (CŨ)");
    await userEvent.click(within(dialog).getByRole("button", { name: "Thêm bộ" }));
    expect(toast.error).toHaveBeenCalledWith("Tên bộ tài liệu đã tồn tại trong mục lưu trữ. Vui lòng khôi phục bộ đó hoặc nhập tên khác.");
    expect(createMaterialGroup).not.toHaveBeenCalled();
    await userEvent.clear(within(dialog).getByLabelText("Tên bộ tài liệu"));
    await userEvent.type(within(dialog).getByLabelText("Tên bộ tài liệu"), "HSK 6");
    await userEvent.click(within(dialog).getByRole("button", { name: "Thêm bộ" }));
    await waitFor(() => expect(createMaterialGroup).toHaveBeenCalledWith({ name: "HSK 6", description: undefined }, false));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã thêm bộ tài liệu"));
    await waitFor(() => expect(listMaterialGroups).toHaveBeenCalledTimes(2));
  });

  it("đổi trạng thái tài liệu => PATCH; 409 chuyển trạng thái sai => toast riêng + tải lại", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_LESSON_MATERIALS", "enabled");
    vi.mocked(updateMaterialStatus).mockResolvedValueOnce(material("s1", { status: "PUBLISHED" })).mockRejectedValueOnce(new ApiError("Trạng thái không hợp lệ", 409, "LESSON_MATERIAL_INVALID_STATUS_TRANSITION"));
    renderPage();
    await screen.findByText("HSK 3", { selector: "h6" });
    await userEvent.click(within(groupCard("HSK 3")).getByRole("button", { name: /HSK 3/ }));
    await screen.findByTestId("lm-table");
    const row = () => screen.getByText("Tài liệu s1").closest("tr") as HTMLElement;
    await userEvent.click(within(row()).getByRole("button", { name: /Xuất bản/ }));
    await waitFor(() => expect(updateMaterialStatus).toHaveBeenCalledWith("s1", { status: "PUBLISHED" }, false));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã chuyển tài liệu sang trạng thái Đã xuất bản"));
    await waitFor(() => expect(listGroupMaterials).toHaveBeenCalledTimes(2));
    await screen.findByTestId("lm-table");
    await userEvent.click(within(row()).getByRole("button", { name: /Lưu trữ/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Trạng thái chuyển đổi không còn hợp lệ. Danh sách đã được tải lại."));
  });

  it("thêm tài liệu: tải tệp lên repo-storage (uploadFile) rồi POST /materials với fileId, không gửi byte cho dịch vụ tài liệu", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_LESSON_MATERIALS", "enabled");
    vi.mocked(uploadFile).mockResolvedValue({ fileId: "file-new", filename: "slide.pdf", mimeType: "application/pdf", sizeBytes: 3 });
    vi.mocked(createMaterial).mockResolvedValue(material("new"));
    renderPage();
    await screen.findByText("HSK 3", { selector: "h6" });
    await userEvent.click(within(groupCard("HSK 3")).getByRole("button", { name: /HSK 3/ }));
    await screen.findByTestId("lm-table");
    await userEvent.click(screen.getByRole("button", { name: /^Thêm tài liệu$/ }));
    const dialog = await screen.findByRole("dialog");
    expect((within(dialog).getByLabelText("Bộ tài liệu") as HTMLSelectElement).value).toBe("g1"); // bộ đang xem được chọn sẵn
    await userEvent.type(within(dialog).getByLabelText("Tên tài liệu"), "Slide mới");
    await userEvent.upload(within(dialog).getByLabelText("Tải tệp lên"), new File(["abc"], "slide.pdf", { type: "application/pdf" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Thêm tài liệu" }));
    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(createMaterial).toHaveBeenCalledWith({ title: "Slide mới", description: undefined, category: "LESSON", type: "SLIDE", fileId: "file-new", groupId: "g1" }, false));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã thêm tài liệu học tập"));
  });

  it("repo-storage chưa cấu hình => modal thêm tài liệu báo 'Kho lưu trữ chưa được cấu hình', ô tệp và nút Thêm bị khoá", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_LESSON_MATERIALS", "enabled");
    vi.mocked(isStorageApiConfigured).mockReturnValue(false);
    renderPage();
    await screen.findByText("HSK 3", { selector: "h6" });
    await userEvent.click(screen.getByRole("button", { name: /^Thêm tài liệu$/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("lm-storage-unconfigured")).toHaveTextContent("Kho lưu trữ chưa được cấu hình.");
    expect(within(dialog).getByLabelText("Tải tệp lên")).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Thêm tài liệu" })).toBeDisabled();
  });

  it("dịch vụ chưa cấu hình => WAITING FOR BACKEND thay cho hai cột", async () => {
    vi.mocked(listMaterialGroups).mockRejectedValueOnce(new ApiNotConfiguredError());
    vi.mocked(listMaterials).mockRejectedValueOnce(new ApiNotConfiguredError());
    renderPage();
    expect(await screen.findByTestId("lm-notice")).toHaveAttribute("data-kind", "waiting");
    expect(screen.queryByTestId("lm-group-list")).toBeNull();
  });
});
