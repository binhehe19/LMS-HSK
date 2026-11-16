import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FlashcardSetEditorPageContent } from "@/components/management/content-flashcard/flashcard-set-editor-page-content";
import { FlashcardPreview } from "@/components/management/content-flashcard/flashcard-preview";
import { FLASHCARD_CONFIG, VOCAB_SET_CONFIG } from "@/components/management/content-flashcard/flashcard-config";
import { ManagementShell } from "@/components/management/management-shell";
import { resetContentAccessCache } from "@/hooks/use-content-access";
import { ApiNotConfiguredError } from "@/lib/api/api-client";
import * as client from "@/lib/api/content-tree-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { FlashcardCard, FlashcardCardInput } from "@/types/content-flashcard";
import { adminUser } from "./fixtures/classes";

const nav = vi.hoisted(() => {
  let url = "/sets/create";
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
  useRouter: () => ({ push: (to: string) => nav.push.push(to), replace: (to: string) => nav.set(to), back: vi.fn() }),
}));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/notification-client", () => ({ getUnreadCount: vi.fn(), fetchNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
vi.mock("@/lib/api/content-tree-client", () => ({
  listPackages: vi.fn(),
  listFolders: vi.fn(),
  getFolder: vi.fn(),
  getStudySet: vi.fn(),
  createStudySet: vi.fn(),
  updateStudySet: vi.fn(),
  listItems: vi.fn(),
  createItemsBulk: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

// Trang có sidebar + nhiều form trong jsdom chạy chậm hơn 5 giây mặc định.
vi.setConfig({ testTimeout: 30_000 });

const TARGET = { apiPrefix: "/flashcard", itemsPath: "cards" };
const card = (i: number, over: Partial<FlashcardCard> = {}): FlashcardCard => ({ id: `c${i}`, studySetId: "s1", index: i - 1, term: `词${i}`, meaning: `nghĩa ${i}`, pinyin: `cí ${i}`, ...over });

beforeEach(() => {
  resetContentAccessCache();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  for (const fn of Object.values(client)) if (typeof fn === "function" && "mockReset" in fn) vi.mocked(fn as unknown as ReturnType<typeof vi.fn>).mockReset();
  vi.mocked(client.listPackages).mockResolvedValue([{ id: "p1", name: "Gói 1", type: "FREE" }, { id: "p2", name: "Gói 2", type: "FREE" }]);
  vi.mocked(client.listFolders).mockImplementation(async (_t, packageId) => (packageId === "p1" ? [{ id: "f1", packageId: "p1", name: "Thư mục 1" }] : [{ id: "f2", packageId: "p2", name: "Thư mục 2" }]));
  vi.mocked(client.getFolder).mockResolvedValue({ id: "f1", packageId: "p1", name: "Thư mục 1" });
  vi.mocked(client.getStudySet).mockResolvedValue({ id: "s1", folderId: "f1", title: "Bộ 1", description: "Mô tả bộ" });
  vi.mocked(client.listItems).mockResolvedValue([card(1), card(2)]);
  vi.mocked(client.createStudySet).mockResolvedValue({ id: "s-new", folderId: "f1", title: "Bộ mới" });
  vi.mocked(client.createItemsBulk).mockResolvedValue([]);
  vi.mocked(client.updateStudySet).mockResolvedValue({ id: "s1", folderId: "f1", title: "Bộ 1" });
  vi.mocked(client.updateItem).mockResolvedValue(card(1));
  vi.mocked(client.deleteItem).mockResolvedValue({});
  for (const fn of [toast.success, toast.error]) vi.mocked(fn).mockClear();
  nav.push.length = 0;
  nav.set("/sets/create");
});

function renderEditor(studySetId?: string) {
  render(
    <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
      <ManagementShell area="admin">
        <FlashcardSetEditorPageContent studySetId={studySetId} />
      </ManagementShell>
    </Provider>,
  );
}

const items = () => screen.getAllByTestId("set-editor-item");

describe("/sets/create — tạo bộ thẻ kèm thẻ", () => {
  it("chọn trước gói/thư mục từ query; một thẻ trống sẵn; thiếu tên => lỗi; lưu => createStudySet rồi createItemsBulk theo thứ tự; về returnUrl", async () => {
    nav.set(`/sets/create?packageId=p1&folderId=f1&returnUrl=${encodeURIComponent("/flashcard/package?packageId=p1&folderId=f1")}`);
    renderEditor();
    expect(await screen.findByDisplayValue("Gói 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Thư mục")).toHaveValue("f1");
    expect(items()).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Quay lại" })).toHaveAttribute("href", "/flashcard/package?packageId=p1&folderId=f1");
    await userEvent.click(screen.getByTestId("set-editor-save"));
    expect(toast.error).toHaveBeenCalledWith("Vui lòng nhập tên Bộ học");
    expect(client.createStudySet).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Tên Bộ học"), "Bài 1");
    await userEvent.click(screen.getByTestId("set-editor-save"));
    expect(toast.error).toHaveBeenCalledWith("Thẻ 1: Vui lòng nhập chữ Hán");
    await userEvent.type(within(items()[0]).getByLabelText(/Chữ Hán/), "你好");
    await userEvent.type(within(items()[0]).getByLabelText(/Nghĩa tiếng Việt/), "xin chào");
    await userEvent.type(within(items()[0]).getByLabelText(/^Pinyin\s*\*/), "nǐ hǎo");
    await userEvent.click(screen.getByTestId("set-editor-add"));
    expect(items()).toHaveLength(2);
    await userEvent.type(within(items()[1]).getByLabelText(/Chữ Hán/), "谢谢");
    await userEvent.type(within(items()[1]).getByLabelText(/Nghĩa tiếng Việt/), "cảm ơn");
    await userEvent.type(within(items()[1]).getByLabelText(/^Pinyin\s*\*/), "xièxie");
    await userEvent.click(screen.getByTestId("set-editor-save"));
    await waitFor(() => expect(client.createStudySet).toHaveBeenCalledWith(TARGET, { folderId: "f1", title: "Bài 1", description: undefined, isPrivate: true, skill: undefined }, false));
    await waitFor(() => expect(client.createItemsBulk).toHaveBeenCalledTimes(1));
    const [, setId, inputs] = vi.mocked(client.createItemsBulk).mock.calls[0];
    expect(setId).toBe("s-new");
    expect((inputs as FlashcardCardInput[]).map((i) => [i.term, i.meaning, i.index])).toEqual([["你好", "xin chào", 0], ["谢谢", "cảm ơn", 1]]);
    expect(toast.success).toHaveBeenCalledWith("Tạo Bộ học thành công!");
    expect(nav.push.at(-1)).toBe("/flashcard/package?packageId=p1&folderId=f1");
  });

  it("đổi gói => thư mục về rỗng và tải thư mục gói mới; 'Nhập nhanh' thêm thẻ từ văn bản; xoá thẻ", async () => {
    renderEditor();
    await screen.findByText("Gói 1", { selector: "option" });
    await userEvent.selectOptions(screen.getByLabelText("Package"), "p2");
    await waitFor(() => expect(client.listFolders).toHaveBeenCalledWith(TARGET, "p2"));
    expect(await screen.findByText("Thư mục 2", { selector: "option" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Nhập nhanh/ }));
    await userEvent.type(screen.getByLabelText(/Mỗi dòng một thẻ/), "你好,xin chào,nǐ hǎo{enter}dòng lỗi");
    await userEvent.click(screen.getByRole("button", { name: "Thêm từ văn bản" }));
    expect(toast.success).toHaveBeenCalledWith("Đã thêm 1 thẻ; bỏ 1 dòng thiếu dữ liệu");
    expect(items()).toHaveLength(2);
    expect(within(items()[1]).getByLabelText(/Chữ Hán/)).toHaveValue("你好");
    await userEvent.click(within(items()[0]).getByRole("button", { name: "Xóa thẻ 1" }));
    expect(items()).toHaveLength(1);
    expect(within(items()[0]).getByLabelText(/^Pinyin\s*\*/)).toHaveValue("nǐ hǎo");
  });

  it("returnUrl ngoài (https) bị bỏ, quay về màn cây mặc định; không returnUrl => sau khi lưu mở bộ vừa tạo trong cây", async () => {
    nav.set("/sets/create?packageId=p1&folderId=f1&returnUrl=https%3A%2F%2Fevil.test%2F");
    renderEditor();
    await screen.findByDisplayValue("Gói 1");
    expect(screen.getByRole("link", { name: "Quay lại" })).toHaveAttribute("href", "/flashcard/package?packageId=p1&folderId=f1");
    await userEvent.type(screen.getByLabelText("Tên Bộ học"), "B");
    await userEvent.type(within(items()[0]).getByLabelText(/Chữ Hán/), "一");
    await userEvent.type(within(items()[0]).getByLabelText(/Nghĩa tiếng Việt/), "một");
    await userEvent.type(within(items()[0]).getByLabelText(/^Pinyin\s*\*/), "yī");
    await userEvent.click(screen.getByTestId("set-editor-save"));
    await waitFor(() => expect(nav.push.at(-1)).toBe("/flashcard/package?packageId=p1&folderId=f1&studySetId=s-new"));
  });
});

describe("/sets/:id/edit — sửa bộ thẻ", () => {
  it("tải bộ + thẻ + thư mục; chỉ gửi PUT cho thẻ đổi, DELETE thẻ bỏ, bulk thẻ mới; cập nhật bộ", async () => {
    nav.set("/sets/s1/edit");
    renderEditor("s1");
    expect(await screen.findByDisplayValue("Bộ 1")).toBeInTheDocument();
    expect(client.getStudySet).toHaveBeenCalledWith(TARGET, "s1");
    expect(client.listItems).toHaveBeenCalledWith(TARGET, "s1");
    expect(screen.getByText("Thư mục 1")).toBeInTheDocument();
    expect(items()).toHaveLength(2);
    await userEvent.clear(within(items()[0]).getByLabelText(/Nghĩa tiếng Việt/));
    await userEvent.type(within(items()[0]).getByLabelText(/Nghĩa tiếng Việt/), "nghĩa đã sửa");
    await userEvent.click(within(items()[1]).getByRole("button", { name: "Xóa thẻ 2" }));
    await userEvent.click(screen.getByTestId("set-editor-add"));
    await userEvent.type(within(items()[1]).getByLabelText(/Chữ Hán/), "新");
    await userEvent.type(within(items()[1]).getByLabelText(/Nghĩa tiếng Việt/), "mới");
    await userEvent.type(within(items()[1]).getByLabelText(/^Pinyin\s*\*/), "xīn");
    await userEvent.click(screen.getByTestId("set-editor-save"));
    await waitFor(() => expect(client.updateStudySet).toHaveBeenCalledWith(TARGET, "s1", { folderId: "f1", title: "Bộ 1", description: "Mô tả bộ", isPrivate: true, skill: undefined }, false));
    await waitFor(() => expect(client.updateItem).toHaveBeenCalledTimes(1));
    expect(client.updateItem).toHaveBeenCalledWith(TARGET, "c1", expect.objectContaining({ term: "词1", meaning: "nghĩa đã sửa", index: 0 }), false);
    expect(client.deleteItem).toHaveBeenCalledWith(TARGET, "c2", false);
    expect(client.createItemsBulk).toHaveBeenCalledWith(TARGET, "s1", [expect.objectContaining({ term: "新", meaning: "mới", index: 1 })], false);
    expect(toast.success).toHaveBeenCalledWith("Cập nhật Bộ học thành công!");
    expect(nav.push.at(-1)).toBe("/flashcard/package?packageId=p1&folderId=f1&studySetId=s1");
  });

  it("id không hợp lệ => thông báo, không gọi API; dịch vụ chưa cấu hình => WAITING FOR BACKEND", async () => {
    nav.set("/sets/..%2Fx/edit");
    renderEditor("../x");
    expect(await screen.findByTestId("set-editor-invalid-id")).toBeInTheDocument();
    expect(client.getStudySet).not.toHaveBeenCalled();
  });

  it("dịch vụ chưa cấu hình => khối WAITING FOR BACKEND, không form", async () => {
    vi.mocked(client.getStudySet).mockRejectedValue(new ApiNotConfiguredError());
    nav.set("/sets/s1/edit");
    renderEditor("s1");
    const notice = await screen.findByTestId("set-editor-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(screen.queryByTestId("set-editor-save")).toBeNull();
  });
});

describe("config module Thẻ ghi nhớ / Bộ từ vựng và thẻ lật", () => {
  it("FLASHCARD_CONFIG: module FLASHCARD, /flashcard + cards, 4 loại gói, tab tìm toàn cây, trang sửa bộ; VOCAB_SET_CONFIG chỉ đổi nhãn/tiêu đề và bỏ thẻ lật", () => {
    expect(FLASHCARD_CONFIG).toMatchObject({ module: "FLASHCARD", apiPrefix: "/flashcard", itemsPath: "cards", pageClassName: "manage-flashcard-page", supportsImport: true });
    expect(FLASHCARD_CONFIG.packageTypes.map((t) => t.value)).toEqual(["LEARNING_PATH", "LEARNING", "VIDEO_COURSE", "FREE"]);
    expect(FLASHCARD_CONFIG.itemSearchTab?.label).toBe("Quản lý từ vựng");
    expect(FLASHCARD_CONFIG.setEditorRoutes?.create("p 1", "f1")).toBe("/sets/create?packageId=p%201&folderId=f1");
    expect(FLASHCARD_CONFIG.setEditorRoutes?.edit("s1")).toBe("/sets/s1/edit");
    expect(FLASHCARD_CONFIG.itemColumns.map((c) => c.key)).toEqual(["term", "meaning", "audio"]);
    expect(VOCAB_SET_CONFIG).toMatchObject({ module: "FLASHCARD", apiPrefix: "/flashcard", itemsPath: "cards", title: "Quản lý Từ vựng", pageClassName: "manage-vocabulary-page", labels: { studySet: "Bộ từ vựng", item: "Từ" } });
    expect(VOCAB_SET_CONFIG.ItemPreview).toBeUndefined();
    expect(VOCAB_SET_CONFIG.ItemForm).toBe(FLASHCARD_CONFIG.ItemForm);
  });

  it("thẻ lật: mặt trước chữ Hán/pinyin/từ loại, bấm => lật sang mặt sau với nghĩa/ví dụ; thiếu dữ liệu hiện chữ 'Chưa có ...' của bản cũ", async () => {
    render(<FlashcardPreview item={card(1, { pinyin: "cí yī", wordType: "danh từ", example: "例句", exampleMeaning: undefined })} />);
    const viewer = screen.getByTestId("flashcard-preview");
    expect(viewer).toHaveAttribute("data-flipped", "false");
    expect(within(viewer).getByRole("heading", { level: 2 })).toHaveTextContent("词1");
    expect(within(viewer).getByText("cí yī")).toBeInTheDocument();
    expect(within(viewer).getByText("danh từ")).toBeInTheDocument();
    expect(within(viewer).getByText("nghĩa 1")).toBeInTheDocument();
    expect(within(viewer).getByText("例句")).toBeInTheDocument();
    expect(within(viewer).getByText("Chưa có bản dịch")).toBeInTheDocument();
    await userEvent.click(viewer);
    expect(viewer).toHaveAttribute("data-flipped", "true");
    expect(viewer.querySelector(".flashcard-inner")).toHaveClass("flipped");
  });
});
