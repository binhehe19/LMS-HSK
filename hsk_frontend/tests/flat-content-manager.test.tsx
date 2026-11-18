// Test FlatContentManager với cấu hình thẻ (trước là FlashcardManagePageContent; đổi sang FlatContentManager + lms-content-client.ts, API thật repo-lms) — thay thế phần
// test Flashcard cũ từng nằm ở tests/content-tree-manager.test.tsx (test ContentTreeManager + content-tree-client mock, module
// Flashcard không còn dùng kiến trúc đó nữa). Mirror cấu trúc/đặt tên của file cũ cho phần còn tương đương (cấp gói, cấp mục,
// quyền theo ticket + công tắc ghi, trạng thái dữ liệu) nhưng rút gọn: không còn Folder/StudySet, mock ở lớp lms-content-client.
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FLASHCARD_CONFIG } from "@/components/management/content-flashcard/flashcard-config";
import { FlatContentManager } from "@/components/management/content-flat/flat-content-manager";
import type { FlatContentClient } from "@/components/management/content-flat/use-flat-content";
import { ManagementShell } from "@/components/management/management-shell";
import { confirmAction } from "@/components/shared/confirm-action";
import { resetContentAccessCache } from "@/hooks/use-content-access";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import * as client from "@/lib/api/lms-content-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { ManagementArea } from "@/lib/management/area";
import type { ContentPackage } from "@/types/content";
import type { FlashcardCard } from "@/types/content-flashcard";
import { adminUser } from "./fixtures/classes";

// Màn quản lý thẻ (/flashcard/manage cũ đã chuyển hướng về /vocab-set/manage): ghép FlatContentManager với cấu hình thẻ và client lms-content-client (đã mock).
const FLASHCARD_CLIENT: FlatContentClient<FlashcardCard> = {
  listPackages: (...args) => client.listFlashcardPackages(...args),
  createPackage: (...args) => client.createFlashcardPackage(...args),
  updatePackage: (...args) => client.updateFlashcardPackage(...args),
  deletePackage: (...args) => client.deleteFlashcardPackage(...args),
  publishPackage: (...args) => client.publishFlashcardPackage(...args),
  unpublishPackage: (...args) => client.unpublishFlashcardPackage(...args),
  listItems: (...args) => client.listPackageItems(...args),
  createItem: (...args) => client.createFlashcardItem(...args),
  updateItem: (...args) => client.updateFlashcardItem(...args),
  deleteItem: (...args) => client.deleteFlashcardItem(...args),
};
const FLASHCARD_FLAT_CONFIG = {
  ...FLASHCARD_CONFIG,
  packageTypes: [{ value: "VOCABULARY", label: "Flashcard", description: "Gói thẻ ghi nhớ từ vựng HSK", icon: "isax isax-cards", color: "#B10019", gradient: "linear-gradient(135deg, #B10019 0%, #7A0012 100%)" }],
};
function FlashcardManagePageContent() {
  return <FlatContentManager config={FLASHCARD_FLAT_CONFIG} client={FLASHCARD_CLIENT} />;
}
// Router giả CÓ trạng thái: push/replace đổi URL và báo cho useSearchParams (vị trí trong URL: chỉ còn ?packageId=, không Folder/StudySet).
const nav = vi.hoisted(() => {
  let url = "/flashcard/manage";
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
vi.mock("@/lib/api/package-edit-session-client", () => ({
  packageEditSessionClient: (id: string) => ({
    acquire: async () => ({ acquired: true }),
    draft: async () => ({ id: `draft-${id}`, title: `Gói ${id.slice(1)}` }),
    heartbeat: async () => ({ acquired: true, saved: true }),
    release: async () => undefined,
  }),
}));
vi.mock("@/lib/api/lms-content-client", () => ({
  listFlashcardPackages: vi.fn(),
  createFlashcardPackage: vi.fn(),
  updateFlashcardPackage: vi.fn(),
  deleteFlashcardPackage: vi.fn(),
  publishFlashcardPackage: vi.fn(),
  unpublishFlashcardPackage: vi.fn(),
  listPackageItems: vi.fn(),
  createFlashcardItem: vi.fn(),
  updateFlashcardItem: vi.fn(),
  deleteFlashcardItem: vi.fn(),
}));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

// Màn có sidebar + antd Table/Modal trong jsdom chạy chậm.
vi.setConfig({ testTimeout: 30_000 });

const teacher = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "gv1@example.test", roles: ["ROLE_TEACHER"] };
const pkg = (i: number, over: Partial<ContentPackage> = {}): ContentPackage => ({ id: `p${i}`, name: `Gói ${i}`, type: "VOCABULARY", publishStatus: "DRAFT", description: `Mô tả ${i}`, createdAt: "2026-03-05T08:30:00Z", ...over });
const card = (i: number, over: Partial<FlashcardCard> = {}): FlashcardCard => ({ id: `c${i}`, studySetId: "", index: i - 1, term: `词${i}`, pinyin: `cí ${i}`, meaning: `nghĩa ${i}`, ...over });

beforeEach(() => {
  resetContentAccessCache();
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(confirmAction).mockReset().mockResolvedValue(true);
  for (const fn of Object.values(client)) if (typeof fn === "function" && "mockReset" in fn) vi.mocked(fn as unknown as ReturnType<typeof vi.fn>).mockReset();
  vi.mocked(client.listFlashcardPackages).mockResolvedValue([pkg(1), pkg(2, { publishStatus: "PUBLISHED", publishedVersion: 2 })]);
  vi.mocked(client.listPackageItems).mockResolvedValue([card(2), card(1)]);
  vi.mocked(client.createFlashcardPackage).mockResolvedValue(pkg(9));
  vi.mocked(client.deleteFlashcardPackage).mockResolvedValue(undefined);
  vi.mocked(client.publishFlashcardPackage).mockResolvedValue(undefined);
  vi.mocked(client.unpublishFlashcardPackage).mockResolvedValue(undefined);
  vi.mocked(client.createFlashcardItem).mockResolvedValue(card(3));
  vi.mocked(client.updateFlashcardItem).mockResolvedValue(card(1));
  vi.mocked(client.deleteFlashcardItem).mockResolvedValue(undefined);
  for (const fn of [toast.success, toast.error, toast.info]) vi.mocked(fn).mockClear();
  nav.push.length = 0;
  nav.set("/flashcard/manage");
});

function renderPage(user = adminUser, area: ManagementArea = "admin") {
  render(
    <Provider store={makeStore({ status: "authenticated", user })}>
      <ManagementShell area={area}>
        <FlashcardManagePageContent />
      </ManagementShell>
    </Provider>,
  );
}

const packageRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
async function choosePackageAction(name: string, action: string) {
  await waitFor(() => expect(screen.getByRole("button", { name: "Tải lại" })).toBeEnabled());
  await userEvent.click(screen.getByRole("button", { name: `Thao tác ${name}` }));
  await userEvent.click(await screen.findByRole("menuitem", { name: text => text === action }));
}
const modalOk = (modal: HTMLElement, name: RegExp | string) => within(modal).getByRole("button", { name });
const antModal = () => document.querySelector(".ant-modal") as HTMLElement;

describe("cấp gói (Admin)", () => {
  it("tải gói qua listFlashcardPackages (không truyền target, không Folder); huy hiệu Published/Draft; chỉ 1 loại Flashcard", async () => {
    renderPage();
    await screen.findByText("Gói 1");
    expect(client.listFlashcardPackages).toHaveBeenCalledWith();
    expect(packageRows()).toHaveLength(2);
    expect(within(packageRows()[0]).getByText("Chưa xuất bản")).toBeInTheDocument();
    expect(within(packageRows()[1]).getByText("v2")).toBeInTheDocument();
    // Tab lọc theo loại (Tất Cả/...) đã bỏ — chỉ còn thanh tìm kiếm.
    expect(screen.queryByRole("button", { name: /Tất Cả \(/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Tạo học phần" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Flashcard" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Học phần flashcard" })).toBeInTheDocument();
    expect(screen.queryByTestId("flat-content-missing")).toBeNull();
  });

  it("Admin có nút Publish/Unpublish: xác nhận rồi gọi đúng hàm (packageId, demo), toast, tải lại danh sách", async () => {
    renderPage();
    await screen.findByText("Gói 1");
    await choosePackageAction("Gói 1", "Xuất bản");
    await waitFor(() => expect(client.publishFlashcardPackage).toHaveBeenCalledWith("p1", false));
    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xác nhận Publish", okText: "Publish" }));
    expect(toast.success).toHaveBeenCalledWith('Package "Gói 1" đã được publish');
    await choosePackageAction("Gói 2", "Ngừng xuất bản");
    await waitFor(() => expect(client.unpublishFlashcardPackage).toHaveBeenCalledWith("p2", false));
    expect(toast.success).toHaveBeenCalledWith('Package "Gói 2" đã chuyển về Draft');
    expect(vi.mocked(client.listFlashcardPackages).mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("xoá gói: huỷ => không gọi API; đồng ý => deleteFlashcardPackage + toast", async () => {
    vi.mocked(confirmAction).mockResolvedValueOnce(false);
    renderPage();
    await screen.findByText("Gói 1");
    await choosePackageAction("Gói 1", "Xóa");
    await waitFor(() => expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xóa Package", danger: true })));
    expect(client.deleteFlashcardPackage).not.toHaveBeenCalled();
    await choosePackageAction("Gói 1", "Xóa");
    await waitFor(() => expect(client.deleteFlashcardPackage).toHaveBeenCalledWith("p1", false));
    expect(toast.success).toHaveBeenCalledWith('Package "Gói 1" đã xóa thành công!');
  });

  it("tạo gói qua modal: thiếu tên => toast lỗi không gọi API; đủ => createFlashcardPackage, đóng modal, tải lại", async () => {
    renderPage();
    await screen.findByText("Gói 1");
    await userEvent.click(screen.getByRole("button", { name: "Tạo học phần" }));
    const modal = antModal();
    // Không còn ô "Loại Package" trong modal — type gán mặc định (VOCABULARY), xác nhận qua createFlashcardPackage bên dưới.
    expect(modalOk(modal, "Tạo Package")).toBeDisabled();
    expect(client.createFlashcardPackage).not.toHaveBeenCalled();
    await userEvent.type(within(modal).getByLabelText("Tên Package"), "  HSK 4  ");
    await userEvent.click(modalOk(modal, "Tạo Package"));
    await waitFor(() => expect(client.createFlashcardPackage).toHaveBeenCalledWith({ name: "HSK 4", type: "VOCABULARY", description: undefined }, false));
    expect(toast.success).toHaveBeenCalledWith("Tạo package thành công!");
    await waitFor(() => expect(document.querySelector(".ant-modal")).toBeNull());
    expect(client.listFlashcardPackages).toHaveBeenCalledTimes(2);
  });
});

describe("cấp mục qua URL (?packageId=, không Folder/StudySet)", () => {
  it("bấm gói => push ?packageId; tải mục qua listPackageItems; 'Quay lại' về cấp gói", async () => {
    renderPage();
    await screen.findByText("Gói 1");
    await choosePackageAction("Gói 1", "Chỉnh sửa");
    expect(nav.push.at(-1)).toBe("/flashcard/manage?packageId=p1");
    await screen.findAllByText("词1");
    expect(client.listPackageItems).toHaveBeenCalledWith("p1", 1);
    // sắp theo index: 词1 (index 0) trước 词2
    const rows = within(screen.getByRole("list", { name: "Học liệu trong buổi" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("词1");
    await userEvent.click(screen.getByRole("button", { name: /Quay lại/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Lưu nháp và thoát" }));
    await waitFor(() => expect(nav.push.at(-1)).toBe("/flashcard/manage"));
  });

  it("vào thẳng URL có packageId (reload) => hiện cấp mục; packageId không tồn tại => khối 'Không tìm thấy' + Quay lại về gốc", async () => {
    nav.set("/flashcard/manage?packageId=p1");
    renderPage();
    await screen.findAllByText("词1");
    expect(client.listFlashcardPackages).toHaveBeenCalledTimes(1);
    expect(client.listPackageItems).toHaveBeenCalledWith("p1");
    act(() => nav.set("/flashcard/manage?packageId=khong-co"));
    const missing = await screen.findByTestId("flat-content-missing");
    await userEvent.click(within(missing).getByRole("button", { name: "Quay lại" }));
    expect(nav.push.at(-1)).toBe("/flashcard/manage");
  });

  it("'Thêm thẻ' => modal form thẻ; thiếu nghĩa => toast lỗi; đủ => createFlashcardItem(packageId, input chuẩn hoá + index cuối, demo) và tải lại", async () => {
    nav.set("/flashcard/manage?packageId=p1");
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
    await userEvent.click(modalOk(modal, "Thêm thẻ"));
    expect(toast.error).toHaveBeenCalledWith("Vui lòng nhập pinyin"); // nội dung ZH cần phiên âm
    await userEvent.type(within(modal).getByLabelText(/^Pinyin\s*\*/), "nǐ hǎo");
    await userEvent.type(within(modal).getByLabelText("Pinyin câu ví dụ"), "nǐ hǎo ma");
    await userEvent.click(within(modal).getByRole("button", { name: "Thêm trường" }));
    await userEvent.type(within(modal).getByLabelText("Nhãn trường bổ sung 1"), "Từ đồng nghĩa");
    await userEvent.type(within(modal).getByLabelText("Giá trị trường bổ sung 1"), "您好");
    await userEvent.click(modalOk(modal, "Thêm thẻ"));
    await waitFor(() =>
      expect(client.createFlashcardItem).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ term: "你好", meaning: "xin chào", pinyin: "nǐ hǎo", examplePinyin: "nǐ hǎo ma", customFields: [{ label: "Từ đồng nghĩa", value: "您好" }], index: 2 }),
        false,
      ),
    );
    expect(toast.success).toHaveBeenCalledWith("Đã thêm thẻ mới");
    await waitFor(() => expect(client.listPackageItems).toHaveBeenCalledTimes(2));
  });

  it("'Chỉnh sửa' một thẻ => updateFlashcardItem(packageId, cardId, input, demo); 'Xóa' => deleteFlashcardItem + toast", async () => {
    nav.set("/flashcard/manage?packageId=p1");
    renderPage();
    await screen.findAllByText("词1");
    await userEvent.click(screen.getByRole("button", { name: "Chỉnh sửa 词1" }));
    const modal = antModal();
    await userEvent.clear(within(modal).getByLabelText(/Nghĩa tiếng Việt/));
    await userEvent.type(within(modal).getByLabelText(/Nghĩa tiếng Việt/), "nghĩa mới");
    await userEvent.click(modalOk(modal, "Lưu thay đổi"));
    await waitFor(() => expect(client.updateFlashcardItem).toHaveBeenCalledWith("p1", "c1", expect.objectContaining({ term: "词1", meaning: "nghĩa mới" }), false));
    expect(toast.success).toHaveBeenCalledWith("Cập nhật thẻ thành công!");
    await userEvent.click(screen.getByRole("button", { name: "Xóa 词2" }));
    await waitFor(() => expect(client.deleteFlashcardItem).toHaveBeenCalledWith("p1", "c2", false));
    expect(toast.success).toHaveBeenCalledWith('Đã xóa thẻ "词2"');
  });
});

describe("quyền theo ticket + công tắc ghi", () => {
  it("giảng viên KHÔNG có ticket FLASHCARD: Alert 'Chế độ Xem duy nhất', vẫn thấy gói, không nút ghi/publish", async () => {
    vi.mocked(getTickets).mockResolvedValue([{ id: "t1", status: "OPEN", assignedId: "u-teacher-1", module: "QUIZ" }] as never);
    renderPage(teacher, "instructor");
    await screen.findByText("Gói 1");
    expect(await screen.findByTestId("flat-content-readonly-alert")).toHaveTextContent("Chế độ Xem duy nhất");
    expect(screen.queryByRole("button", { name: "Tạo học phần" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Thao tác Gói 1" }));
    expect(await screen.findByRole("menuitem", { name: "Xem chi tiết" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Xuất bản" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Xóa" })).toBeNull();
  });

  it("công tắc ghi ĐÓNG (Admin): WriteLockedNotice, không nút ghi, không Alert ticket", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "disabled");
    renderPage();
    await screen.findByText("Gói 1");
    expect(screen.getByTestId("write-locked")).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.queryByRole("button", { name: "Tạo học phần" })).toBeNull();
    expect(screen.queryByTestId("flat-content-readonly-alert")).toBeNull();
  });
});

describe("trạng thái dữ liệu", () => {
  it("dịch vụ chưa cấu hình => WAITING FOR BACKEND trong vùng danh sách, không toast", async () => {
    vi.mocked(client.listFlashcardPackages).mockRejectedValue(new ApiNotConfiguredError());
    renderPage();
    const notice = await screen.findByTestId("content-packages-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(notice).toHaveTextContent("Chưa kết nối được API học phần.");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("lỗi API => khối lỗi + 'Thử lại' tải lại", async () => {
    vi.mocked(client.listFlashcardPackages).mockRejectedValueOnce(new ApiError("Máy chủ lỗi", 500)).mockResolvedValue([pkg(1)]);
    renderPage();
    const notice = await screen.findByTestId("content-packages-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(notice).toHaveTextContent("Máy chủ lỗi");
    await userEvent.click(within(notice).getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Gói 1")).toBeInTheDocument();
  });

  it("cấp mục rỗng thật => 'Chưa có thẻ nào'", async () => {
    vi.mocked(client.listPackageItems).mockResolvedValueOnce([]);
    nav.set("/flashcard/manage?packageId=p1");
    renderPage();
    expect(await screen.findByTestId("flat-content-items-empty")).toHaveTextContent("Chưa có thẻ nào");
  });
});
