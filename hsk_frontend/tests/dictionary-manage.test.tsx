import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import * as client from "@/lib/api/lms-dictionary-client";
import { syncPublishedToPackages } from "@/lib/api/library-sync-client";
import { uploadFile } from "@/lib/api/storage-client";
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
// Khung "Cấu tạo & minh họa" tải dữ liệu nét qua CDN: trong test không có dữ liệu, không gọi mạng thật.
vi.mock("@/components/management/dictionary/hanzi-structure-svg", () => ({ HanziStructureSvg: () => null }));
vi.mock("@/components/shared/rich-text-editor", () => ({
  RichTextEditor: ({ label, text, readOnly, onChange }: { label: string; text: string; readOnly?: boolean; onChange: (text: string, html?: string) => void }) => (
    <textarea aria-label={label} value={text} readOnly={readOnly} onChange={event => onChange(event.target.value)} />
  ),
}));
vi.mock("@/components/shared/confirm-action", () => ({ confirmAction: vi.fn() }));
vi.mock("@/lib/api/lms-dictionary-client", () => ({ searchVocabularies: vi.fn(), getVocabulary: vi.fn(), createVocabulary: vi.fn(), updateVocabulary: vi.fn(), deleteVocabulary: vi.fn() }));
vi.mock("@/lib/api/storage-client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/storage-client")>(),
  uploadFile: vi.fn(),
}));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), loading: vi.fn(() => "saving"), dismiss: vi.fn() } }));
vi.mock("@/lib/api/library-sync-client", () => ({ syncPublishedToPackages: vi.fn() }));

vi.setConfig({ testTimeout: 30_000 });

const teacher = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "gv1@example.test", roles: ["ROLE_TEACHER"] };
const vocab = (i: number, over: Partial<Vocabulary> = {}): Vocabulary => ({
  id: String(i),
  hanzi: `字${i}`,
  hskLevel: ((i - 1) % 6) + 1,
  isSingleVocab: true,
  radical: "口",
  status: "published",
  pinyins: [{ id: String(i * 10), pinyin: `zi${i}`, sinoVietnamese: `tự ${i}`, wordTypes: "Danh từ", isPrimary: true, measureWord: "个 [gè]", meanings: [{ id: String(i * 100), meaning: `nghĩa ${i}`, examples: [{ zh: `例句${i}`, vi: `ví dụ ${i}` }] }] }],
  ...over,
});
const page = (items: Vocabulary[], over: Partial<VocabularyPage> = {}): VocabularyPage => ({ items, totalElements: 25, totalPages: 2, page: 0, size: 20, ...over });
const firstPage = page([vocab(1), vocab(2), vocab(3)]);

afterEach(() => {
  document.querySelectorAll("style[data-css-hash], style[data-rc-order]").forEach((node) => node.remove());
  vi.unstubAllGlobals();
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
  vi.mocked(client.getVocabulary).mockImplementation(async (id) => vocab(Number(id), { id: String(id), etymologyStory: "chiết tự" }));
  vi.mocked(client.createVocabulary).mockResolvedValue(vocab(99));
  vi.mocked(client.updateVocabulary).mockResolvedValue(vocab(1));
  vi.mocked(client.deleteVocabulary).mockResolvedValue(undefined);
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
const rows = () => within(screen.getByTestId("dictionary-table")).getAllByRole("row").filter(row => row.hasAttribute("data-row-key"));
async function selectFilter(label: string, option: string) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByText(option, { selector: ".ant-select-item-option-content" }));
}
async function rowAction(hanzi: string, action: string) {
  await userEvent.click(screen.getByRole("button", { name: `Thao tác ${hanzi}` }));
  await userEvent.click(await screen.findByRole("menuitem", { name: action }));
}

describe("màn Từ điển — tải và bộ lọc trong URL", () => {
  it("URL mặc định tải 20 dòng, hiển thị cột từ điển và tổng bản ghi", async () => {
    vi.mocked(client.searchVocabularies).mockResolvedValueOnce(page(Array.from({ length: 20 }, (_, i) => vocab(i + 1))));
    renderPage();
    await screen.findByText("字1");
    expect(client.searchVocabularies).toHaveBeenCalledWith({ keySearch: "", hskLevel: undefined, isSingleVocab: undefined, wordType: undefined, page: 0, size: 20 });
    expect(rows()).toHaveLength(20);
    expect(rows()[0]).toHaveTextContent("zi1");
    expect(rows()[0]).toHaveTextContent("HSK 1");
    expect(rows()[0]).toHaveTextContent("Danh từ");
    expect(within(rows()[0]).getByText("HSK 1")).toHaveClass("ant-tag-borderless");
    expect(rows()[0]).toHaveTextContent("Từ đơn");
    expect(rows()[0]).toHaveTextContent("nghĩa 1");
    expect(screen.getByText("25 bản ghi")).toBeInTheDocument();
    expect(document.querySelector(".content.dictionary-manage-page")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Từ điển" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thêm từ mới/ })).toBeInTheDocument();
  });

  it("xếp các cột tìm kiếm cạnh nhau và hiển thị kết quả không tô nền", async () => {
    vi.mocked(client.searchVocabularies).mockResolvedValue(page([
      vocab(1, { hanzi: "唯" }),
      vocab(2, { hanzi: "唯一" }),
    ]));
    nav.set("/vocabulary/manage?keySearch=%E5%94%AF");
    renderPage();
    await screen.findByText("唯");
    const table = screen.getByTestId("dictionary-table");
    expect(within(table).getAllByRole("columnheader").map(header => header.textContent))
      .toEqual(["STT", "Hán tự", "Pinyin", "Bộ thủ", "Cấp độ", "Loại", "Nghĩa chính", "Thao tác"]);
    expect(within(rows()[0]).getByText("唯").tagName).toBe("SPAN");
    expect(table.querySelector("tbody mark")).toBeNull();
  });

  it("nhóm các dòng Pinyin theo Hán tự và giữ từ loại, nghĩa đúng theo cách đọc", async () => {
    const speak = vi.fn();
    const audio = vi.fn(function () { return { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn() }; });
    vi.stubGlobal("Audio", audio);
    vi.stubGlobal("speechSynthesis", { speak, cancel: vi.fn(), getVoices: () => [{ lang: "zh-CN", name: "Mandarin" }] });
    vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
    const word = vocab(1, { hanzi: "行", hskLevel: undefined, etymologyStory: "Chiết tự của từ", imageUrl: "/illustration.png", pinyins: [
      {
        pinyin: "háng", audioUrl: "/hang.mp3", wordTypes: "Danh từ", sinoVietnamese: "hàng", measureWord: "家",
        compounds: JSON.stringify([{ hanzi: "银行" }]),
        synonyms: JSON.stringify([{ hanzi: "列" }]),
        antonyms: JSON.stringify([{ hanzi: "乱" }]),
        notes: "Ghi chú cách đọc háng",
        meanings: [{ meaning: "hàng", examples: [{ zh: "一行字。" }, { zh: "他在银行工作。" }] }],
      },
      {
        pinyin: "xíng", isPrimary: true, wordTypes: "Động từ,Tính từ", sinoVietnamese: "hành",
        meanings: [{ meaning: "đi", exampleWordType: "Động từ", examples: [{ zh: "请前行。" }] }],
      },
    ] });
    vi.mocked(client.searchVocabularies).mockResolvedValue(page([word, vocab(2, { hanzi: "银行", isSingleVocab: false, pinyins: [] })]));
    renderPage();
    await screen.findByText("行");
    const [primary, alternate, compound] = rows();
    const hanziCell = within(primary).getByRole("cell", { name: /行/ });
    expect(hanziCell).toHaveAttribute("rowspan", "2");
    expect(within(primary).getByText("Từ đơn").closest("td")).toHaveTextContent("Từ đơnĐộng từTính từ");
    expect(primary).toHaveTextContent("xíng");
    expect(within(primary).getByText("đi")).toBeInTheDocument();
    expect(alternate).toHaveTextContent("háng");
    expect(alternate).toHaveTextContent("Danh từ");
    expect(within(alternate).getByText("hàng")).toBeInTheDocument();
    expect(alternate).not.toHaveTextContent("Từ đơn");
    expect(compound).toHaveTextContent("Từ ghép");
    expect(within(compound).getAllByRole("cell")[0]).toHaveTextContent("2");
    expect(screen.getAllByRole("button", { name: "Thao tác 行" })).toHaveLength(1);

    fireEvent.click(within(alternate).getByText("háng"));
    const inlineDetails = within(screen.getByTestId("dictionary-table")).getByTestId("vocab-row-details");
    expect(inlineDetails.closest("tr")).toBe(alternate.nextElementSibling);
    const expanded = within(inlineDetails);
    const inlineImage = expanded.getByRole("img", { name: "Ảnh minh họa cho 行" });
    fireEvent.error(inlineImage);
    expect(expanded.getByRole("status")).toHaveTextContent("Không xem được ảnh hiện tại");
    expect(inlineImage).not.toBeInTheDocument();
    expect(expanded.getByRole("tab", { name: "xíng" })).toHaveAttribute("aria-selected", "true");
    expect(inlineDetails).toHaveTextContent("Hán Việt: hành");
    expect(expanded.getByText("请前行。")).toBeVisible();
    expect(expanded.queryByText("一行字。")).not.toBeInTheDocument();
    const pronounce = expanded.getByRole("button", { name: "Phát âm" });
    fireEvent.click(pronounce);
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: "xíng", lang: "zh-CN" }));
    expect(audio).not.toHaveBeenCalled();
    const tableTag = within(primary).getByText("Động từ");
    const exampleTag = expanded.getByText("Động từ");
    expect(exampleTag).toHaveClass("ant-tag");
    expect(exampleTag.getAttribute("style")).toBe(tableTag.getAttribute("style"));

    fireEvent.click(expanded.getByRole("tab", { name: "háng" }));
    fireEvent.click(pronounce);
    expect(audio).toHaveBeenCalledWith("/hang.mp3");
    expect(speak).toHaveBeenCalledTimes(1);
    const selectedPanel = expanded.getByRole("tabpanel", { name: "háng" });
    for (const value of ["Hán Việt: hàng", "Lượng từ: 家", "银行", "Đồng nghĩa: 列", "Trái nghĩa: 乱", "Ghi chú cách đọc háng", "一行字。", "他在银行工作。"]) {
      expect(selectedPanel).toHaveTextContent(value);
    }
    expect(selectedPanel).not.toHaveTextContent("请前行。");

    fireEvent.click(within(inlineDetails).getByRole("button", { name: "Xem chi tiết" }));
    const dialog = await screen.findByRole("dialog", { name: "Chi tiết từ vựng 行" });
    const form = within(dialog);
    expect(client.getVocabulary).not.toHaveBeenCalled();
    expect(form.getAllByRole("tab").map(tab => tab.textContent)).toEqual([
      "Thông tin", "Nghĩa & Ví dụ2", "Từ ghép1", "Lượng từ & liên quan2", "Media & Chi tiết",
    ]);
    expect(form.getByLabelText(/Hán tự/)).toHaveAttribute("readonly");
    expect(form.getByLabelText("HSK")).toHaveDisplayValue("—");
    expect(form.getByLabelText("HSK")).toBeDisabled();
    const structure = within(form.getByRole("radiogroup", { name: "Cấu trúc" }));
    expect(structure.getByRole("radio", { name: "Từ đơn" })).toBeDisabled();
    expect(structure.getByRole("radio", { name: "Từ ghép" })).toBeDisabled();
    expect(form.getByRole("combobox", { name: /^Loại từ của/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Lưu & Xuất bản" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu Nháp" })).not.toBeInTheDocument();
    const meaningsTab = form.getByRole("tab", { name: /^Nghĩa & Ví dụ/ });
    fireEvent.click(meaningsTab);
    fireEvent.click(form.getByRole("button", { name: /xíng/ }));
    expect(within(meaningsTab).getByText("2")).toBeInTheDocument();
    expect(form.getByLabelText("Nghĩa (Tiếng Việt)")).toHaveValue("đi");
    expect(form.getByLabelText("Loại từ", { exact: true })).toBeDisabled();
    expect(form.queryByRole("button", { name: /^Thêm/ })).not.toBeInTheDocument();
    for (const name of [/^Từ ghép/, /^Lượng từ & liên quan/]) {
      fireEvent.click(form.getByRole("tab", { name }));
      expect(form.queryByRole("button", { name: /^Thêm/ })).not.toBeInTheDocument();
    }
    fireEvent.click(form.getByRole("tab", { name: "Media & Chi tiết" }));
    expect(form.getByRole("region", { name: "Thứ tự nét viết" })).toBeInTheDocument();
    const image = form.getByRole("img", { name: "Ảnh minh họa cho 行" });
    const preview = image.closest<HTMLDivElement>(".content-image-preview")!;
    fireEvent.error(image);
    expect(within(preview).getByText("Không xem được ảnh hiện tại")).toBeInTheDocument();
    expect(within(preview).queryByRole("button")).not.toBeInTheDocument();
    expect(form.getByLabelText("Chiết tự (nguồn gốc)")).toHaveValue("Chiết tự của từ");
    expect(rows()).toHaveLength(3);
  }, 60_000);

  it("đổi HSK => push ?hskLevel=2 và gọi lại; gõ tìm kiếm => replace ?keySearch sau 500ms; chuyển trang => page=2 => gửi page 1", async () => {
    renderPage();
    await screen.findByText("字1");
    await selectFilter("Cấp độ HSK", "HSK 2");
    expect(nav.push.at(-1)).toBe("/vocabulary/manage?hskLevel=2");
    await waitFor(() => expect(client.searchVocabularies).toHaveBeenLastCalledWith(expect.objectContaining({ hskLevel: 2, page: 0 })));
    expect(screen.queryByRole("textbox", { name: "Bộ thủ" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Tìm kiếm"), "口");
    expect(nav.replaced).toHaveLength(0); // chưa áp ngay
    await waitFor(() => expect(nav.replaced.at(-1)).toBe("/vocabulary/manage?keySearch=%E5%8F%A3&hskLevel=2"), { timeout: 2000 });
    await waitFor(() => expect(client.searchVocabularies).toHaveBeenLastCalledWith(expect.objectContaining({ keySearch: "口", hskLevel: 2 })));
    await userEvent.click(screen.getByTitle("2")); // antd Pagination: li[title="2"]
    await waitFor(() => expect(nav.push.at(-1)).toBe("/vocabulary/manage?keySearch=%E5%8F%A3&hskLevel=2&page=2"));
    await waitFor(() => expect(client.searchVocabularies).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })));
    await selectFilter("Số dòng mỗi trang", "50 / trang");
    expect(nav.push.at(-1)).toBe("/vocabulary/manage?keySearch=%E5%8F%A3&hskLevel=2&size=50");
    await waitFor(() => expect(client.searchVocabularies).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, size: 50 })));
  });

  it("URL lạ trở về bộ lọc mặc định; dòng từ vựng mở và thu gọn chi tiết trong bảng", async () => {
    const word = vocab(1, { imageUrl: "/assets/hocba/lms-hoc-ba.png" });
    word.pinyins = word.pinyins?.map(reading => ({
      ...reading,
      compounds: JSON.stringify([{ hanzi: "文字", sinoVietnamese: "VĂN TỰ" }]),
      synonyms: JSON.stringify([{ hanzi: "文" }]),
      antonyms: JSON.stringify([{ hanzi: "图" }]),
    }));
    vi.mocked(client.searchVocabularies).mockResolvedValue(page([word]));
    nav.set("/vocabulary/manage?hskLevel=9&page=abc&isSingleVocab=true");
    renderPage();
    await screen.findByText("字1");
    expect(client.searchVocabularies).toHaveBeenCalledWith(expect.objectContaining({ hskLevel: undefined, isSingleVocab: true, page: 0 }));
    const row = rows()[0];
    const hanzi = within(row).getByText("字1");
    expect(hanzi.tagName).toBe("SPAN");
    await userEvent.click(within(row).getByRole("button", { name: "Thao tác 字1" }));
    expect(screen.queryByTestId("vocab-row-details")).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const details = within(screen.getByTestId("dictionary-table")).getByTestId("vocab-row-details");
    expect(within(details).queryByRole("tablist")).not.toBeInTheDocument();
    expect(details).toHaveTextContent("Hán Việt: tự 1");
    expect(details).toHaveTextContent("Lượng từ: 个 [gè]");
    expect(details).toHaveTextContent("例句1");
    expect(details).toHaveTextContent("VN: ví dụ 1");
    expect(details).toHaveTextContent("Chưa có thông tin chiết tự");
    expect(details).toHaveTextContent(/文字 \(VĂN TỰ\).*Đồng nghĩa: 文.*Trái nghĩa: 图.*Ý nghĩa & Ví dụ.*例句1/);
    const illustration = within(details).getByRole("img", { name: "Ảnh minh họa cho 字1" });
    expect(within(details).getByText("Cấu tạo & minh họa").parentElement).toContainElement(illustration);
    expect(illustration).toHaveAttribute("src", word.imageUrl);
    row.focus();
    await userEvent.keyboard("{Enter}");
    expect(row).toHaveAttribute("aria-expanded", "false");
    expect(details).not.toBeVisible();
  });
});

describe("màn Từ điển — thao tác ghi", () => {
  it("Thêm từ mới: thiếu Hán tự => toast + ở tab Thông tin; thiếu nghĩa => chuyển tab Nghĩa; đủ => createVocabulary(payload) + toast + tải lại", async () => {
    renderPage();
    await screen.findByText("字1");
    await userEvent.click(screen.getByRole("button", { name: /Thêm từ mới/ }));
    const modal = antModal();
    expect(within(modal).getByTestId("vocabulary-form")).toBeInTheDocument();
    expect(within(modal).queryByLabelText("Trạng thái")).not.toBeInTheDocument();
    await userEvent.click(within(modal).getByRole("button", { name: "Lưu Nháp" }));
    expect(toast.error).toHaveBeenCalledWith("Vui lòng nhập Hán tự!");
    await userEvent.type(within(modal).getByLabelText(/Hán tự/), "朋友");
    await userEvent.type(within(modal).getByRole("textbox", { name: /^Pinyin/ }), "péngyou");
    await userEvent.type(within(modal).getByLabelText("Hán Việt"), "bằng hữu");
    await userEvent.type(within(modal).getByRole("combobox", { name: /Loại từ/ }), "Danh");
    await userEvent.click(await screen.findByText("Danh từ", { selector: ".ant-select-item-option-content" }));
    const structure = within(within(modal).getByRole("radiogroup", { name: "Cấu trúc" }));
    expect(structure.getByRole("radio", { name: "Từ đơn" })).toBeChecked();
    const compound = structure.getByRole("radio", { name: "Từ ghép" });
    await userEvent.click(structure.getByText("Từ ghép", { exact: true }).closest("label")!);
    expect(compound).toBeChecked();
    await userEvent.click(within(modal).getByRole("button", { name: "Lưu Nháp" }));
    expect(toast.error).toHaveBeenCalledWith("Vui lòng nhập đầy đủ các nghĩa!");
    expect(within(modal).getByTestId("vocab-tab-meaning")).toBeInTheDocument(); // tự chuyển tab
    await userEvent.type(within(modal).getByLabelText(/Nghĩa \(Tiếng Việt\)/), "bạn");
    await userEvent.type(within(modal).getByLabelText("Tiếng Hán", { exact: true }), "他是我的朋友。");
    // Một nghĩa có thể có nhiều ví dụ: thêm dòng thứ hai rồi nhập; thêm dòng thứ ba rồi xóa đi.
    await userEvent.click(within(modal).getByRole("button", { name: /Thêm ví dụ/ }));
    await userEvent.type(within(modal).getAllByLabelText("Tiếng Hán", { exact: true })[1], "我们是朋友。");
    await userEvent.click(within(modal).getByRole("button", { name: /Thêm ví dụ/ }));
    expect(within(modal).getAllByTestId("example-row")).toHaveLength(3);
    const removeExample = within(modal).getByRole("button", { name: "Xóa ví dụ 3 của nghĩa 1" });
    vi.mocked(confirmAction).mockResolvedValueOnce(false);
    await act(async () => fireEvent.click(removeExample));
    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xóa ví dụ 3 của nghĩa 1?" }));
    expect(within(modal).getAllByTestId("example-row")).toHaveLength(3);
    await act(async () => fireEvent.click(removeExample));
    expect(within(modal).getAllByTestId("example-row")).toHaveLength(2);
    await userEvent.click(within(modal).getByRole("button", { name: "Lưu Nháp" }));
    await waitFor(() => expect(client.createVocabulary).toHaveBeenCalledTimes(1));
    const [payload, demo] = vi.mocked(client.createVocabulary).mock.calls[0];
    expect(demo).toBe(false);
    expect(payload).toMatchObject({ hanzi: "朋友", hskLevel: 1, isSingleVocab: false, status: "draft" });
    expect(payload.pinyins).toEqual([expect.objectContaining({ pinyin: "péngyou", sinoVietnamese: "bằng hữu", wordTypes: "Danh từ", isPrimary: true, meanings: [expect.objectContaining({ meaning: "bạn", examples: [expect.objectContaining({ zh: "他是我的朋友。" }), expect.objectContaining({ zh: "我们是朋友。" })] })] })]);
    expect(toast.success).toHaveBeenCalledWith("Đã lưu bản nháp.");
    await waitFor(() => expect(client.searchVocabularies).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(document.querySelector(".ant-modal")).toBeNull());
  }, 90_000); // nhiều thao tác nhập trong modal antd: ~30 giây khi máy bận

  it("Sửa từ dòng mở rộng: tải chi tiết rồi lưu nghĩa đã đổi", async () => {
    vi.stubEnv("NEXT_PUBLIC_STORAGE_API_BASE_PATH", "/api/storage");
    vi.mocked(uploadFile).mockResolvedValueOnce({ fileId: "illustration" });
    const entry = vocab(2, { etymologyStory: "chiết tự", etymologyStoryHtml: "<p><strong>chiết tự</strong></p>" });
    vi.mocked(client.getVocabulary).mockResolvedValueOnce({
      ...entry,
      pinyins: entry.pinyins?.map(pinyin => ({
        ...pinyin,
        compounds: JSON.stringify([{ hanzi: "上午", sinoVietnamese: "THƯỢNG NGỌ" }, { hanzi: "上班" }]),
        synonyms: JSON.stringify([{ hanzi: "中", pinyin: "TRUNG" }]),
        meanings: [{ meaning: "nghĩa 2", meaningEn: "old meaning", meaningZh: "释义", meaningZhHtml: "<p><strong>释义</strong></p>", examples: [{ zh: "例句", zhHtml: "<p><em>例句</em></p>", en: "old translation" }] }],
      })),
    });
    renderPage();
    await userEvent.click(await screen.findByText("字2"));
    const details = within(screen.getByTestId("dictionary-table")).getByTestId("vocab-row-details");
    await userEvent.click(within(details).getByRole("button", { name: "Chỉnh sửa" }));
    await waitFor(() => expect(client.getVocabulary).toHaveBeenCalledWith("2"));
    const modal = await waitFor(() => {
      const m = antModal();
      if (!m) throw new Error("modal chưa mở");
      return m;
    });
    expect(within(modal).getByLabelText(/Hán tự/)).toHaveValue("字2");
    expect(within(modal).getByRole("textbox", { name: /^Pinyin/ })).toHaveValue("zi2");
    await userEvent.click(within(modal).getByRole("tab", { name: /^Nghĩa & Ví dụ/ }));
    expect(within(modal).queryByLabelText("Nghĩa (Tiếng Anh)")).not.toBeInTheDocument();
    expect(within(modal).queryByLabelText("Dịch nghĩa (Anh)")).not.toBeInTheDocument();
    expect(within(modal).getByLabelText("Pinyin của câu ví dụ")).toBeInTheDocument();
    const meaning = within(modal).getByLabelText(/Nghĩa \(Tiếng Việt\)/);
    expect(meaning).toHaveValue("nghĩa 2");
    await userEvent.clear(meaning);
    await userEvent.type(meaning, "nghĩa mới");
    fireEvent.click(within(modal).getByRole("button", { name: "Thêm nghĩa" }));
    const removeMeaning = within(modal).getByRole("button", { name: "Xóa nghĩa 2" });
    vi.mocked(confirmAction).mockResolvedValueOnce(false);
    await act(async () => fireEvent.click(removeMeaning));
    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xóa nghĩa 2?", danger: true }));
    expect(removeMeaning).toBeInTheDocument();
    await act(async () => fireEvent.click(removeMeaning));
    expect(removeMeaning).not.toBeInTheDocument();
    fireEvent.click(within(modal).getByRole("tab", { name: /^Từ ghép/ }));
    const compounds = within(within(modal).getByTestId("related-compounds"));
    const removeCompound = compounds.getByRole("button", { name: "Xóa 上班" });
    vi.mocked(confirmAction).mockResolvedValueOnce(false);
    await act(async () => fireEvent.click(removeCompound));
    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xóa 上班?", danger: true }));
    expect(removeCompound).toBeInTheDocument();
    await act(async () => fireEvent.click(removeCompound));
    expect(removeCompound).not.toBeInTheDocument();
    const addHanzi = compounds.getByLabelText("Hán tự");
    fireEvent.change(addHanzi, { target: { value: "新词" } });
    fireEvent.click(compounds.getByRole("button", { name: "Sửa 上午" }));
    const compoundRow = within(compounds.getByRole("listitem"));
    expect(addHanzi).toHaveValue("新词");
    expect(compoundRow.getByLabelText("Hán tự")).toHaveValue("上午");
    expect(compoundRow.getByLabelText("Tiếng Việt")).toHaveValue("THƯỢNG NGỌ");
    fireEvent.change(compoundRow.getByLabelText("Tiếng Việt"), { target: { value: "buổi sáng" } });
    fireEvent.click(compoundRow.getByRole("button", { name: "Cập nhật" }));
    expect(compounds.getAllByRole("listitem")).toHaveLength(1);
    expect(compounds.getByRole("listitem")).toHaveTextContent("buổi sáng");
    fireEvent.click(within(modal).getByRole("tab", { name: /^Lượng từ & liên quan/ }));
    const measureWords = within(within(modal).getByTestId("related-measure-words"));
    fireEvent.click(measureWords.getByRole("button", { name: "Sửa 个" }));
    const measureRow = within(measureWords.getByRole("listitem"));
    fireEvent.change(measureRow.getByLabelText("Pinyin"), { target: { value: "gè mới" } });
    fireEvent.click(measureRow.getByRole("button", { name: "Cập nhật" }));
    const synonyms = within(within(modal).getByTestId("related-synonyms"));
    fireEvent.click(synonyms.getByRole("button", { name: "Sửa 中" }));
    const synonymRow = within(synonyms.getByRole("listitem"));
    expect(synonymRow.getByLabelText("Hán Việt")).toHaveValue("TRUNG");
    fireEvent.change(synonymRow.getByLabelText("Hán Việt"), { target: { value: "Trung" } });
    fireEvent.click(synonymRow.getByRole("button", { name: "Hủy sửa" }));
    expect(synonyms.getByRole("listitem")).toHaveTextContent("TRUNG");
    await userEvent.click(within(modal).getByRole("tab", { name: "Media & Chi tiết" }));
    expect(within(modal).getByRole("region", { name: "Thứ tự nét viết" })).toBeInTheDocument();
    expect(within(modal).getByLabelText("Chiết tự (nguồn gốc)")).toHaveValue("chiết tự");
    expect(within(modal).queryByLabelText("URL ảnh động nét viết")).not.toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: "Chọn ảnh" })).toBeEnabled();
    const image = new File(["image"], "illustration.png", { type: "image/png" });
    await userEvent.upload(within(modal).getByLabelText("Hình minh họa"), image);
    expect(await within(modal).findByRole("img", { name: "Hình minh họa" })).toHaveAttribute("src", "/api/storage/file/illustration?disposition=inline");
    expect(within(modal).getByRole("button", { name: "Đổi ảnh" })).toBeEnabled();
    vi.mocked(confirmAction).mockResolvedValueOnce(false);
    await act(async () => fireEvent.click(within(modal).getByRole("button", { name: "Xóa ảnh" })));
    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xóa hình minh họa?" }));
    expect(within(modal).getByRole("img", { name: "Hình minh họa" })).toBeInTheDocument();
    await userEvent.click(within(modal).getByRole("button", { name: "Lưu & Xuất bản" }));
    await waitFor(() => expect(client.updateVocabulary).toHaveBeenCalledWith("2", expect.objectContaining({
      hanzi: "字2", etymologyStory: "chiết tự", etymologyStoryHtml: "<p><strong>chiết tự</strong></p>",
      imageUrl: "/api/storage/file/illustration?disposition=inline", status: "published",
    }), false));
    const [savedPinyin] = vi.mocked(client.updateVocabulary).mock.calls[0][1].pinyins;
    expect(savedPinyin).toMatchObject({
      compounds: JSON.stringify([{ hanzi: "上午", sinoVietnamese: "buổi sáng" }]),
      measureWord: "个 [gè mới]",
    });
    expect(savedPinyin.meanings[0]).toMatchObject({
      meaning: "nghĩa mới",
      meaningEn: "old meaning",
      meaningZhHtml: "<p><strong>释义</strong></p>",
      examples: [{ zh: "例句", zhHtml: "<p><em>例句</em></p>", en: "old translation" }],
    });
    // Sửa + xuất bản => đẩy xuống các học phần đang dùng bản sao, tiến độ trên toast "Đang lưu…".
    expect(toast.loading).toHaveBeenCalledWith("Đang lưu…");
    expect(syncPublishedToPackages).toHaveBeenCalledWith("2", "saving", "Đã xuất bản từ vựng.");
  }, 60_000);

  it("chỉ xóa Pinyin sau khi xác nhận", async () => {
    vi.mocked(confirmAction).mockResolvedValueOnce(false);
    renderPage();
    await screen.findByText("字1");
    await userEvent.click(screen.getByRole("button", { name: /Thêm từ mới/ }));
    const form = within(await screen.findByTestId("vocabulary-form"));
    await userEvent.click(form.getByRole("button", { name: /Thêm pinyin/i }));
    const remove = form.getByRole("button", { name: "Xóa pinyin 2" });
    await userEvent.click(remove);
    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xóa Pinyin 2?", danger: true }));
    expect(remove).toBeInTheDocument();
    await userEvent.click(remove);
    await waitFor(() => expect(remove).not.toBeInTheDocument());
    expect(form.getByRole("region", { name: "Pinyin (1)" })).toBeInTheDocument();
  });

  it("lưu tệp phát âm vào đúng Pinyin đã chọn sau khi tải lên", async () => {
    vi.stubEnv("NEXT_PUBLIC_STORAGE_API_BASE_PATH", "/api/storage");
    const revoke = vi.fn();
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL() { return "blob:audio-preview"; }
      static revokeObjectURL = revoke;
    });
    const entry = vocab(2);
    const [primary] = entry.pinyins ?? [];
    vi.mocked(client.getVocabulary).mockResolvedValue({
      ...entry,
      pinyins: [primary, { ...primary, pinyin: "zì", isPrimary: false }],
    });
    let finishUpload!: (meta: Awaited<ReturnType<typeof uploadFile>>) => void;
    vi.mocked(uploadFile).mockReturnValueOnce(new Promise(resolve => { finishUpload = resolve; }));
    renderPage();
    await screen.findByText("字2");
    await rowAction("字2", "Chỉnh sửa");
    const form = within(await screen.findByTestId("vocabulary-form"));
    await userEvent.click(form.getByRole("button", { name: "zì" }));
    const file = new File(["audio"], "zi.mp3", { type: "audio/mpeg" });
    fireEvent.change(form.getByLabelText("Tệp phát âm"), { target: { files: [file] } });
    expect(uploadFile).toHaveBeenCalledWith(file, expect.any(Function));
    expect(form.getByLabelText("Nghe thử tệp phát âm")).toHaveAttribute("src", "blob:audio-preview");
    expect(screen.getByRole("button", { name: "Lưu & Xuất bản" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Lưu Nháp" })).toBeDisabled();
    expect(form.getByRole("button", { name: /zi2/ })).toBeDisabled();
    finishUpload({ fileId: "zi-test" });
    await waitFor(() => expect(form.getByLabelText("Tệp phát âm")).toBeEnabled());
    expect(form.getByRole("button", { name: "Chọn tệp mới" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Lưu Nháp" }));
    await waitFor(() => expect(client.updateVocabulary).toHaveBeenCalled());
    expect(vi.mocked(client.updateVocabulary).mock.calls[0][1].pinyins.map(pinyin => pinyin.audioUrl))
      .toEqual([undefined, "/api/storage/file/zi-test?disposition=inline"]);
  }, 60_000);

  it("Xoá: huỷ => không gọi; đồng ý => deleteVocabulary + toast; Import Excel => toast chưa chuyển", async () => {
    vi.mocked(confirmAction).mockResolvedValueOnce(false);
    renderPage();
    await screen.findByText("字1");
    await rowAction("字3", "Xóa");
    await waitFor(() => expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xác nhận xóa", okText: "Xóa ngay", danger: true })));
    expect(client.deleteVocabulary).not.toHaveBeenCalled();
    await rowAction("字3", "Xóa");
    await waitFor(() => expect(client.deleteVocabulary).toHaveBeenCalledWith("3", false));
    expect(toast.success).toHaveBeenCalledWith("Xóa từ vựng thành công");
    await userEvent.click(screen.getByRole("button", { name: /Import từ Excel/ }));
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("chưa được chuyển"));
  });
});

describe("màn Từ điển — trạng thái và quyền", () => {
  it("chưa cấu hình => WAITING FOR BACKEND, không toast; lỗi => Thử lại; items không phải mảng => lỗi hợp đồng; rỗng => 'Không tìm thấy từ vựng nào'", async () => {
    vi.mocked(client.searchVocabularies).mockRejectedValueOnce(new ApiNotConfiguredError()).mockRejectedValueOnce(new ApiError("Internal Server Error", 500)).mockResolvedValueOnce({ items: "x" } as never).mockResolvedValue(page([], { totalElements: 0, totalPages: 0 }));
    renderPage();
    const waiting = await screen.findByTestId("dictionary-notice");
    expect(waiting).toHaveAttribute("data-kind", "waiting");
    expect(toast.error).not.toHaveBeenCalled();
    // không có nút Thử lại ở waiting => đổi bộ lọc để tải lại
    await selectFilter("Cấu trúc từ", "Từ đơn");
    const table = within(await screen.findByRole("region", { name: "Danh sách từ vựng" }));
    const error = await table.findByRole("alert");
    expect(error).toHaveTextContent("Không thể tải danh sách từ vựng");
    expect(error.querySelector(".ant-empty-image svg")).toBeInTheDocument();
    expect(screen.queryByText("Internal Server Error")).not.toBeInTheDocument();
    await userEvent.click(within(error).getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(client.searchVocabularies).toHaveBeenCalledTimes(3));
    const invalidResponse = await screen.findByRole("alert");
    expect(invalidResponse).toHaveTextContent("Không thể tải danh sách từ vựng");
    await userEvent.click(within(invalidResponse).getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByTestId("dictionary-empty")).toHaveTextContent("Không tìm thấy từ vựng nào");
    expect(screen.getByText("0 bản ghi")).toBeInTheDocument();
  });

  it("giảng viên không có ticket DICTIONARY => Alert chỉ xem, không nút ghi; có ticket => có nút; công tắc ghi đóng => WriteLockedNotice", async () => {
    vi.mocked(getTickets).mockResolvedValue([{ id: "t1", status: "OPEN", assignedId: "u-teacher-1", module: "QUIZ" }] as never);
    const first = renderPage(teacher, "instructor");
    await screen.findByText("字1");
    expect(await screen.findByTestId("content-readonly-alert")).toHaveTextContent("Chế độ Xem duy nhất");
    expect(screen.queryByRole("button", { name: /Thêm từ mới/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Thao tác 字1" }));
    expect(await screen.findByRole("menuitem", { name: "Xem chi tiết" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Xóa" })).toBeNull();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByText("字1"));
    expect(within(screen.getByTestId("vocab-row-details")).queryByRole("button", { name: "Chỉnh sửa" })).not.toBeInTheDocument();
    first.unmount();

    resetContentAccessCache();
    vi.mocked(getTickets).mockResolvedValue([{ id: "t2", status: "DONE", assignedId: "u-teacher-1", module: "DICTIONARY" }] as never);
    const second = renderPage(teacher, "instructor");
    await screen.findByText("字1");
    expect(await screen.findByRole("button", { name: /Thêm từ mới/ })).toBeInTheDocument();
    expect(screen.queryByTestId("content-readonly-alert")).toBeNull();
    second.unmount();

    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "disabled");
    renderPage();
    await screen.findByText("字1");
    expect(screen.getByTestId("write-locked")).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.queryByRole("button", { name: /Thêm từ mới/ })).toBeNull();
  });
});
