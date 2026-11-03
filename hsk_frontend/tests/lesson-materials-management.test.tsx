import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LessonMaterialsManagementPageContent } from "@/components/management/lesson-materials-management/lesson-materials-management-page-content";
import { ManagementShell } from "@/components/management/management-shell";
import { ApiNotConfiguredError } from "@/lib/api/api-client";
import { createMaterial, createMaterialGroup, deleteMaterial, deleteMaterialGroup, listGroupMaterials, listMaterialGroups, publishMaterialGroup, unpublishMaterialGroup, updateMaterialGroup } from "@/lib/api/lesson-materials-client";
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
  createMaterialGroup: vi.fn(),
  updateMaterialGroup: vi.fn(),
  publishMaterialGroup: vi.fn(),
  unpublishMaterialGroup: vi.fn(),
  deleteMaterialGroup: vi.fn(),
  createMaterial: vi.fn(),
  deleteMaterial: vi.fn(),
}));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

const group = (id: string, name: string, type: LessonMaterialGroup["type"] = "SLIDE", status: LessonMaterialGroup["status"] = "DRAFT"): LessonMaterialGroup => ({ id, name, type, status, description: `Mô tả ${name}` });
const material = (id: string, over: Partial<LessonMaterial> = {}): LessonMaterial => ({ id, title: `Tài liệu ${id}`, fileId: `f-${id}`, filename: `${id}.pdf`, mimeType: "application/pdf", sizeBytes: 2048, groupId: "g1", displayOrder: 0, ...over });
const groups = [group("g1", "HSK 3", "SLIDE", "DRAFT"), group("g2", "HSK 4", "MATERIAL", "PUBLISHED")];

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(isStorageApiConfigured).mockReset().mockReturnValue(true);
  vi.mocked(fileUrl).mockReset().mockImplementation((id) => (id ? `/api/storage/file/${id}?disposition=inline` : null));
  vi.mocked(uploadFile).mockReset();
  vi.mocked(listMaterialGroups).mockReset().mockResolvedValue(groups);
  vi.mocked(listGroupMaterials).mockReset().mockImplementation(async (id) => [material("s1", { groupId: id }), material("s2", { groupId: id, displayOrder: 1 })]);
  for (const fn of [createMaterialGroup, updateMaterialGroup, publishMaterialGroup, unpublishMaterialGroup, deleteMaterialGroup, createMaterial, deleteMaterial]) vi.mocked(fn).mockReset();
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

describe("màn Quản lý tài liệu học tập — gắn trực tiếp vào ContentPackage/LearningResource (cơ chế Kho)", () => {
  it("cột trái: bộ tài liệu với loại + trạng thái publish; cột phải: placeholder; nút ghi khoá khi công tắc 'content' đóng", async () => {
    renderPage();
    await screen.findByText("HSK 3", { selector: "h6" });
    expect(listMaterialGroups).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId("lm-group-card")).toHaveLength(2);
    expect(groupCard("HSK 3")).toHaveTextContent("Slides");
    expect(within(groupCard("HSK 3")).getByText("Bản nháp")).toHaveClass("draft");
    expect(within(groupCard("HSK 4")).getByText("Đã xuất bản")).toHaveClass("published");
    expect(screen.getByTestId("lm-placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("write-locked")).toBeInTheDocument();
    for (const name of ["Thêm bộ tài liệu", "Thêm nhiều tài liệu", "Thêm tài liệu"]) expect(screen.getByRole("button", { name: new RegExp(name) })).toBeDisabled();
    expect(within(groupCard("HSK 3")).getByRole("button", { name: /Sửa/ })).toBeDisabled();
  });

  it("chọn bộ => GET materials của bộ, bảng đúng cột, liên kết tệp từ repo-storage, xoá tài liệu; tìm bộ", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
    renderPage();
    await screen.findByText("HSK 3", { selector: "h6" });
    await userEvent.click(within(groupCard("HSK 3")).getByRole("button", { name: /HSK 3/ }));
    const table = await screen.findByTestId("lm-table");
    expect(listGroupMaterials).toHaveBeenCalledWith("g1");
    expect([...table.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["Tên tài liệu", "Tệp", "Dung lượng", "Thao tác"]);
    expect(screen.getAllByTestId("lm-material-row")).toHaveLength(2);
    const row = screen.getByText("Tài liệu s1").closest("tr") as HTMLElement;
    expect(within(row).getByRole("link", { name: "s1.pdf" })).toHaveAttribute("href", "/api/storage/file/f-s1?disposition=inline");
    expect(within(row).getByText("2.0 KB")).toBeInTheDocument();
    await userEvent.click(within(row).getByRole("button", { name: /Xoá/ }));
    await waitFor(() => expect(deleteMaterial).toHaveBeenCalledWith("g1", "s1", false));
    await userEvent.type(screen.getByLabelText("Tìm bộ tài liệu"), "hsk 4");
    expect(screen.getAllByTestId("lm-group-card")).toHaveLength(1);
  });

  it("thêm bộ (công tắc mở): trùng tên cùng loại phía client => toast lỗi không gọi API; tên mới => tạo bộ, toast, tải lại", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
    vi.mocked(createMaterialGroup).mockResolvedValue(group("g9", "HSK 6"));
    renderPage();
    await screen.findByText("HSK 3", { selector: "h6" });
    await userEvent.click(screen.getByRole("button", { name: /Thêm bộ tài liệu/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Tên bộ tài liệu"), "hsk 3");
    await userEvent.click(within(dialog).getByRole("button", { name: "Thêm bộ" }));
    expect(toast.error).toHaveBeenCalledWith("Tên bộ tài liệu đã tồn tại (cùng loại). Vui lòng nhập tên khác.");
    expect(createMaterialGroup).not.toHaveBeenCalled();
    await userEvent.clear(within(dialog).getByLabelText("Tên bộ tài liệu"));
    await userEvent.type(within(dialog).getByLabelText("Tên bộ tài liệu"), "HSK 6");
    await userEvent.click(within(dialog).getByRole("button", { name: "Thêm bộ" }));
    await waitFor(() => expect(createMaterialGroup).toHaveBeenCalledWith({ type: "SLIDE", name: "HSK 6", description: undefined }, false));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã thêm bộ tài liệu"));
    await waitFor(() => expect(listMaterialGroups).toHaveBeenCalledTimes(2));
  });

  it("xuất bản / chuyển về nháp bộ tài liệu", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
    renderPage();
    await screen.findByText("HSK 3", { selector: "h6" });
    await userEvent.click(within(groupCard("HSK 3")).getByRole("button", { name: /Xuất bản/ }));
    await waitFor(() => expect(publishMaterialGroup).toHaveBeenCalledWith("g1", false));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã xuất bản bộ tài liệu"));
    await userEvent.click(within(groupCard("HSK 4")).getByRole("button", { name: /Về nháp/ }));
    await waitFor(() => expect(unpublishMaterialGroup).toHaveBeenCalledWith("g2", false));
  });

  it("xoá bộ tài liệu đang xem => về placeholder", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
    renderPage();
    await screen.findByText("HSK 3", { selector: "h6" });
    await userEvent.click(within(groupCard("HSK 3")).getByRole("button", { name: /HSK 3/ }));
    await screen.findByTestId("lm-table");
    await userEvent.click(within(groupCard("HSK 3")).getByRole("button", { name: /Xoá/ }));
    await waitFor(() => expect(deleteMaterialGroup).toHaveBeenCalledWith("g1", false));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã xoá bộ tài liệu"));
    expect(screen.getByTestId("lm-placeholder")).toBeInTheDocument();
  });

  it("thêm tài liệu: tải tệp lên repo-storage (uploadFile) rồi tạo LearningResource trong bộ đã chọn, publishImmediately theo trạng thái bộ", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
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
    await waitFor(() => expect(createMaterial).toHaveBeenCalledWith("g1", "SLIDE", false, { title: "Slide mới", fileId: "file-new", filename: "slide.pdf", mimeType: "application/pdf", sizeBytes: 3 }, false));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã thêm tài liệu học tập"));
  });

  it("repo-storage chưa cấu hình => modal thêm tài liệu báo 'Kho lưu trữ chưa được cấu hình', ô tệp và nút Thêm bị khoá", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
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
    renderPage();
    expect(await screen.findByTestId("lm-notice")).toHaveAttribute("data-kind", "waiting");
    expect(screen.queryByTestId("lm-group-list")).toBeNull();
  });
});
