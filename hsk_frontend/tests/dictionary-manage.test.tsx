import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DictionaryManagePageContent } from "@/components/management/dictionary/dictionary-manage-page-content";
import { ManagementShell } from "@/components/management/management-shell";
import { confirmAction } from "@/components/shared/confirm-action";
import { resetContentAccessCache } from "@/hooks/use-content-access";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import * as client from "@/lib/api/dictionary-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { ManagementArea } from "@/lib/management/area";
import type { Vocabulary, VocabularyPage } from "@/types/dictionary";
import { adminUser } from "./fixtures/classes";

const nav = vi.hoisted(() => {
  let url = "/vocabulary/manage";
  const listeners = new Set<() => void>();
  return {
    push: [] as string[],
    replaced: [] as string[],
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
      nav.replaced.push(to);
      nav.set(to);
    },
    back: vi.fn(),
  }),
}));
vi.mock("@/lib/api/auth-client", () => ({ getCurrentUser: vi.fn(), logoutRemote: vi.fn() }));
vi.mock("@/lib/api/notification-client", () => ({ getUnreadCount: vi.fn(), fetchNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
vi.mock("@/lib/api/ticket-client", () => ({ getTickets: vi.fn() }));
vi.mock("@/components/shared/confirm-action", () => ({ confirmAction: vi.fn() }));
vi.mock("@/lib/api/dictionary-client", () => ({ searchVocabularies: vi.fn(), getVocabulary: vi.fn(), createVocabulary: vi.fn(), updateVocabulary: vi.fn(), deleteVocabulary: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

vi.setConfig({ testTimeout: 30_000 });

const teacher = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "gv1@example.test", roles: ["ROLE_TEACHER"] };
const vocab = (i: number, over: Partial<Vocabulary> = {}): Vocabulary => ({
  id: i,
  hanzi: `字${i}`,
  hskLevel: ((i - 1) % 6) + 1,
  isSingleVocab: true,
  radical: "口",
  strokeCount: 3 + i,
  status: "published",
  pinyins: [{ id: i * 10, pinyin: `zi${i}`, sinoVietnamese: `tự ${i}`, wordTypes: "Danh từ", isPrimary: true, measureWord: "个 [gè]", meanings: [{ id: i * 100, meaning: `nghĩa ${i}`, exampleSentenceCn: `例句${i}`, exampleSentenceVi: `ví dụ ${i}` }] }],
  ...over,
});
const page = (items: Vocabulary[], over: Partial<VocabularyPage> = {}): VocabularyPage => ({ items, totalElements: 25, totalPages: 3, page: 0, size: 10, ...over });
const firstPage = page(Array.from({ length: 10 }, (_, i) => vocab(i + 1)));

afterEach(() => {
  document.querySelectorAll("style[data-css-hash], style[data-rc-order]").forEach((node) => node.remove());
});

beforeEach(() => {
  resetContentAccessCache();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(confirmAction).mockReset().mockResolvedValue(true);
  for (const fn of Object.values(client)) vi.mocked(fn).mockReset();
  vi.mocked(client.searchVocabularies).mockResolvedValue(firstPage);
  vi.mocked(client.getVocabulary).mockImplementation(async (id) => vocab(Number(id), { etymologyStory: "chiết tự" }));
  vi.mocked(client.createVocabulary).mockResolvedValue(vocab(99));
  vi.mocked(client.updateVocabulary).mockResolvedValue(vocab(1));
  vi.mocked(client.deleteVocabulary).mockResolvedValue({});
  for (const fn of [toast.success, toast.error, toast.info]) vi.mocked(fn).mockClear();
  nav.push.length = 0;
  nav.replaced.length = 0;
  nav.set("/vocabulary/manage");
});

function renderPage(user = adminUser, area: ManagementArea = "admin") {
  return render(
    <Provider store={makeStore({ status: "authenticated", user })}>
      <ManagementShell area={area}>
        <DictionaryManagePageContent />
      </ManagementShell>
    </Provider>,
  );
}
const antModal = () => document.querySelector(".ant-modal") as HTMLElement;
const rows = () => screen.getAllByTestId("dictionary-row");

describe("màn Từ điển — tải và bộ lọc trong URL", () => {
  it("URL mặc định => search(keySearch '', page 0, size 10); bảng 10 dòng với Hán tự/Pinyin/HSK/Loại/Nghĩa; phân trang 'Hiển thị 1-10 / 25'; class trang", async () => {
    renderPage();
    await screen.findByText("字1");
    expect(client.searchVocabularies).toHaveBeenCalledWith({ keySearch: "", hskLevel: undefined, isSingleVocab: undefined, wordType: undefined, radical: undefined, page: 0, size: 10 });
    expect(rows()).toHaveLength(10);
    expect(rows()[0]).toHaveTextContent("zi1");
    expect(rows()[0]).toHaveTextContent("HSK 1");
    expect(rows()[0]).toHaveTextContent("Danh từ");
    expect(rows()[0]).toHaveTextContent("Từ đơn");
    expect(rows()[0]).toHaveTextContent("nghĩa 1");
    expect(screen.getByTestId("dictionary-pagination")).toHaveTextContent("Hiển thị 1-10 / 25 từ vựng");
    expect(document.querySelector(".content.manage-vocabulary-page.dictionary-manage-page")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Danh sách từ vựng" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thêm từ mới/ })).toBeInTheDocument();
  });

  it("đổi HSK => push ?hskLevel=2 và gọi lại; gõ tìm kiếm => replace ?keySearch sau 500ms; chuyển trang => page=2 => gửi page 1", async () => {
    renderPage();
    await screen.findByText("字1");
    await userEvent.selectOptions(screen.getByLabelText("Cấp độ HSK"), "2");
    expect(nav.push.at(-1)).toBe("/vocabulary/manage?hskLevel=2");
    await waitFor(() => expect(client.searchVocabularies).toHaveBeenLastCalledWith(expect.objectContaining({ hskLevel: 2, page: 0 })));
    await userEvent.type(screen.getByLabelText("Tìm kiếm"), "hao");
    expect(nav.replaced).toHaveLength(0); // chưa áp ngay
    await waitFor(() => expect(nav.replaced.at(-1)).toBe("/vocabulary/manage?keySearch=hao&hskLevel=2"), { timeout: 2000 });
    await waitFor(() => expect(client.searchVocabularies).toHaveBeenLastCalledWith(expect.objectContaining({ keySearch: "hao", hskLevel: 2 })));
    await userEvent.click(screen.getByTitle("2")); // antd Pagination: li[title="2"]
    await waitFor(() => expect(nav.push.at(-1)).toBe("/vocabulary/manage?keySearch=hao&hskLevel=2&page=2"));
    await waitFor(() => expect(client.searchVocabularies).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })));
  });

  it("URL lạ (hskLevel=9&page=abc) => bộ lọc về mặc định; mở rộng dòng hiện Hán Việt, lượng từ, ví dụ", async () => {
    nav.set("/vocabulary/manage?hskLevel=9&page=abc&isSingleVocab=true");
    renderPage();
    await screen.findByText("字1");
    expect(client.searchVocabularies).toHaveBeenCalledWith(expect.objectContaining({ hskLevel: undefined, isSingleVocab: true, page: 0 }));
    await userEvent.click(within(rows()[0]).getByText("字1"));
    const details = await screen.findByTestId("vocab-row-details");
    expect(details).toHaveTextContent("Hán Việt: tự 1");
    expect(details).toHaveTextContent("Lượng từ: 个 [gè]");
    expect(details).toHaveTextContent("例句1");
    expect(details).toHaveTextContent("VN: ví dụ 1");
    expect(details).toHaveTextContent("Chưa có thông tin chiết tự");
  });
});

describe("màn Từ điển — thao tác ghi", () => {
  it("Thêm từ mới: thiếu Hán tự => toast + ở tab Thông tin; thiếu nghĩa => chuyển tab Nghĩa; đủ => createVocabulary(payload) + toast + tải lại", async () => {
    renderPage();
    await screen.findByText("字1");
    await userEvent.click(screen.getByRole("button", { name: /Thêm từ mới/ }));
    const modal = antModal();
    expect(within(modal).getByTestId("vocabulary-form")).toBeInTheDocument();
    await userEvent.click(within(modal).getByRole("button", { name: "Tạo mới" }));
    expect(toast.error).toHaveBeenCalledWith("Vui lòng nhập Hán tự!");
    await userEvent.type(within(modal).getByLabelText(/Hán tự/), "朋友");
    await userEvent.type(within(modal).getByLabelText(/^Pinyin/), "péngyou");
    await userEvent.type(within(modal).getByLabelText("Hán Việt"), "bằng hữu");
    await userEvent.click(within(modal).getByRole("button", { name: "Danh từ" }));
    await userEvent.click(within(modal).getByRole("radio", { name: "Từ ghép" }));
    await userEvent.click(within(modal).getByRole("button", { name: "Tạo mới" }));
    expect(toast.error).toHaveBeenCalledWith("Vui lòng nhập đầy đủ các nghĩa!");
    expect(within(modal).getByTestId("vocab-tab-meaning")).toBeInTheDocument(); // tự chuyển tab
    await userEvent.type(within(modal).getByLabelText(/Nghĩa \(Tiếng Việt\)/), "bạn");
    await userEvent.type(within(modal).getByLabelText("Câu ví dụ (Hán tự)"), "他是我的朋友。");
    await userEvent.click(within(modal).getByRole("button", { name: "Tạo mới" }));
    await waitFor(() => expect(client.createVocabulary).toHaveBeenCalledTimes(1));
    const [payload, demo] = vi.mocked(client.createVocabulary).mock.calls[0];
    expect(demo).toBe(false);
    expect(payload).toMatchObject({ hanzi: "朋友", hskLevel: 1, isSingleVocab: false, status: "draft" });
    expect(payload.pinyins).toEqual([expect.objectContaining({ pinyin: "péngyou", sinoVietnamese: "bằng hữu", wordTypes: "Danh từ", isPrimary: true, meanings: [expect.objectContaining({ meaning: "bạn", exampleSentenceCn: "他是我的朋友。" })] })]);
    expect(toast.success).toHaveBeenCalledWith("Thêm mới thành công!");
    await waitFor(() => expect(client.searchVocabularies).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(document.querySelector(".ant-modal")).toBeNull());
  });

  it("Sửa: tải chi tiết (getVocabulary) rồi mở modal có dữ liệu; đổi nghĩa => updateVocabulary(id, payload)", async () => {
    renderPage();
    await screen.findByText("字1");
    await userEvent.click(screen.getByRole("button", { name: "Chỉnh sửa 字2" }));
    await waitFor(() => expect(client.getVocabulary).toHaveBeenCalledWith(2));
    const modal = await waitFor(() => {
      const m = antModal();
      if (!m) throw new Error("modal chưa mở");
      return m;
    });
    expect(within(modal).getByLabelText(/Hán tự/)).toHaveValue("字2");
    expect(within(modal).getByLabelText(/^Pinyin/)).toHaveValue("zi2");
    await userEvent.click(within(modal).getByRole("tab", { name: "Nghĩa & Ví dụ" }));
    const meaning = within(modal).getByLabelText(/Nghĩa \(Tiếng Việt\)/);
    expect(meaning).toHaveValue("nghĩa 2");
    await userEvent.clear(meaning);
    await userEvent.type(meaning, "nghĩa mới");
    await userEvent.click(within(modal).getByRole("tab", { name: "Media & Chi tiết" }));
    expect(within(modal).getByLabelText("Chiết tự (nguồn gốc)")).toHaveValue("chiết tự");
    await userEvent.click(within(modal).getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(client.updateVocabulary).toHaveBeenCalledWith(2, expect.objectContaining({ hanzi: "字2", strokeCount: 5, etymologyStory: "chiết tự" }), false));
    expect(vi.mocked(client.updateVocabulary).mock.calls[0][1].pinyins[0].meanings[0].meaning).toBe("nghĩa mới");
    expect(toast.success).toHaveBeenCalledWith("Cập nhật thành công!");
  });

  it("Xoá: huỷ => không gọi; đồng ý => deleteVocabulary + toast; Import Excel => toast chưa chuyển", async () => {
    vi.mocked(confirmAction).mockResolvedValueOnce(false);
    renderPage();
    await screen.findByText("字1");
    await userEvent.click(screen.getByRole("button", { name: "Xóa 字3" }));
    await waitFor(() => expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xác nhận xóa", okText: "Xóa ngay", danger: true })));
    expect(client.deleteVocabulary).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Xóa 字3" }));
    await waitFor(() => expect(client.deleteVocabulary).toHaveBeenCalledWith(3, false));
    expect(toast.success).toHaveBeenCalledWith("Xóa từ vựng thành công");
    await userEvent.click(screen.getByRole("button", { name: /Import từ Excel/ }));
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("chưa được chuyển"));
  });
});

describe("màn Từ điển — trạng thái và quyền", () => {
  it("chưa cấu hình => WAITING FOR BACKEND, không toast; lỗi => Thử lại; items không phải mảng => lỗi hợp đồng; rỗng => 'Không tìm thấy từ vựng nào'", async () => {
    vi.mocked(client.searchVocabularies).mockRejectedValueOnce(new ApiNotConfiguredError()).mockRejectedValueOnce(new ApiError("Máy chủ lỗi", 500)).mockResolvedValueOnce({ items: "x" } as never).mockResolvedValue(page([], { totalElements: 0, totalPages: 0 }));
    renderPage();
    const waiting = await screen.findByTestId("dictionary-notice");
    expect(waiting).toHaveAttribute("data-kind", "waiting");
    expect(toast.error).not.toHaveBeenCalled();
    // không có nút Thử lại ở waiting => đổi bộ lọc để tải lại
    await userEvent.selectOptions(screen.getByLabelText("Cấu trúc từ"), "true");
    const error = await screen.findByText("Máy chủ lỗi");
    await userEvent.click(within(error.closest("[data-testid=dictionary-notice]") as HTMLElement).getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Dữ liệu trả về không đúng định dạng danh sách từ vựng.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByTestId("dictionary-empty")).toHaveTextContent("Không tìm thấy từ vựng nào");
    expect(screen.queryByTestId("dictionary-pagination")).toBeNull();
  });

  it("giảng viên không có ticket DICTIONARY => Alert chỉ xem, không nút ghi; có ticket => có nút; công tắc ghi đóng => WriteLockedNotice", async () => {
    vi.mocked(getTickets).mockResolvedValue([{ id: "t1", status: "OPEN", assignedId: "u-teacher-1", module: "QUIZ" }] as never);
    const first = renderPage(teacher, "instructor");
    await screen.findByText("字1");
    expect(await screen.findByTestId("content-readonly-alert")).toHaveTextContent("Chế độ Xem duy nhất");
    expect(screen.queryByRole("button", { name: /Thêm từ mới/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xóa 字1" })).toBeNull();
    first.unmount();

    resetContentAccessCache();
    vi.mocked(getTickets).mockResolvedValue([{ id: "t2", status: "DONE", assignedId: "u-teacher-1", module: "DICTIONARY" }] as never);
    const second = renderPage(teacher, "instructor");
    await screen.findByText("字1");
    expect(await screen.findByRole("button", { name: /Thêm từ mới/ })).toBeInTheDocument();
    expect(screen.queryByTestId("content-readonly-alert")).toBeNull();
    second.unmount();

    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "");
    renderPage();
    await screen.findByText("字1");
    expect(screen.getByTestId("write-locked")).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.queryByRole("button", { name: /Thêm từ mới/ })).toBeNull();
  });
});
