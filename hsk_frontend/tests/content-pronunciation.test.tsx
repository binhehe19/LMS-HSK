import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRONUNCIATION_CONFIG, PRONUNCIATION_MANAGE_PATH, PRONUNCIATION_PACKAGE_TYPES } from "@/components/management/content-pronunciation/pronunciation-config";
import { PronunciationItemForm } from "@/components/management/content-pronunciation/pronunciation-item-form";
import { PronunciationItemPreview } from "@/components/management/content-pronunciation/pronunciation-item-preview";
import { PronunciationManagePageContent } from "@/components/management/content-pronunciation/pronunciation-manage-page-content";
import { PronunciationSelectTypePageContent } from "@/components/management/content-pronunciation/pronunciation-select-type-page-content";
import { ManagementShell } from "@/components/management/management-shell";
import { confirmAction } from "@/components/shared/confirm-action";
import { resetContentAccessCache } from "@/hooks/use-content-access";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import * as client from "@/lib/api/content-tree-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { getTickets } from "@/lib/api/ticket-client";
import { emptyPronunciationInput, normalizePronunciationInput, pronunciationSummary, pronunciationToInput, validatePronunciationInput } from "@/lib/content/pronunciation-item";
import { makeStore } from "@/redux/store";
import type { ManagementArea } from "@/lib/management/area";
import type { ContentFolder, ContentPackage, ContentStudySet } from "@/types/content";
import type { PronunciationItem, PronunciationItemInput } from "@/types/content-pronunciation";
import { adminUser } from "./fixtures/classes";

// Cây antd 4 cấp + media trong jsdom: 30s mặc định từng không đủ khi cả bộ chạy song song (xem tests/content-hanzi.test.tsx).
vi.setConfig({ testTimeout: 90_000 });

const nav = vi.hoisted(() => {
  let url = "/pronunciation/manage";
  const listeners = new Set<() => void>();
  return {
    push: [] as string[],
    replace: [] as string[],
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
    replace: (to: string) => {
      nav.replace.push(to);
      nav.set(to);
    },
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

vi.setConfig({ testTimeout: 30_000 });

const TARGET = { apiPrefix: "/pronunciation", itemsPath: "pronunciation-items" };
const teacher = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "gv1@example.test", roles: ["ROLE_TEACHER"] };
const pkg = (i: number, over: Partial<ContentPackage> = {}): ContentPackage => ({ id: `p${i}`, name: `Gói ${i}`, type: "LEARNING_PATH", publishStatus: "DRAFT", description: `Mô tả ${i}`, createdAt: "2026-03-05T08:30:00Z", folderCount: 1, ...over });
const folder = (i: number): ContentFolder => ({ id: `f${i}`, packageId: "p1", name: `Thư mục ${i}`, description: "", studySetCount: 1 });
const set = (i: number): ContentStudySet => ({ id: `s${i}`, folderId: "f1", title: `Bộ ${i}`, description: "", itemCount: 2 });
const item = (i: number, over: Partial<PronunciationItem> = {}): PronunciationItem => ({ id: `i${i}`, studySetId: "s1", index: i - 1, text: ["妈", "麻", "马"][i - 1], pinyin: ["mā", "má", "mǎ"][i - 1], tip: ["Thanh 1: cao, đều", "", "Thanh 3: xuống rồi lên"][i - 1], ...over });

beforeEach(() => {
  resetContentAccessCache();
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(confirmAction).mockReset().mockResolvedValue(true);
  for (const fn of Object.values(client)) if (typeof fn === "function" && "mockReset" in fn) vi.mocked(fn as unknown as ReturnType<typeof vi.fn>).mockReset();
  vi.mocked(client.listPackages).mockResolvedValue([pkg(1), pkg(2, { type: "FREE", publishStatus: "PUBLISHED" }), pkg(3, { type: "VIDEO_COURSE" })]);
  vi.mocked(client.listFolders).mockResolvedValue([folder(1)]);
  vi.mocked(client.listStudySets).mockResolvedValue([set(1)]);
  vi.mocked(client.listItems).mockResolvedValue([item(2), item(1)]);
  vi.mocked(client.createItem).mockResolvedValue(item(3));
  vi.mocked(client.updateItem).mockResolvedValue(item(1));
  vi.mocked(client.deleteItem).mockResolvedValue({});
  for (const fn of [toast.success, toast.error, toast.info]) vi.mocked(fn).mockClear();
  nav.push.length = 0;
  nav.replace.length = 0;
  nav.set("/pronunciation/manage");
});

function renderPage(Content: () => React.JSX.Element, user = adminUser, area: ManagementArea = "admin") {
  render(
    <Provider store={makeStore({ status: "authenticated", user })}>
      <ManagementShell area={area}>
        <Content />
      </ManagementShell>
    </Provider>,
  );
}

const antModal = () => document.querySelector(".ant-modal") as HTMLElement;
const modalOk = (modal: HTMLElement, name: RegExp | string) => within(modal).getByRole("button", { name });

describe("hàm thuần module Luyện phát âm (lib/content/pronunciation-item)", () => {
  it("emptyPronunciationInput/pronunciationToInput: form rỗng; từ mục máy chủ giữ index, fileId rỗng => undefined", () => {
    expect(emptyPronunciationInput()).toEqual({ text: "", pinyin: "", tip: "", audioFileId: undefined, imageFileId: undefined });
    expect(pronunciationToInput(item(1, { audioFileId: "", imageFileId: "img-1" }))).toEqual({ text: "妈", pinyin: "mā", tip: "Thanh 1: cao, đều", audioFileId: undefined, imageFileId: "img-1", index: 0 });
    expect(pronunciationToInput({ id: "i9", studySetId: "s1", text: "zh" })).toEqual({ text: "zh", pinyin: "", tip: "", audioFileId: undefined, imageFileId: undefined, index: undefined });
  });

  it("validatePronunciationInput: chỉ ký hiệu/từ bắt buộc (bản cũ: 'Vui lòng nhập symbol')", () => {
    expect(validatePronunciationInput({ ...emptyPronunciationInput(), text: "  " })).toBe("Vui lòng nhập ký hiệu hoặc từ cần phát âm");
    expect(validatePronunciationInput({ ...emptyPronunciationInput(), text: "zh" })).toBeNull();
  });

  it("normalizePronunciationInput: cắt khoảng trắng, trường rỗng => undefined, giữ fileId và index", () => {
    const input: PronunciationItemInput = { text: " 妈 ", pinyin: " mā ", tip: "  ", audioFileId: "a1", imageFileId: "", index: 4 };
    expect(normalizePronunciationInput(input)).toEqual({ text: "妈", pinyin: "mā", tip: undefined, audioFileId: "a1", imageFileId: undefined, index: 4 });
  });

  it("pronunciationSummary: 'text (pinyin)'; không pinyin hoặc pinyin trùng text => chỉ text", () => {
    expect(pronunciationSummary(item(1))).toBe("妈 (mā)");
    expect(pronunciationSummary(item(1, { pinyin: "" }))).toBe("妈");
    expect(pronunciationSummary(item(1, { text: "zh", pinyin: "zh" }))).toBe("zh");
  });
});

describe("cấu hình module PRONUNCIATION", () => {
  it("PRONUNCIATION_CONFIG: ticket PRONUNCIATION, /pronunciation + pronunciation-items, class manage-pronunciation-page, nhãn 'Mục phát âm', 4 loại gói theo thứ tự tab cũ, có Nhập Excel, không trang sửa bộ/nhập nhanh/tab tìm", () => {
    expect(PRONUNCIATION_CONFIG).toMatchObject({ module: "PRONUNCIATION", key: "pronunciation", apiPrefix: "/pronunciation", itemsPath: "pronunciation-items", title: "Quản lý Phát âm", icon: "isax-microphone-2", pageClassName: "manage-pronunciation-page", supportsImport: true, labels: { package: "Package", folder: "Thư mục", studySet: "Bộ học", item: "Mục phát âm" } });
    expect(PRONUNCIATION_CONFIG.packagesHeader).toEqual({ title: "Quản lý Phát âm", subtitle: "Quản lý toàn bộ nội dung luyện phát âm tiếng Trung" });
    expect(PRONUNCIATION_PACKAGE_TYPES.map((t) => t.value)).toEqual(["LEARNING_PATH", "FREE", "LEARNING", "VIDEO_COURSE"]);
    expect(PRONUNCIATION_PACKAGE_TYPES.find((t) => t.value === "VIDEO_COURSE")).toMatchObject({ label: "Khóa học video", description: "Luyện phát âm theo bài học video", color: "#D4AF37" });
    expect(PRONUNCIATION_CONFIG.itemColumns.map((c) => c.key)).toEqual(["text", "tip", "media"]);
    expect(PRONUNCIATION_CONFIG.setEditorRoutes).toBeUndefined();
    expect(PRONUNCIATION_CONFIG.parseBulkText).toBeUndefined();
    expect(PRONUNCIATION_CONFIG.itemSearchTab).toBeUndefined();
    expect(PRONUNCIATION_CONFIG.ItemForm).toBe(PronunciationItemForm);
    expect(PRONUNCIATION_CONFIG.ItemPreview).toBe(PronunciationItemPreview);
    expect(PRONUNCIATION_MANAGE_PATH).toBe("/pronunciation/manage");
  });
});

describe("form mục phát âm và xem nhanh", () => {
  it("PronunciationItemForm: 3 trường chữ + ô tải âm thanh/hình miệng; kho lưu trữ chưa cấu hình => báo và khoá chọn tệp; gõ ký hiệu gọi onChange", async () => {
    const onChange = vi.fn();
    const value = { ...emptyPronunciationInput(), pinyin: "mā" };
    render(<PronunciationItemForm value={value} onChange={onChange} idPrefix="t" />);
    expect(screen.getByLabelText(/Ký hiệu \/ Từ/)).toBeInTheDocument();
    expect(screen.getByLabelText("Pinyin")).toHaveValue("mā");
    expect(screen.getByLabelText("Hướng dẫn phát âm")).toBeInTheDocument();
    expect(screen.getByLabelText("Âm thanh mẫu")).toBeDisabled();
    expect(screen.getByLabelText("Hình miệng (khẩu hình)")).toBeDisabled();
    expect(screen.getAllByTestId("storage-not-configured")).toHaveLength(2);
    await userEvent.type(screen.getByLabelText(/Ký hiệu \/ Từ/), "妈");
    expect(onChange).toHaveBeenLastCalledWith({ ...value, text: "妈" });
    await userEvent.type(screen.getByLabelText("Hướng dẫn phát âm"), "T");
    expect(onChange).toHaveBeenLastCalledWith({ ...value, tip: "T" });
  });

  it("PronunciationItemForm với kho lưu trữ đã cấu hình: ô chọn tệp mở; tệp âm thanh có sẵn hiện trình phát + nút Xóa trả audioFileId=undefined", async () => {
    vi.stubEnv("NEXT_PUBLIC_STORAGE_API_BASE_PATH", "/api/storage");
    const onChange = vi.fn();
    const value = { ...emptyPronunciationInput(), text: "妈", audioFileId: "aud-1" };
    const { container } = render(<PronunciationItemForm value={value} onChange={onChange} idPrefix="t" />);
    expect(screen.queryByTestId("storage-not-configured")).toBeNull();
    expect(screen.getByLabelText("Âm thanh mẫu")).toBeEnabled();
    expect(screen.getByLabelText("Âm thanh mẫu")).toHaveAttribute("accept", "audio/*");
    expect(screen.getByLabelText("Hình miệng (khẩu hình)")).toHaveAttribute("accept", "image/*");
    expect(container.querySelector("audio")).toHaveAttribute("src", "/api/storage/file/aud-1?disposition=inline");
    await userEvent.click(screen.getByRole("button", { name: /Xóa/ }));
    expect(onChange).toHaveBeenCalledWith({ ...value, audioFileId: undefined });
  });

  it("PronunciationItemPreview: ký hiệu/pinyin/hướng dẫn (hoặc 'Chưa có hướng dẫn phát âm.'), 'Chưa có hình miệng.', thứ tự; không tệp => Phát âm đọc bằng Web Speech zh-CN", async () => {
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak, cancel: vi.fn() });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        lang = "";
        constructor(text: string) {
          this.text = text;
        }
      },
    );
    const { rerender } = render(<PronunciationItemPreview item={item(1)} />);
    const preview = screen.getByTestId("pronunciation-preview");
    expect(within(preview).getByText("妈")).toBeInTheDocument();
    expect(within(preview).getByText("mā")).toBeInTheDocument();
    expect(within(preview).getByText("Thanh 1: cao, đều")).toHaveClass("pronunciation-guide-box");
    expect(within(preview).getByText("Chưa có hình miệng.")).toBeInTheDocument();
    expect(within(preview).getByText("Không có")).toBeInTheDocument();
    expect(within(preview).getByText("1")).toBeInTheDocument(); // thứ tự = index + 1
    expect(preview.querySelector("audio")).toBeNull();
    await userEvent.click(within(preview).getByRole("button", { name: /Phát âm/ }));
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: "妈", lang: "zh-CN" }));
    rerender(<PronunciationItemPreview item={item(2)} />);
    expect(screen.getByText("Chưa có hướng dẫn phát âm.")).toBeInTheDocument();
  });

  it("PronunciationItemPreview với tệp trong kho lưu trữ: hình miệng là <img> theo fileId, nút Phát âm phát/tạm dừng <audio> (không dùng giọng máy)", async () => {
    vi.stubEnv("NEXT_PUBLIC_STORAGE_API_BASE_PATH", "/api/storage");
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak, cancel: vi.fn() });
    const play = vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue();
    const pause = vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    render(<PronunciationItemPreview item={item(1, { audioFileId: "aud-1", imageFileId: "img-1" })} />);
    const preview = screen.getByTestId("pronunciation-preview");
    expect(within(preview).getByRole("img", { name: "Hình miệng 妈" })).toHaveAttribute("src", "/api/storage/file/img-1?disposition=inline");
    expect(preview.querySelector("audio")).toHaveAttribute("src", "/api/storage/file/aud-1?disposition=inline");
    expect(within(preview).getByText("Âm thanh, Hình miệng")).toBeInTheDocument();
    await userEvent.click(within(preview).getByRole("button", { name: /Phát âm/ }));
    await waitFor(() => expect(preview).toHaveAttribute("data-playing", "true"));
    expect(play).toHaveBeenCalledTimes(1);
    expect(speak).not.toHaveBeenCalled();
    await userEvent.click(within(preview).getByRole("button", { name: /Tạm dừng/ }));
    expect(pause).toHaveBeenCalled();
    expect(preview).toHaveAttribute("data-playing", "false");
  });
});

describe("/pronunciation/manage — màn quản lý phát âm trên nền content-tree", () => {
  it("tải gói với target /pronunciation+pronunciation-items; tiêu đề/mô tả bản cũ; class trang; không tab lọc theo loại, không tab tìm toàn cây", async () => {
    renderPage(PronunciationManagePageContent);
    await screen.findByText("Gói 1");
    expect(client.listPackages).toHaveBeenCalledWith(TARGET);
    // Tiêu đề trang (config.title, trùng chữ "Quản lý Phát âm" với khối gói) đã bỏ — chỉ còn h5 của khối gói.
    expect(screen.getByRole("heading", { level: 5, name: /Quản lý Phát âm/ })).toBeInTheDocument();
    expect(screen.getByText("Quản lý toàn bộ nội dung luyện phát âm tiếng Trung")).toBeInTheDocument();
    expect(document.querySelector(".content.manage-pronunciation-page.content-tree-page .card.manage-lp-container")).not.toBeNull();
    // Tab lọc theo loại (Tất Cả/Khóa học video/...) đã bỏ — chỉ còn thanh tìm kiếm.
    expect(screen.queryByRole("button", { name: /Tất Cả \(/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Khóa học video \(/ })).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getAllByTestId("content-package-row")).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: /Nhập Excel/ }));
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("chưa được chuyển"));
  });

  it("cấp mục: xem nhanh mục đầu theo index, cột Ký hiệu/Hướng dẫn/Tệp, 'Tổng số mục phát âm', Chỉnh sửa bộ học là nút (không có trang sửa bộ); 'Thêm mục phát âm' kiểm tra ký hiệu rồi gọi createItem", async () => {
    nav.set("/pronunciation/manage?packageId=p1&folderId=f1&studySetId=s1");
    renderPage(PronunciationManagePageContent);
    const preview = await screen.findByTestId("pronunciation-preview");
    expect(client.listItems).toHaveBeenCalledWith(TARGET, "s1");
    expect(within(preview).getByText("Thanh 1: cao, đều")).toBeInTheDocument(); // 妈 (index 0) trước 麻
    expect(screen.getByText("Tổng số mục phát âm:")).toBeInTheDocument();
    expect(screen.getByTestId("content-items-count")).toHaveTextContent("2");
    expect(screen.getByRole("columnheader", { name: "Ký hiệu / Từ" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Hướng dẫn phát âm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Chỉnh sửa bộ học/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Chỉnh sửa bộ học/ })).toBeNull();
    expect(screen.getByText("---")).toBeInTheDocument(); // 麻 chưa có hướng dẫn

    await userEvent.click(screen.getByRole("button", { name: "Thêm mục phát âm" }));
    const modal = antModal();
    expect(within(modal).getByTestId("pronunciation-item-form")).toBeInTheDocument();
    expect(within(modal).getAllByTestId("storage-not-configured")).toHaveLength(2);
    await userEvent.click(modalOk(modal, "Thêm mục phát âm"));
    expect(toast.error).toHaveBeenLastCalledWith("Vui lòng nhập ký hiệu hoặc từ cần phát âm");
    expect(client.createItem).not.toHaveBeenCalled();
    await userEvent.type(within(modal).getByLabelText(/Ký hiệu \/ Từ/), " 骂 ");
    await userEvent.type(within(modal).getByLabelText("Pinyin"), "mà");
    await userEvent.type(within(modal).getByLabelText("Hướng dẫn phát âm"), "Thanh 4");
    await userEvent.click(modalOk(modal, "Thêm mục phát âm"));
    await waitFor(() => expect(client.createItem).toHaveBeenCalledWith(TARGET, "s1", { text: "骂", pinyin: "mà", tip: "Thanh 4", audioFileId: undefined, imageFileId: undefined, index: 2 }, false));
    expect(toast.success).toHaveBeenCalledWith("Đã thêm mục phát âm mới");
    await waitFor(() => expect(document.querySelector(".ant-modal")).toBeNull());
  });

  it("sửa mục: modal nạp giá trị cũ, đổi hướng dẫn => updateItem giữ index; xoá mục: xác nhận với tên 'text (pinyin)' rồi deleteItem", async () => {
    nav.set("/pronunciation/manage?packageId=p1&folderId=f1&studySetId=s1");
    renderPage(PronunciationManagePageContent);
    await screen.findByTestId("pronunciation-preview");
    await userEvent.click(screen.getByRole("button", { name: "Chỉnh sửa 妈 (mā)" }));
    const modal = antModal();
    expect(within(modal).getByLabelText(/Ký hiệu \/ Từ/)).toHaveValue("妈");
    expect(within(modal).getByLabelText("Hướng dẫn phát âm")).toHaveValue("Thanh 1: cao, đều");
    await userEvent.clear(within(modal).getByLabelText("Hướng dẫn phát âm"));
    await userEvent.type(within(modal).getByLabelText("Hướng dẫn phát âm"), "Thanh 1: cao và bằng");
    await userEvent.click(modalOk(modal, "Lưu thay đổi"));
    await waitFor(() => expect(client.updateItem).toHaveBeenCalledWith(TARGET, "i1", { text: "妈", pinyin: "mā", tip: "Thanh 1: cao và bằng", audioFileId: undefined, imageFileId: undefined, index: 0 }, false));
    expect(toast.success).toHaveBeenCalledWith("Cập nhật mục phát âm thành công!");
    await waitFor(() => expect(document.querySelector(".ant-modal")).toBeNull());
    await userEvent.click(screen.getByRole("button", { name: "Xóa 麻 (má)" }));
    await waitFor(() => expect(client.deleteItem).toHaveBeenCalledWith(TARGET, "i2", false));
    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xóa mục phát âm", content: 'Bạn có chắc chắn muốn xóa mục phát âm "麻 (má)"?' }));
    expect(toast.success).toHaveBeenCalledWith('Đã xóa mục phát âm "麻 (má)"');
  });

  it("quyền ticket PRONUNCIATION: giảng viên không ticket => chỉ xem; có ticket OPEN => Thêm/Xoá, không Publish", async () => {
    vi.mocked(getTickets).mockResolvedValue([{ id: "t1", status: "OPEN", assignedId: "u-teacher-1", module: "WRITING" }] as never);
    const first = render(
      <Provider store={makeStore({ status: "authenticated", user: teacher })}>
        <ManagementShell area="instructor">
          <PronunciationManagePageContent />
        </ManagementShell>
      </Provider>,
    );
    await screen.findByText("Gói 1");
    expect(await screen.findByTestId("content-readonly-alert")).toHaveTextContent("Chế độ Xem duy nhất");
    expect(screen.queryByRole("button", { name: "Tạo package" })).toBeNull();
    first.unmount();
    resetContentAccessCache();
    vi.mocked(getTickets).mockResolvedValue([{ id: "t2", status: "OPEN", assignedId: "u-teacher-1", module: "PRONUNCIATION" }] as never);
    renderPage(PronunciationManagePageContent, teacher, "instructor");
    await screen.findByText("Gói 1");
    expect(await screen.findByRole("button", { name: "Tạo package" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xóa Gói 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Publish Gói/ })).toBeNull();
    expect(screen.queryByTestId("content-readonly-alert")).toBeNull();
  });

  it("trạng thái dữ liệu: chưa cấu hình => WAITING FOR BACKEND không toast; lỗi cấp mục => khối lỗi + Thử lại; công tắc ghi đóng => WriteLockedNotice", async () => {
    vi.mocked(client.listPackages).mockRejectedValueOnce(new ApiNotConfiguredError());
    const first = render(
      <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
        <ManagementShell area="admin">
          <PronunciationManagePageContent />
        </ManagementShell>
      </Provider>,
    );
    const waiting = await screen.findByTestId("content-packages-notice");
    expect(waiting).toHaveAttribute("data-kind", "waiting");
    expect(waiting).toHaveTextContent("quản lý phát âm chưa được kết nối API (WAITING FOR BACKEND)");
    expect(toast.error).not.toHaveBeenCalled();
    first.unmount();

    vi.mocked(client.listPackages).mockResolvedValue([pkg(1)]);
    vi.mocked(client.listItems).mockRejectedValueOnce(new ApiError("Lỗi mục", 500)).mockResolvedValue([item(1)]);
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "disabled");
    nav.set("/pronunciation/manage?packageId=p1&folderId=f1&studySetId=s1");
    renderPage(PronunciationManagePageContent);
    const notice = await screen.findByTestId("content-items-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(notice).toHaveTextContent("Lỗi mục");
    expect(screen.getByTestId("write-locked")).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.queryByRole("button", { name: "Thêm mục phát âm" })).toBeNull();
    await userEvent.click(within(notice).getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByTestId("pronunciation-preview")).toBeInTheDocument();
  });
});

describe("/pronunciation/manage/select-type", () => {
  it("chuyển hướng thay thế về /pronunciation/manage như Navigate replace của bản cũ; có liên kết dự phòng", async () => {
    nav.set("/pronunciation/manage/select-type");
    renderPage(PronunciationSelectTypePageContent);
    await waitFor(() => expect(nav.replace.at(-1)).toBe("/pronunciation/manage"));
    expect(nav.push).toHaveLength(0);
    expect(screen.getByTestId("pronunciation-select-type-redirect")).toHaveTextContent("Đang chuyển tới màn Quản lý Phát âm");
    expect(screen.getByRole("link", { name: "Mở Quản lý Phát âm" })).toHaveAttribute("href", "/pronunciation/manage");
    expect(document.querySelector(".content.manage-pronunciation-page")).not.toBeNull();
  });
});
