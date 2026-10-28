import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManageStoragePageContent } from "@/components/management/manage-storage/manage-storage-page-content";
import { ManagementShell } from "@/components/management/management-shell";
import { confirmAction } from "@/components/shared/confirm-action";
import { resetContentAccessCache } from "@/hooks/use-content-access";
import { ApiNotConfiguredError } from "@/lib/api/api-client";
import type { AuthUser } from "@/lib/api/auth-client";
import { createStoragePackage, deleteStorageVideo, listStorageFolders, listStoragePackages, listStorageStudySets, listStorageVideos, setStoragePackagePublished } from "@/lib/api/hsk-storage-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { isStorageApiConfigured } from "@/lib/api/storage-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { StorageFolder, StoragePackage, StorageStudySet, StorageVideo } from "@/types/hsk-storage";
import { adminUser } from "./fixtures/classes";

vi.mock("next/navigation", () => ({ usePathname: () => "/instructor/manage-storage", useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/notification-client", () => ({ getUnreadCount: vi.fn(), fetchNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
vi.mock("@/lib/api/storage-client", () => ({ uploadFile: vi.fn(), fileUrl: vi.fn(() => null), isStorageApiConfigured: vi.fn(() => true) }));
vi.mock("@/lib/api/hsk-storage-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/hsk-storage-client")>()),
  listStoragePackages: vi.fn(),
  listStorageFolders: vi.fn(),
  listStorageStudySets: vi.fn(),
  listStorageVideos: vi.fn(),
  getStorageVideoDetails: vi.fn(),
  createStoragePackage: vi.fn(),
  updateStoragePackage: vi.fn(),
  deleteStoragePackage: vi.fn(),
  setStoragePackagePublished: vi.fn(),
  createStorageFolder: vi.fn(),
  updateStorageFolder: vi.fn(),
  deleteStorageFolder: vi.fn(),
  createStorageStudySet: vi.fn(),
  updateStorageStudySet: vi.fn(),
  deleteStorageStudySet: vi.fn(),
  createStorageVideo: vi.fn(),
  deleteStorageVideo: vi.fn(),
}));
// Quy ước của repo: antd Modal.confirm (tĩnh) được mock qua confirmAction và kiểm tra tham số gọi.
vi.mock("@/components/shared/confirm-action", () => ({ confirmAction: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

const packages: StoragePackage[] = [
  { id: "p1", name: "Gói A", description: "Mô tả A", type: "VIDEO_COURSE", publishStatus: "PUBLISHED", createdAt: "2026-01-01", updatedAt: "2026-01-02" },
  { id: "p2", name: "Gói B", type: "VIDEO_COURSE", publishStatus: "DRAFT", createdAt: "2026-01-01", updatedAt: "2026-01-02" },
];
const folders: StorageFolder[] = [{ id: "f1", name: "Thư mục 1", packageId: "p1", isPrivate: true, createdAt: "2026-01-01", updatedAt: "2026-01-02" }];
const studySets: StorageStudySet[] = [{ id: "s1", name: "Bộ học 1", folderId: "f1", isPrivate: false, createdAt: "2026-01-01", updatedAt: "2026-01-02" }];
const videos: StorageVideo[] = [
  { id: "v1", code: "VC1", name: "Video một", status: "COMPLETED", studySetId: "s1", fileId: "file-v1", createdAt: "2026-02-01T00:00:00Z", updatedAt: "2026-02-01T00:00:00Z" },
  { id: "v2", code: "VC2", name: "Video hai", status: "PROCESSING", studySetId: "s1", createdAt: "2026-02-02T00:00:00Z", updatedAt: "2026-02-02T00:00:00Z" },
];
const teacher: AuthUser = { ...adminUser, id: "t-1", fullName: "Giáo Viên", roles: ["ROLE_TEACHER"] };

beforeEach(() => {
  window.sessionStorage.clear();
  resetContentAccessCache();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.stubEnv("NEXT_PUBLIC_WRITE_STORAGE", "");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(isStorageApiConfigured).mockReturnValue(true);
  vi.mocked(listStoragePackages).mockReset().mockResolvedValue(packages);
  vi.mocked(listStorageFolders).mockReset().mockResolvedValue(folders);
  vi.mocked(listStorageStudySets).mockReset().mockResolvedValue(studySets);
  vi.mocked(listStorageVideos).mockReset().mockResolvedValue(videos);
  for (const fn of [createStoragePackage, setStoragePackagePublished, deleteStorageVideo]) vi.mocked(fn).mockReset();
  vi.mocked(confirmAction).mockReset().mockResolvedValue(true);
  for (const fn of [toast.success, toast.error]) vi.mocked(fn).mockClear();
});

function renderPage(user: AuthUser = adminUser) {
  render(
    <Provider store={makeStore({ status: "authenticated", user })}>
      <ManagementShell area={user.roles.includes("ROLE_ADMIN") ? "admin" : "instructor"}>
        <ManageStoragePageContent />
      </ManagementShell>
    </Provider>,
  );
}

const breadcrumb = () => [...screen.getByTestId("storage-breadcrumb").querySelectorAll(".breadcrumb-item")].map((el) => el.textContent?.replace("/", "").trim());

describe("màn Quản lý kho lưu trữ đa phương tiện", () => {
  it("Admin: lưới gói với huy hiệu Published/Draft, breadcrumb gốc active; công tắc đóng => 'Tạo kho mới' khoá + WriteLockedNotice, không có Alert xem-duy-nhất", async () => {
    renderPage();
    await screen.findByText("Gói A");
    expect(listStoragePackages).toHaveBeenCalledWith("VIDEO_COURSE");
    expect(screen.getAllByTestId("storage-packages-card")).toHaveLength(2);
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("2 bộ sưu tập")).toBeInTheDocument();
    expect(breadcrumb()).toEqual(["Thư viện Media"]);
    expect(screen.getByRole("button", { name: /Tạo kho mới/ })).toBeDisabled();
    expect(screen.getByTestId("write-locked")).toBeInTheDocument();
    expect(screen.queryByTestId("storage-view-only")).toBeNull();
  });

  it("drill-down Gói → Thư mục → Bộ học → Video với breadcrumb; bấm 'Thư viện Media' quay về gói", async () => {
    renderPage();
    await userEvent.click(await screen.findByText("Gói A"));
    await screen.findByText("Thư mục 1");
    expect(listStorageFolders).toHaveBeenCalledWith("p1");
    expect(breadcrumb()).toEqual(["Thư viện Media", "Gói A"]);
    expect(screen.getByText("Riêng tư")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Thư mục 1"));
    await screen.findByText("Bộ học 1");
    expect(listStorageStudySets).toHaveBeenCalledWith("f1");
    await userEvent.click(screen.getByText("Bộ học 1"));
    await screen.findByText("Video một");
    expect(listStorageVideos).toHaveBeenCalledWith("s1");
    expect(breadcrumb()).toEqual(["Thư viện Media", "Gói A", "Thư mục 1", "Bộ học 1"]);
    expect(screen.getAllByTestId("storage-video-card")).toHaveLength(2);
    expect(screen.getByText("Bài 01")).toBeInTheDocument();
    expect(screen.getByText("Sẵn sàng")).toBeInTheDocument();
    expect(screen.getByText("PROCESSING")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Thư viện Media/ }));
    expect(await screen.findByText("Gói B")).toBeInTheDocument();
    expect(breadcrumb()).toEqual(["Thư viện Media"]);
  });

  it("Giảng viên KHÔNG có ticket STORAGE: Alert 'Chế độ Xem duy nhất', không nút tạo/menu thao tác, vẫn xem được danh sách", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_STORAGE", "enabled");
    vi.mocked(getTickets).mockResolvedValue([{ id: "tk", status: "OPEN", assignedId: "t-1", module: "QUIZ" }] as never);
    renderPage(teacher);
    await screen.findByText("Gói A");
    expect(await screen.findByTestId("storage-view-only")).toHaveTextContent("Chế độ Xem duy nhất");
    expect(screen.queryByRole("button", { name: /Tạo kho mới/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Thao tác với/ })).toBeNull();
    expect(screen.queryByTestId("write-locked")).toBeNull();
  });

  it("Giảng viên CÓ ticket STORAGE (OPEN, giao cho mình) + công tắc mở: tạo được, menu có Sửa/Xóa nhưng KHÔNG có Publish", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_STORAGE", "enabled");
    vi.mocked(getTickets).mockResolvedValue([{ id: "tk", status: "OPEN", assignedId: "t-1", module: "STORAGE" }] as never);
    renderPage(teacher);
    await screen.findByText("Gói A");
    await waitFor(() => expect(screen.getByRole("button", { name: /Tạo kho mới/ })).toBeEnabled());
    expect(screen.queryByTestId("storage-view-only")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Thao tác với Gói A" }));
    expect(await screen.findByRole("menuitem", { name: /Sửa/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Xóa/ })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Publish/ })).toBeNull();
  });

  it("Admin + công tắc mở: Unpublish qua menu => confirmAction => POST /packages/{id}/unpublish, toast, tải lại", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_STORAGE", "enabled");
    vi.mocked(setStoragePackagePublished).mockResolvedValue({ ...packages[0], publishStatus: "DRAFT" });
    renderPage();
    await screen.findByText("Gói A");
    await userEvent.click(screen.getByRole("button", { name: "Thao tác với Gói A" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Unpublish/ }));
    await waitFor(() => expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xác nhận Unpublish", content: 'Bạn có chắc muốn chuyển gói "Gói A" về Draft?', okText: "Unpublish", danger: true })));
    await waitFor(() => expect(setStoragePackagePublished).toHaveBeenCalledWith("p1", false, false));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã chuyển gói "Gói A" về Draft'));
    await waitFor(() => expect(listStoragePackages).toHaveBeenCalledTimes(2));
  });

  it("Admin + công tắc mở: 'Tạo kho mới' => modal 'Tạo package mới' => POST /packages {name, description, type}", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_STORAGE", "enabled");
    vi.mocked(createStoragePackage).mockResolvedValue({ ...packages[1], id: "p3", name: "Gói mới" });
    renderPage();
    await screen.findByText("Gói A");
    await userEvent.click(screen.getByRole("button", { name: /Tạo kho mới/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Tạo package mới")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Tạo package" })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Tên package/), "Gói mới");
    await userEvent.click(within(dialog).getByRole("button", { name: "Tạo package" }));
    await waitFor(() => expect(createStoragePackage).toHaveBeenCalledWith({ name: "Gói mới", description: undefined, type: "VIDEO_COURSE" }, false));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã tạo package"));
  });

  it("xóa video: từ chối xác nhận => không gọi; đồng ý => DELETE /videos/{id} + toast + tải lại danh sách video", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_STORAGE", "enabled");
    vi.mocked(deleteStorageVideo).mockResolvedValue(undefined);
    vi.mocked(confirmAction).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    renderPage();
    await userEvent.click(await screen.findByText("Gói A"));
    await userEvent.click(await screen.findByText("Thư mục 1"));
    await userEvent.click(await screen.findByText("Bộ học 1"));
    await screen.findByText("Video một");
    await userEvent.click(screen.getByRole("button", { name: "Xóa video Video một" }));
    await waitFor(() => expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xóa video", okText: "Xóa", danger: true })));
    expect(deleteStorageVideo).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Xóa video Video một" }));
    await waitFor(() => expect(deleteStorageVideo).toHaveBeenCalledWith("v1", false));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã xóa video "Video một"'));
    await waitFor(() => expect(listStorageVideos).toHaveBeenCalledTimes(2));
  });

  it("dịch vụ chưa cấu hình => khối WAITING FOR BACKEND ở mức gói", async () => {
    vi.mocked(listStoragePackages).mockRejectedValueOnce(new ApiNotConfiguredError());
    renderPage();
    expect(await screen.findByTestId("storage-packages-notice")).toHaveAttribute("data-kind", "waiting");
    expect(screen.queryByTestId("storage-packages-empty")).toBeNull();
  });
});
