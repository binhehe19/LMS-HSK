import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FlashcardManagePageContent } from "@/components/management/content-flashcard/flashcard-manage-page-content";
import { VocabSetManagePageContent } from "@/components/management/content-flashcard/vocab-set-manage-page-content";
import { ManagementShell } from "@/components/management/management-shell";
import { confirmAction } from "@/components/shared/confirm-action";
import { resetContentAccessCache } from "@/hooks/use-content-access";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import * as client from "@/lib/api/content-tree-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { ManagementArea } from "@/lib/management/area";
import type { ContentFolder, ContentPackage, ContentStudySet } from "@/types/content";
import type { FlashcardCard } from "@/types/content-flashcard";
import { adminUser } from "./fixtures/classes";

// Router giả CÓ trạng thái: push/replace đổi URL và báo cho useSearchParams (vị trí cây nằm trong URL).
const nav = vi.hoisted(() => {
  let url = "/flashcard/create-package";
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
vi.mock("@/lib/api/content-tree-client", () => ({
  listPackages: vi.fn(),
  getPackage: vi.fn(),
  createPackage: vi.fn(),
  updatePackage: vi.fn(),
  deletePackage: vi.fn(),
  publishPackage: vi.fn(),
  unpublishPackage: vi.fn(),
  listFolders: vi.fn(),
  getFolder: vi.fn(),
  createFolder: vi.fn(),
  updateFolder: vi.fn(),
  deleteFolder: vi.fn(),
  listStudySets: vi.fn(),
  getStudySet: vi.fn(),
  createStudySet: vi.fn(),
  updateStudySet: vi.fn(),
  deleteStudySet: vi.fn(),
  listItems: vi.fn(),
  createItem: vi.fn(),
  createItemsBulk: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  searchItems: vi.fn(),
}));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

// Màn có sidebar + antd Table/Modal trong jsdom chạy chậm; các ca điều hướng nhiều bước cần hơn 5 giây mặc định.
vi.setConfig({ testTimeout: 30_000 });

const TARGET = { apiPrefix: "/flashcard", itemsPath: "cards" };
const teacher = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "gv1@example.test", roles: ["ROLE_TEACHER"] };
const pkg = (i: number, over: Partial<ContentPackage> = {}): ContentPackage => ({ id: `p${i}`, name: `Gói ${i}`, type: "LEARNING_PATH", publishStatus: "DRAFT", description: `Mô tả ${i}`, createdAt: "2026-03-05T08:30:00Z", folderCount: 2, ...over });
const folder = (i: number, over: Partial<ContentFolder> = {}): ContentFolder => ({ id: `f${i}`, packageId: "p1", name: `Thư mục ${i}`, description: "", studySetCount: 1, ...over });
const set = (i: number, over: Partial<ContentStudySet> = {}): ContentStudySet => ({ id: `s${i}`, folderId: "f1", title: `Bộ ${i}`, description: "", itemCount: 2, ...over });
const card = (i: number, over: Partial<FlashcardCard> = {}): FlashcardCard => ({ id: `c${i}`, studySetId: "s1", index: i - 1, term: `词${i}`, pinyin: `ci${i}`, meaning: `nghĩa ${i}`, ...over });
const searchPage = (items: FlashcardCard[]) => ({ items: items.map((c) => ({ ...c, packageName: "Gói 1", folderName: "Thư mục 1", studySetTitle: "Bộ 1" })), totalElements: items.length, totalPages: 1, page: 0, size: 20 });

beforeEach(() => {
  resetContentAccessCache();
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(confirmAction).mockReset().mockResolvedValue(true);
  for (const fn of Object.values(client)) if (typeof fn === "function" && "mockReset" in fn) vi.mocked(fn as unknown as ReturnType<typeof vi.fn>).mockReset();
  vi.mocked(client.listPackages).mockResolvedValue([pkg(1), pkg(2, { type: "FREE", publishStatus: "PUBLISHED" }), pkg(3, { type: "FREE" })]);
  vi.mocked(client.listFolders).mockResolvedValue([folder(1), folder(2)]);
  vi.mocked(client.listStudySets).mockResolvedValue([set(1)]);
  vi.mocked(client.listItems).mockResolvedValue([card(2), card(1)]);
  vi.mocked(client.searchItems).mockResolvedValue(searchPage([card(1)]));
  vi.mocked(client.createPackage).mockResolvedValue(pkg(9));
  vi.mocked(client.deletePackage).mockResolvedValue({});
  vi.mocked(client.publishPackage).mockResolvedValue(pkg(1, { publishStatus: "PUBLISHED" }));
  vi.mocked(client.unpublishPackage).mockResolvedValue(pkg(2));
  vi.mocked(client.createItem).mockResolvedValue(card(3));
  vi.mocked(client.updateItem).mockResolvedValue(card(1));
  for (const fn of [toast.success, toast.error, toast.info]) vi.mocked(fn).mockClear();
  nav.push.length = 0;
  nav.set("/flashcard/create-package");
});

function renderPage(user = adminUser, area: ManagementArea = "admin", Content = FlashcardManagePageContent) {
  render(
    <Provider store={makeStore({ status: "authenticated", user })}>
      <ManagementShell area={area}>
        <Content />
      </ManagementShell>
    </Provider>,
  );
}

const packageRows = () => screen.getAllByTestId("content-package-row");
const crumbLabels = () => [...screen.getByTestId("content-breadcrumb").querySelectorAll("li")].map((li) => li.textContent?.trim());
const modalOk = (modal: HTMLElement, name: RegExp | string) => within(modal).getByRole("button", { name });
const antModal = () => document.querySelector(".ant-modal") as HTMLElement;

describe("cấp gói (Admin)", () => {
  it("tải gói với target của config; dòng gói có huy hiệu loại + Published/Draft; tab loại đếm đúng; khung DOM cũ; breadcrumb 'Packages' active", async () => {
    renderPage();
    await screen.findByText("Gói 1");
    expect(client.listPackages).toHaveBeenCalledWith(TARGET);
    expect(packageRows()).toHaveLength(3);
    expect(within(packageRows()[1]).getByTestId("content-package-status")).toHaveTextContent("Published");
    expect(within(packageRows()[0]).getByTestId("content-package-status")).toHaveTextContent("Draft");
    expect(screen.getByRole("button", { name: /Tất Cả \(3\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Học miễn phí \(2\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo package" })).toBeInTheDocument();
    expect(document.querySelector(".content.manage-flashcard-page .card.manage-lp-container .manage-lp-header")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 5, name: /Quản lý Flashcards/ })).toBeInTheDocument();
    expect(crumbLabels()).toEqual(["Packages"]);
    expect(screen.queryByTestId("content-readonly-alert")).toBeNull();
    expect(screen.queryByTestId("write-locked")).toBeNull();
  });

  it("tab loại lọc danh sách; tìm kiếm theo tên/mô tả; rỗng => 'Không tìm thấy gói' + nút tạo theo loại", async () => {
    renderPage();
    await screen.findByText("Gói 1");
    await userEvent.click(screen.getByRole("button", { name: /Học miễn phí \(2\)/ }));
    expect(packageRows()).toHaveLength(2);
    await userEvent.type(screen.getByPlaceholderText("Tìm kiếm gói..."), "mô tả 3");
    expect(packageRows()).toHaveLength(1);
    expect(screen.getByText("Gói 3")).toBeInTheDocument();
    await userEvent.clear(screen.getByPlaceholderText("Tìm kiếm gói..."));
    await userEvent.type(screen.getByPlaceholderText("Tìm kiếm gói..."), "không có");
    expect(screen.getByTestId("content-packages-empty")).toHaveTextContent("Thử tìm kiếm với từ khóa khác");
  });

  it("Admin có nút Publish/Unpublish: xác nhận rồi gọi đúng hàm, toast như bản cũ, tải lại danh sách", async () => {
    renderPage();
    await screen.findByText("Gói 1");
    await userEvent.click(screen.getByRole("button", { name: "Publish Gói 1" }));
    await waitFor(() => expect(client.publishPackage).toHaveBeenCalledWith(TARGET, "p1", false));
    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xác nhận Publish", okText: "Publish" }));
    expect(toast.success).toHaveBeenCalledWith('Package "Gói 1" đã được publish');
    await userEvent.click(screen.getByRole("button", { name: "Unpublish Gói 2" }));
    await waitFor(() => expect(client.unpublishPackage).toHaveBeenCalledWith(TARGET, "p2", false));
    expect(toast.success).toHaveBeenCalledWith('Package "Gói 2" đã chuyển về Draft');
    expect(vi.mocked(client.listPackages).mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("xoá gói: hộp xác nhận nói rõ xoá đệ quy; huỷ => không gọi API; đồng ý => deletePackage + toast", async () => {
    vi.mocked(confirmAction).mockResolvedValueOnce(false);
    renderPage();
    await screen.findByText("Gói 1");
    await userEvent.click(screen.getByRole("button", { name: "Xóa Gói 1" }));
    await waitFor(() => expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xóa Package", danger: true })));
    expect(client.deletePackage).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Xóa Gói 1" }));
    await waitFor(() => expect(client.deletePackage).toHaveBeenCalledWith(TARGET, "p1", false));
    expect(toast.success).toHaveBeenCalledWith('Package "Gói 1" đã xóa thành công!');
  });

  it("tạo gói qua modal: thiếu tên => toast lỗi không gọi API; đủ => createPackage với body chuẩn hoá, loại cố định theo tab, đóng modal, tải lại", async () => {
    renderPage();
    await screen.findByText("Gói 1");
    await userEvent.click(screen.getByRole("button", { name: /Học miễn phí \(2\)/ }));
    await userEvent.click(screen.getByRole("button", { name: "Tạo package" }));
    const modal = antModal();
    expect(within(modal).getByLabelText("Loại Package")).toHaveValue("LEARNING_PATH"); // nút chung không khoá loại
    await userEvent.click(modalOk(modal, "Tạo Package"));
    expect(toast.error).toHaveBeenCalledWith("Vui lòng điền đầy đủ các trường bắt buộc");
    expect(client.createPackage).not.toHaveBeenCalled();
    await userEvent.type(within(modal).getByLabelText("Tên Package"), "  HSK 4  ");
    await userEvent.selectOptions(within(modal).getByLabelText("Loại Package"), "FREE");
    await userEvent.click(modalOk(modal, "Tạo Package"));
    await waitFor(() => expect(client.createPackage).toHaveBeenCalledWith(TARGET, { name: "HSK 4", type: "FREE", description: undefined }, false));
    expect(toast.success).toHaveBeenCalledWith("Tạo package thành công!");
    await waitFor(() => expect(document.querySelector(".ant-modal")).toBeNull());
    expect(client.listPackages).toHaveBeenCalledTimes(2);
  });
});

describe("điều hướng cây qua URL", () => {
  it("bấm gói => push ?packageId; thư mục => +folderId; bộ => +studySetId; breadcrumb đủ tên; 'Quay lại' về cấp bộ", async () => {
    renderPage();
    await userEvent.click(await screen.findByText("Gói 1"));
    expect(nav.push.at(-1)).toBe("/flashcard/create-package?packageId=p1");
    await screen.findByText("Thư mục 1");
    expect(client.listFolders).toHaveBeenCalledWith(TARGET, "p1");
    expect(crumbLabels()).toEqual(["Packages", "Gói 1"]);
    await userEvent.click(screen.getByText("Thư mục 1"));
    expect(nav.push.at(-1)).toBe("/flashcard/create-package?packageId=p1&folderId=f1");
    await screen.findByText("Bộ 1");
    expect(client.listStudySets).toHaveBeenCalledWith(TARGET, "f1");
    expect(screen.getByRole("link", { name: /Tạo kèm thẻ/ })).toHaveAttribute("href", `/sets/create?packageId=p1&folderId=f1&returnUrl=${encodeURIComponent("/flashcard/create-package?packageId=p1&folderId=f1")}`);
    await userEvent.click(screen.getByText("Bộ 1"));
    expect(nav.push.at(-1)).toBe("/flashcard/create-package?packageId=p1&folderId=f1&studySetId=s1");
    await screen.findAllByText("词1"); // bảng + thẻ lật xem nhanh
    expect(client.listItems).toHaveBeenCalledWith(TARGET, "s1");
    expect(screen.getByTestId("flashcard-preview")).toBeInTheDocument();
    expect(crumbLabels()).toEqual(["Packages", "Gói 1", "Thư mục 1", "Bộ 1"]);
    expect(screen.getByTestId("content-items-count")).toHaveTextContent("2");
    // sắp theo index: 词1 (index 0) trước 词2
    const rows = document.querySelectorAll(".ant-table-tbody tr.ant-table-row");
    expect(rows[0]).toHaveTextContent("词1");
    expect(screen.getByRole("link", { name: /Chỉnh sửa bộ học/ })).toHaveAttribute("href", expect.stringContaining("/sets/s1/edit?returnUrl="));
    await userEvent.click(screen.getByRole("button", { name: /Quay lại/ }));
    expect(nav.push.at(-1)).toBe("/flashcard/create-package?packageId=p1&folderId=f1");
    // breadcrumb cũng điều hướng
    await screen.findByText("Bộ 1");
    await userEvent.click(within(screen.getByTestId("content-breadcrumb")).getByRole("button", { name: /Packages/ }));
    expect(nav.push.at(-1)).toBe("/flashcard/create-package");
  }, 60_000); // 4 cấp cây antd + bảng trong jsdom: chạy cả bộ song song từng vượt 30s mặc định

  it("vào thẳng URL có đủ 3 id (reload) => hiện cấp mục, tải 4 danh sách; id gói không tồn tại => khối 'Không tìm thấy' + Quay lại về gốc", async () => {
    nav.set("/flashcard/create-package?packageId=p1&folderId=f1&studySetId=s1");
    renderPage();
    await screen.findAllByText("词1");
    expect(client.listPackages).toHaveBeenCalledTimes(1);
    expect(client.listFolders).toHaveBeenCalledWith(TARGET, "p1");
    expect(client.listStudySets).toHaveBeenCalledWith(TARGET, "f1");
    expect(client.listItems).toHaveBeenCalledWith(TARGET, "s1");
    act(() => nav.set("/flashcard/create-package?packageId=khong-co"));
    const missing = await screen.findByTestId("content-missing");
    expect(missing).toHaveAttribute("data-kind", "package");
    await userEvent.click(within(missing).getByRole("button", { name: "Quay lại" }));
    expect(nav.push.at(-1)).toBe("/flashcard/create-package");
  });

  it("cấp mục: 'Thêm thẻ' => modal form thẻ; thiếu nghĩa => toast lỗi; đủ => createItem(studySetId, input chuẩn hoá + index cuối) và tải lại", async () => {
    nav.set("/flashcard/create-package?packageId=p1&folderId=f1&studySetId=s1");
    renderPage();
    await screen.findAllByText("词1");
    await userEvent.click(screen.getByRole("button", { name: "Thêm thẻ" }));
    const modal = antModal();
    expect(within(modal).getByTestId("flashcard-card-form")).toBeInTheDocument();
    expect(within(modal).getAllByTestId("storage-not-configured")).toHaveLength(2); // kho lưu trữ chưa cấu hình trong test
    await userEvent.type(within(modal).getByLabelText(/Chữ Hán/), "你好");
    await userEvent.click(modalOk(modal, "Thêm thẻ"));
    expect(toast.error).toHaveBeenCalledWith("Vui lòng nhập nghĩa tiếng Việt");
    await userEvent.type(within(modal).getByLabelText(/Nghĩa tiếng Việt/), " xin chào ");
    await userEvent.type(within(modal).getByLabelText("Pinyin"), "nǐ hǎo");
    await userEvent.click(modalOk(modal, "Thêm thẻ"));
    await waitFor(() => expect(client.createItem).toHaveBeenCalledWith(TARGET, "s1", expect.objectContaining({ term: "你好", meaning: "xin chào", pinyin: "nǐ hǎo", wordType: undefined, index: 2 }), false));
    expect(toast.success).toHaveBeenCalledWith("Đã thêm thẻ mới");
    await waitFor(() => expect(client.listItems).toHaveBeenCalledTimes(2));
  });

  it("tab 'Quản lý từ vựng': push ?view=search, tìm toàn cây (q rỗng trước), gõ từ khoá => gọi lại với q sau 300ms; sửa nhanh gọi updateItem", async () => {
    renderPage();
    await screen.findByText("Gói 1");
    await userEvent.click(screen.getByRole("tab", { name: /Quản lý từ vựng/ }));
    expect(nav.push.at(-1)).toBe("/flashcard/create-package?view=search");
    await screen.findByTestId("content-search-row");
    expect(client.searchItems).toHaveBeenCalledWith(TARGET, "", 0, 20);
    expect(screen.getByText("Gói 1", { selector: "span.fw-600" })).toBeInTheDocument(); // cột Vị trí
    expect(screen.queryByTestId("content-breadcrumb")).toBeNull();
    await userEvent.type(screen.getByPlaceholderText(/Tìm theo chữ Hán/), "词");
    await waitFor(() => expect(client.searchItems).toHaveBeenLastCalledWith(TARGET, "词", 0, 20));
    await userEvent.click(screen.getByRole("button", { name: "Chỉnh sửa 词1" }));
    const modal = antModal();
    await userEvent.clear(within(modal).getByLabelText(/Nghĩa tiếng Việt/));
    await userEvent.type(within(modal).getByLabelText(/Nghĩa tiếng Việt/), "nghĩa mới");
    await userEvent.click(modalOk(modal, "Lưu thay đổi"));
    await waitFor(() => expect(client.updateItem).toHaveBeenCalledWith(TARGET, "c1", expect.objectContaining({ term: "词1", meaning: "nghĩa mới", index: 0 }), false));
    expect(toast.success).toHaveBeenCalledWith("Cập nhật thẻ thành công!");
  });
});

describe("quyền theo ticket + công tắc ghi", () => {
  it("giảng viên KHÔNG có ticket FLASHCARD: Alert 'Chế độ Xem duy nhất', vẫn thấy gói, không nút ghi/publish", async () => {
    vi.mocked(getTickets).mockResolvedValue([{ id: "t1", status: "OPEN", assignedId: "u-teacher-1", module: "QUIZ" }] as never);
    renderPage(teacher, "instructor");
    await screen.findByText("Gói 1");
    expect(await screen.findByTestId("content-readonly-alert")).toHaveTextContent("Chế độ Xem duy nhất");
    expect(screen.queryByRole("button", { name: "Tạo package" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Publish Gói/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xóa Gói 1" })).toBeNull();
  });

  it("giảng viên có ticket FLASHCARD OPEN: không Alert, có Thêm/Sửa/Xoá nhưng KHÔNG có Publish; dịch vụ ticket lỗi => chỉ xem (fail-closed)", async () => {
    vi.mocked(getTickets).mockResolvedValue([{ id: "t3", status: "DONE", assignedId: "u-teacher-1", module: "FLASHCARD" }] as never);
    renderPage(teacher, "instructor");
    await screen.findByText("Gói 1");
    expect(await screen.findByRole("button", { name: "Tạo package" })).toBeInTheDocument();
    expect(screen.queryByTestId("content-readonly-alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Xóa Gói 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Publish Gói/ })).toBeNull();
  });

  it("dịch vụ ticket lỗi => giảng viên chỉ xem", async () => {
    vi.mocked(getTickets).mockRejectedValue(new ApiError("down", 500));
    renderPage(teacher, "instructor");
    await screen.findByText("Gói 1");
    expect(await screen.findByTestId("content-readonly-alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo package" })).toBeNull();
  });

  it("công tắc ghi ĐÓNG (Admin): WriteLockedNotice, không nút ghi, không Alert ticket", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "");
    renderPage();
    await screen.findByText("Gói 1");
    expect(screen.getByTestId("write-locked")).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.queryByRole("button", { name: "Tạo package" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Publish Gói/ })).toBeNull();
    expect(screen.queryByTestId("content-readonly-alert")).toBeNull();
  });
});

describe("trạng thái dữ liệu", () => {
  it("dịch vụ chưa cấu hình => WAITING FOR BACKEND trong vùng danh sách, không toast, không 'Không tìm thấy gói'", async () => {
    vi.mocked(client.listPackages).mockRejectedValue(new ApiNotConfiguredError());
    renderPage();
    const notice = await screen.findByTestId("content-packages-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(notice).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.queryByTestId("content-packages-empty")).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("lỗi API => khối lỗi + 'Thử lại' tải lại; phản hồi không phải mảng => lỗi hợp đồng", async () => {
    vi.mocked(client.listPackages).mockRejectedValueOnce(new ApiError("Máy chủ lỗi", 500)).mockResolvedValueOnce({ items: [] } as never).mockResolvedValue([pkg(1)]);
    renderPage();
    const notice = await screen.findByTestId("content-packages-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(notice).toHaveTextContent("Máy chủ lỗi");
    await userEvent.click(within(notice).getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByTestId("content-packages-notice")).toHaveTextContent("không đúng định dạng danh sách package");
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Gói 1")).toBeInTheDocument();
  });

  it("cấp thư mục rỗng thật => 'Chưa có thư mục nào'; lỗi ở cấp con không ảnh hưởng breadcrumb", async () => {
    vi.mocked(client.listFolders).mockResolvedValueOnce([]).mockRejectedValue(new ApiError("Lỗi thư mục", 500));
    nav.set("/flashcard/create-package?packageId=p1");
    renderPage();
    expect(await screen.findByTestId("content-folders-empty")).toHaveTextContent("Chưa có thư mục nào");
    expect(crumbLabels()).toEqual(["Packages", "Gói 1"]);
    await userEvent.click(screen.getByRole("button", { name: "Thêm thư mục" }));
    expect(antModal()).toHaveTextContent("Thêm Thư mục mới");
  });
});

describe("biến thể Bộ từ vựng (/vocab-set/manage)", () => {
  it("cùng dữ liệu /flashcard nhưng tiêu đề/nhãn khác, class trang manage-vocabulary-page, không thẻ lật", async () => {
    nav.set("/vocab-set/manage?packageId=p1&folderId=f1&studySetId=s1");
    renderPage(adminUser, "admin", VocabSetManagePageContent);
    await screen.findByText("词1");
    expect(client.listItems).toHaveBeenCalledWith(TARGET, "s1");
    expect(screen.getByRole("heading", { level: 5, name: /Quản lý Từ vựng/ })).toBeInTheDocument();
    expect(document.querySelector(".content.manage-vocabulary-page")).not.toBeNull();
    expect(screen.getByText("Tổng số từ:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thêm từ" })).toBeInTheDocument();
    expect(screen.queryByTestId("flashcard-preview")).toBeNull();
  });
});
