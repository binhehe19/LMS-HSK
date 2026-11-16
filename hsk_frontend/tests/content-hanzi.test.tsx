import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HANZI_CREATE_PACKAGE_PATH, HANZI_MANAGE_PATH, resolveWritingPackageType, WRITING_CONFIG, WRITING_PACKAGE_TYPES } from "@/components/management/content-hanzi/hanzi-config";
import { HanziCreatePackagePageContent } from "@/components/management/content-hanzi/hanzi-create-package-page-content";
import { HanziManagePageContent } from "@/components/management/content-hanzi/hanzi-manage-page-content";
import { HanziSelectTypePageContent } from "@/components/management/content-hanzi/hanzi-select-type-page-content";
import { HanziSetEditorPageContent } from "@/components/management/content-hanzi/hanzi-set-editor-page-content";
import { HanziWordForm } from "@/components/management/content-hanzi/hanzi-word-form";
import { HanziWordPreview } from "@/components/management/content-hanzi/hanzi-word-preview";
import { ManagementShell } from "@/components/management/management-shell";
import { confirmAction } from "@/components/shared/confirm-action";
import { resetContentAccessCache } from "@/hooks/use-content-access";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import * as client from "@/lib/api/content-tree-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { getTickets } from "@/lib/api/ticket-client";
import { emptyHanziInput, hanziSummary, hanziToInput, normalizeHanziInput, parseBulkHanzi, parseStrokeCount, validateHanziInput } from "@/lib/content/hanzi-word";
import { makeStore } from "@/redux/store";
import type { ManagementArea } from "@/lib/management/area";
import type { ContentFolder, ContentPackage, ContentStudySet } from "@/types/content";
import type { HanziWord, HanziWordInput } from "@/types/content-writing";
import { adminUser } from "./fixtures/classes";

// Nhiều ca render cây antd 4 cấp + form trong jsdom; khi cả bộ chạy song song, 30s mặc định từng không đủ và một ca hết giờ kéo theo ca sau
// (chuỗi userEvent của ca cũ vẫn chạy nốt, tiêu mất mockRejectedValueOnce của ca mới). Chạy riêng mỗi ca chỉ vài giây.
vi.setConfig({ testTimeout: 90_000 });

// Router giả CÓ trạng thái: push/replace đổi URL và báo cho useSearchParams (vị trí cây nằm trong URL) — cùng mẫu tests/content-tree-manager.test.tsx.
const nav = vi.hoisted(() => {
  let url = "/hanzi/manage";
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

// Màn có sidebar + antd Table/Modal trong jsdom chạy chậm; các ca điều hướng nhiều bước cần hơn 5 giây mặc định.
vi.setConfig({ testTimeout: 30_000 });

const TARGET = { apiPrefix: "/writing", itemsPath: "words" };
const teacher = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "gv1@example.test", roles: ["ROLE_TEACHER"] };
const pkg = (i: number, over: Partial<ContentPackage> = {}): ContentPackage => ({ id: `p${i}`, name: `Gói ${i}`, type: "LEARNING_PATH", publishStatus: "DRAFT", description: `Mô tả ${i}`, createdAt: "2026-03-05T08:30:00Z", folderCount: 1, ...over });
const folder = (i: number, over: Partial<ContentFolder> = {}): ContentFolder => ({ id: `f${i}`, packageId: "p1", name: `Thư mục ${i}`, description: "", studySetCount: 1, ...over });
const set = (i: number, over: Partial<ContentStudySet> = {}): ContentStudySet => ({ id: `s${i}`, folderId: "f1", title: `Bộ ${i}`, description: "", itemCount: 2, ...over });
const GLYPHS = ["我", "你", "他"];
const word = (i: number, over: Partial<HanziWord> = {}): HanziWord => ({ id: `w${i}`, studySetId: "s1", index: i - 1, hanzi: GLYPHS[i - 1], pinyin: ["wǒ", "nǐ", "tā"][i - 1], meaning: ["tôi", "bạn", "anh ấy"][i - 1], strokeCount: [7, 7, 5][i - 1], radical: ["戈", "亻", "亻"][i - 1], sinoVn: ["ngã", "nhĩ", "tha"][i - 1], ...over });

beforeEach(() => {
  resetContentAccessCache();
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(confirmAction).mockReset().mockResolvedValue(true);
  for (const fn of Object.values(client)) if (typeof fn === "function" && "mockReset" in fn) vi.mocked(fn as unknown as ReturnType<typeof vi.fn>).mockReset();
  vi.mocked(client.listPackages).mockResolvedValue([pkg(1), pkg(2, { type: "FREE", publishStatus: "PUBLISHED" })]);
  vi.mocked(client.listFolders).mockImplementation(async (_t, packageId) => (packageId === "p1" ? [folder(1)] : [folder(2, { id: "f2", packageId: "p2" })]));
  vi.mocked(client.getFolder).mockResolvedValue(folder(1));
  vi.mocked(client.listStudySets).mockResolvedValue([set(1)]);
  vi.mocked(client.getStudySet).mockResolvedValue(set(1, { description: "Mô tả bộ" }));
  vi.mocked(client.listItems).mockResolvedValue([word(2), word(1)]);
  vi.mocked(client.createPackage).mockResolvedValue(pkg(9));
  vi.mocked(client.createItem).mockResolvedValue(word(3));
  vi.mocked(client.updateItem).mockResolvedValue(word(1));
  vi.mocked(client.deleteItem).mockResolvedValue({});
  vi.mocked(client.createStudySet).mockResolvedValue(set(7, { id: "s-new", title: "Bộ mới" }));
  vi.mocked(client.createItemsBulk).mockResolvedValue([]);
  vi.mocked(client.updateStudySet).mockResolvedValue(set(1));
  for (const fn of [toast.success, toast.error, toast.info]) vi.mocked(fn).mockClear();
  nav.push.length = 0;
  nav.replace.length = 0;
  nav.set("/hanzi/manage");
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
const editorItems = () => screen.getAllByTestId("set-editor-item");
const meaningField = (scope: HTMLElement) => within(scope).getByLabelText(/^Nghĩa \*$/);

describe("hàm thuần module Luyện viết (lib/content/hanzi-word)", () => {
  it("emptyHanziInput/hanziToInput: form rỗng đủ trường; từ mục máy chủ giữ index, thiếu số nét => undefined, trường rỗng => ''", () => {
    expect(emptyHanziInput()).toEqual({ hanzi: "", pinyin: "", meaning: "", strokeCount: undefined, radical: "", sinoVn: "", example: "", exampleMeaning: "" });
    expect(hanziToInput(word(1, { example: "我是学生。", exampleMeaning: undefined }))).toEqual({ hanzi: "我", pinyin: "wǒ", meaning: "tôi", strokeCount: 7, radical: "戈", sinoVn: "ngã", example: "我是学生。", exampleMeaning: "", index: 0 });
    expect(hanziToInput({ id: "w9", studySetId: "s1", hanzi: "天" }).strokeCount).toBeUndefined();
    expect(hanziSummary(word(2))).toBe("你");
  });

  it("validateHanziInput: chữ Hán, phiên âm, nghĩa bắt buộc (quy tắc 'ký tự đầy đủ thông tin' của create-set-page cũ); số nét phải là số nguyên 1–64", () => {
    const ok: HanziWordInput = { ...emptyHanziInput(), hanzi: "我", pinyin: "wǒ", meaning: "tôi" };
    expect(validateHanziInput({ ...ok, hanzi: "  " })).toBe("Vui lòng nhập chữ Hán");
    expect(validateHanziInput({ ...ok, pinyin: "" })).toBe("Vui lòng nhập phiên âm (pinyin)");
    expect(validateHanziInput({ ...ok, meaning: " " })).toBe("Vui lòng nhập nghĩa");
    for (const strokeCount of [0, 65, 2.5, Number.NaN]) expect(validateHanziInput({ ...ok, strokeCount })).toBe("Số nét phải là số nguyên từ 1 đến 64");
    expect(validateHanziInput(ok)).toBeNull();
    expect(validateHanziInput({ ...ok, strokeCount: 7 })).toBeNull();
  });

  it("normalizeHanziInput: cắt khoảng trắng, trường rỗng => undefined, số nét không hợp lệ => bỏ, giữ index", () => {
    expect(normalizeHanziInput({ hanzi: " 我 ", pinyin: " wǒ ", meaning: "tôi ", strokeCount: 7, radical: "", sinoVn: " ngã", example: "  ", exampleMeaning: "", index: 3 })).toEqual({ hanzi: "我", pinyin: "wǒ", meaning: "tôi", strokeCount: 7, radical: undefined, sinoVn: "ngã", example: undefined, exampleMeaning: undefined, index: 3 });
    expect(normalizeHanziInput({ ...emptyHanziInput(), hanzi: "天", strokeCount: Number.NaN }).strokeCount).toBeUndefined();
  });

  it("parseStrokeCount: rỗng => undefined, số nguyên => số, chuỗi lạ => NaN (để validate báo lỗi thay vì lặng lẽ bỏ)", () => {
    expect(parseStrokeCount("")).toBeUndefined();
    expect(parseStrokeCount("  ")).toBeUndefined();
    expect(parseStrokeCount(" 12 ")).toBe(12);
    expect(parseStrokeCount("ab")).toBeNaN();
    expect(parseStrokeCount("2.5")).toBeNaN();
  });

  it("parseBulkHanzi: mỗi dòng chữ Hán, nghĩa, pinyin[, số nét, bộ thủ, Hán Việt] theo dấu phân cách đầu tiên; bỏ dòng thiếu chữ/nghĩa hoặc không có dấu", () => {
    const parsed = parseBulkHanzi("我\ttôi\twǒ\t7\t戈\tngã\n你,bạn,nǐ\n他|anh ấy|tā|x\ndòng lỗi\n;thiếu chữ;x\n\n");
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({ hanzi: "我", meaning: "tôi", pinyin: "wǒ", strokeCount: 7, radical: "戈", sinoVn: "ngã" });
    expect(parsed[1]).toMatchObject({ hanzi: "你", meaning: "bạn", pinyin: "nǐ", strokeCount: undefined, radical: "", sinoVn: "" });
    expect(parsed[2]).toMatchObject({ hanzi: "他", meaning: "anh ấy", pinyin: "tā", strokeCount: undefined });
    expect(parseBulkHanzi("")).toEqual([]);
  });

  it("resolveWritingPackageType: nhận 4 loại (không phân biệt hoa/thường), giá trị lạ/thiếu => FREE như form create-package.tsx cũ", () => {
    expect(resolveWritingPackageType("learning_path")).toBe("LEARNING_PATH");
    expect(resolveWritingPackageType(" VIDEO_COURSE ")).toBe("VIDEO_COURSE");
    expect(resolveWritingPackageType("khong-co")).toBe("FREE");
    expect(resolveWritingPackageType(null)).toBe("FREE");
    expect(resolveWritingPackageType(undefined)).toBe("FREE");
  });
});

describe("cấu hình module WRITING", () => {
  it("WRITING_CONFIG: ticket WRITING, /writing + words, class manage-hanzi-page, nhãn 'Chữ', 4 loại gói bản hanzi theo thứ tự tab cũ, có Nhập Excel, không tab tìm toàn cây, trang tạo/sửa bộ /hanzi/*", () => {
    expect(WRITING_CONFIG).toMatchObject({ module: "WRITING", key: "writing", apiPrefix: "/writing", itemsPath: "words", title: "Quản lý Luyện viết", pageClassName: "manage-hanzi-page", supportsImport: true, labels: { package: "Package", folder: "Thư mục", studySet: "Bộ học", item: "Chữ" } });
    expect(WRITING_CONFIG.packageTypes).toBe(WRITING_PACKAGE_TYPES);
    expect(WRITING_PACKAGE_TYPES.map((t) => t.value)).toEqual(["LEARNING_PATH", "LEARNING", "VIDEO_COURSE", "FREE"]);
    expect(WRITING_PACKAGE_TYPES.find((t) => t.value === "FREE")).toMatchObject({ label: "Học miễn phí", color: "#FFC107", description: "Tài nguyên luyện viết miễn phí" });
    expect(WRITING_CONFIG.itemSearchTab).toBeUndefined();
    expect(WRITING_CONFIG.hasSkill).toBeUndefined();
    expect(WRITING_CONFIG.itemColumns.map((c) => c.key)).toEqual(["hanzi", "meaning", "strokes"]);
    expect(WRITING_CONFIG.setEditorRoutes?.create("p 1", "f1")).toBe("/hanzi/create?packageId=p%201&folderId=f1");
    expect(WRITING_CONFIG.setEditorRoutes?.edit("s/1")).toBe("/hanzi/edit/s%2F1");
    expect(WRITING_CONFIG.ItemForm).toBe(HanziWordForm);
    expect(WRITING_CONFIG.ItemPreview).toBe(HanziWordPreview);
    expect(WRITING_CONFIG.parseBulkText).toBe(parseBulkHanzi);
    expect(HANZI_MANAGE_PATH).toBe("/hanzi/manage");
    expect(HANZI_CREATE_PACKAGE_PATH).toBe("/hanzi/manage/create-package");
  });
});

describe("form chữ và xem nhanh chữ", () => {
  it("HanziWordForm: đủ 8 trường có label; gõ chữ Hán và số nét gọi onChange đúng kiểu (số nét là number); disabled khoá mọi ô", async () => {
    const onChange = vi.fn();
    const value: HanziWordInput = { ...emptyHanziInput(), hanzi: "", pinyin: "wǒ" };
    const { rerender } = render(<HanziWordForm value={value} onChange={onChange} idPrefix="t" />);
    for (const label of [/Chữ Hán/, /Phiên âm/, /^Nghĩa \*$/, "Số nét", "Bộ thủ", "Hán Việt", /^Ví dụ$/, "Nghĩa ví dụ"]) expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phiên âm/)).toHaveValue("wǒ");
    await userEvent.type(screen.getByLabelText(/Chữ Hán/), "我");
    expect(onChange).toHaveBeenLastCalledWith({ ...value, hanzi: "我" });
    await userEvent.type(screen.getByLabelText("Số nét"), "7");
    expect(onChange).toHaveBeenLastCalledWith({ ...value, strokeCount: 7 });
    rerender(<HanziWordForm value={{ ...value, strokeCount: Number.NaN }} onChange={onChange} disabled idPrefix="t" />);
    expect(screen.getByLabelText("Số nét")).toHaveValue(null); // NaN không hiện "NaN"
    expect(screen.getByLabelText(/Chữ Hán/)).toBeDisabled();
    expect(screen.getByLabelText("Hán Việt")).toBeDisabled();
  });

  it("HanziWordPreview: chữ lớn, pinyin, nghĩa, huy hiệu số nét/bộ thủ/Hán Việt, ví dụ; thiếu dữ liệu hiện '—'/'Chưa có ...'; nút Phát âm dùng Web Speech zh-CN", async () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak, cancel });
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
    const { rerender } = render(<HanziWordPreview item={word(1, { example: "我是学生。", exampleMeaning: "Tôi là học sinh." })} />);
    const preview = screen.getByTestId("hanzi-preview");
    expect(within(preview).getByLabelText("Chữ 我")).toHaveTextContent("我");
    expect(within(preview).getByRole("heading", { level: 3 })).toHaveTextContent("wǒ");
    expect(within(preview).getByText("tôi")).toBeInTheDocument();
    expect(within(preview).getByText("Số nét: 7")).toBeInTheDocument();
    expect(within(preview).getByText("Bộ thủ: 戈")).toBeInTheDocument();
    expect(within(preview).getByText("Hán Việt: ngã")).toBeInTheDocument();
    expect(within(preview).getByText("我是学生。")).toBeInTheDocument();
    await userEvent.click(within(preview).getByRole("button", { name: "Phát âm" }));
    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: "我", lang: "zh-CN" }));
    rerender(<HanziWordPreview item={{ id: "w9", studySetId: "s1", hanzi: "天" }} />);
    expect(screen.getByText("Chưa có phiên âm")).toBeInTheDocument();
    expect(screen.getByText("Chưa có nghĩa")).toBeInTheDocument();
    expect(screen.getByText("Số nét: —")).toBeInTheDocument();
    expect(screen.getByText("Bộ thủ: —")).toBeInTheDocument();
    expect(screen.queryByText(/我是学生/)).toBeNull();
  });
});

describe("/hanzi/manage — màn quản lý luyện viết trên nền content-tree", () => {
  it("tải gói với target /writing+words; tiêu đề/khung DOM/nhãn bản hanzi; không tab lọc theo loại, không có tab tìm toàn cây; Nhập Excel chỉ báo chưa chuyển", async () => {
    renderPage(HanziManagePageContent);
    await screen.findByText("Gói 1");
    expect(client.listPackages).toHaveBeenCalledWith(TARGET);
    expect(document.querySelector(".content.manage-hanzi-page.content-tree-page .card.manage-lp-container")).not.toBeNull();
    // Tiêu đề trang (config.title) đã bỏ vì trùng với tiêu đề khối gói ngay dưới — chỉ còn h5 của khối gói.
    expect(screen.getByRole("heading", { level: 5, name: /Danh sách Gói Luyện viết/ })).toBeInTheDocument();
    expect(screen.getByText("Thiết lập các gói, thư mục và bộ học để luyện viết chữ Hán")).toBeInTheDocument();
    // Tab lọc theo loại (Học miễn phí/Lộ trình học/...) đã bỏ — chỉ còn thanh tìm kiếm.
    expect(screen.queryByRole("button", { name: /Học miễn phí \(/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Lộ trình học \(/ })).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getByRole("button", { name: "Tạo package" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Nhập Excel/ }));
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("chưa được chuyển"));
    expect(screen.getAllByTestId("content-package-row")).toHaveLength(2);
  });

  it("cấp bộ: nút 'Tạo kèm chữ' dẫn tới /hanzi/create với packageId/folderId + returnUrl về đúng chỗ", async () => {
    nav.set("/hanzi/manage?packageId=p1&folderId=f1");
    renderPage(HanziManagePageContent);
    await screen.findByText("Bộ 1");
    expect(client.listStudySets).toHaveBeenCalledWith(TARGET, "f1");
    expect(screen.getByRole("link", { name: /Tạo kèm chữ/ })).toHaveAttribute("href", `/hanzi/create?packageId=p1&folderId=f1&returnUrl=${encodeURIComponent("/hanzi/manage?packageId=p1&folderId=f1")}`);
    expect(screen.getByRole("button", { name: "Thêm bộ học" })).toBeInTheDocument();
  });

  it("cấp mục: xem nhanh chữ đầu (theo index), bảng có cột Chữ Hán/Nghĩa/Nét-Bộ thủ, 'Tổng số chữ', nút Chỉnh sửa bộ học sang /hanzi/edit/:id; 'Thêm chữ' kiểm tra 3 trường bắt buộc rồi gọi createItem với số nét là số và index cuối", async () => {
    nav.set("/hanzi/manage?packageId=p1&folderId=f1&studySetId=s1");
    renderPage(HanziManagePageContent);
    const preview = await screen.findByTestId("hanzi-preview");
    expect(client.listItems).toHaveBeenCalledWith(TARGET, "s1");
    expect(within(preview).getByLabelText("Chữ 我")).toBeInTheDocument(); // index 0 trước
    expect(screen.getByText("Tổng số chữ:")).toBeInTheDocument();
    expect(screen.getByTestId("content-items-count")).toHaveTextContent("2");
    expect(screen.getByRole("columnheader", { name: "Nét / Bộ thủ" })).toBeInTheDocument();
    expect(screen.getAllByText("7 nét")).toHaveLength(2);
    expect(screen.getByText("Hán Việt: nhĩ")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Chỉnh sửa bộ học/ })).toHaveAttribute("href", expect.stringContaining("/hanzi/edit/s1?returnUrl="));

    await userEvent.click(screen.getByRole("button", { name: "Thêm chữ" }));
    const modal = antModal();
    expect(within(modal).getByTestId("hanzi-word-form")).toBeInTheDocument();
    expect(within(modal).queryByTestId("file-field-image")).toBeNull(); // chữ không có ảnh/âm thanh
    await userEvent.click(modalOk(modal, "Thêm chữ"));
    expect(toast.error).toHaveBeenLastCalledWith("Vui lòng nhập chữ Hán");
    await userEvent.type(within(modal).getByLabelText(/Chữ Hán/), "天");
    await userEvent.click(modalOk(modal, "Thêm chữ"));
    expect(toast.error).toHaveBeenLastCalledWith("Vui lòng nhập phiên âm (pinyin)");
    await userEvent.type(within(modal).getByLabelText(/Phiên âm/), "tiān");
    await userEvent.click(modalOk(modal, "Thêm chữ"));
    expect(toast.error).toHaveBeenLastCalledWith("Vui lòng nhập nghĩa");
    await userEvent.type(meaningField(modal), " trời ");
    await userEvent.type(within(modal).getByLabelText("Số nét"), "4");
    await userEvent.type(within(modal).getByLabelText("Bộ thủ"), "大");
    expect(client.createItem).not.toHaveBeenCalled();
    await userEvent.click(modalOk(modal, "Thêm chữ"));
    await waitFor(() => expect(client.createItem).toHaveBeenCalledWith(TARGET, "s1", { hanzi: "天", pinyin: "tiān", meaning: "trời", strokeCount: 4, radical: "大", sinoVn: undefined, example: undefined, exampleMeaning: undefined, index: 2 }, false));
    expect(toast.success).toHaveBeenCalledWith("Đã thêm chữ mới");
    await waitFor(() => expect(client.listItems).toHaveBeenCalledTimes(2));
  });

  it("xoá chữ: hộp xác nhận dùng chữ Hán làm tên; đồng ý => deleteItem + toast", async () => {
    nav.set("/hanzi/manage?packageId=p1&folderId=f1&studySetId=s1");
    renderPage(HanziManagePageContent);
    await screen.findByTestId("hanzi-preview");
    await userEvent.click(screen.getByRole("button", { name: "Xóa 你" }));
    await waitFor(() => expect(client.deleteItem).toHaveBeenCalledWith(TARGET, "w2", false));
    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xóa chữ", content: 'Bạn có chắc chắn muốn xóa chữ "你"?', danger: true }));
    expect(toast.success).toHaveBeenCalledWith('Đã xóa chữ "你"');
  });

  it("quyền ticket WRITING: giảng viên không có ticket => 'Chế độ Xem duy nhất', không nút ghi; có ticket WRITING DONE => có Thêm/Xoá nhưng không Publish", async () => {
    vi.mocked(getTickets).mockResolvedValue([{ id: "t1", status: "OPEN", assignedId: "u-teacher-1", module: "PRONUNCIATION" }] as never);
    renderPage(HanziManagePageContent, teacher, "instructor");
    await screen.findByText("Gói 1");
    expect(await screen.findByTestId("content-readonly-alert")).toHaveTextContent("Chế độ Xem duy nhất");
    expect(screen.queryByRole("button", { name: "Tạo package" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xóa Gói 1" })).toBeNull();
  });

  it("giảng viên có ticket WRITING: Thêm/Xoá hiện, Publish ẩn", async () => {
    vi.mocked(getTickets).mockResolvedValue([{ id: "t2", status: "DONE", assignedId: "u-teacher-1", module: "WRITING" }] as never);
    renderPage(HanziManagePageContent, teacher, "instructor");
    await screen.findByText("Gói 1");
    expect(await screen.findByRole("button", { name: "Tạo package" })).toBeInTheDocument();
    expect(screen.queryByTestId("content-readonly-alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Xóa Gói 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Publish Gói/ })).toBeNull();
  });

  it("dịch vụ chưa cấu hình => WAITING FOR BACKEND trong vùng danh sách; lỗi API => khối lỗi + Thử lại", async () => {
    vi.mocked(client.listPackages).mockRejectedValueOnce(new ApiNotConfiguredError()).mockRejectedValueOnce(new ApiError("Máy chủ lỗi", 500)).mockResolvedValue([pkg(1)]);
    renderPage(HanziManagePageContent);
    const waiting = await screen.findByTestId("content-packages-notice");
    expect(waiting).toHaveAttribute("data-kind", "waiting");
    expect(waiting).toHaveTextContent("quản lý luyện viết chưa được kết nối API (WAITING FOR BACKEND)");
    expect(toast.error).not.toHaveBeenCalled();
    // không có nút Thử lại ở trạng thái waiting => tải lại bằng đổi URL về gốc (push cùng URL không đổi khoá) — dùng ca lỗi riêng:
    expect(within(waiting).queryByRole("button", { name: "Thử lại" })).toBeNull();
  });

  it("lỗi API cấp gói => thông điệp máy chủ + Thử lại tải lại được", async () => {
    vi.mocked(client.listPackages).mockRejectedValueOnce(new ApiError("Máy chủ lỗi", 500)).mockResolvedValue([pkg(1)]);
    renderPage(HanziManagePageContent);
    const notice = await screen.findByTestId("content-packages-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(notice).toHaveTextContent("Máy chủ lỗi");
    await userEvent.click(within(notice).getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Gói 1")).toBeInTheDocument();
  });
});

describe("/hanzi/create và /hanzi/edit/:id — tạo/sửa bộ học kèm chữ (ContentSetEditor + WRITING_CONFIG)", () => {
  it("tạo: chọn trước gói/thư mục từ query, một chữ trống sẵn; thiếu tên/chữ/phiên âm báo lỗi; lưu => createStudySet rồi createItemsBulk với số nét là số; về returnUrl", async () => {
    nav.set(`/hanzi/create?packageId=p1&folderId=f1&returnUrl=${encodeURIComponent("/hanzi/manage?packageId=p1&folderId=f1")}`);
    renderPage(() => <HanziSetEditorPageContent />);
    expect(await screen.findByDisplayValue("Gói 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Thư mục")).toHaveValue("f1");
    expect(editorItems()).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 5, name: "Tạo Bộ học mới" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quay lại" })).toHaveAttribute("href", "/hanzi/manage?packageId=p1&folderId=f1");
    await userEvent.click(screen.getByTestId("set-editor-save"));
    expect(toast.error).toHaveBeenLastCalledWith("Vui lòng nhập tên Bộ học");
    await userEvent.type(screen.getByLabelText("Tên Bộ học"), "Bài 1");
    await userEvent.click(screen.getByTestId("set-editor-save"));
    expect(toast.error).toHaveBeenLastCalledWith("Chữ 1: Vui lòng nhập chữ Hán");
    await userEvent.type(within(editorItems()[0]).getByLabelText(/Chữ Hán/), "我");
    await userEvent.click(screen.getByTestId("set-editor-save"));
    expect(toast.error).toHaveBeenLastCalledWith("Chữ 1: Vui lòng nhập phiên âm (pinyin)");
    await userEvent.type(within(editorItems()[0]).getByLabelText(/Phiên âm/), "wǒ");
    await userEvent.type(meaningField(editorItems()[0]), "tôi");
    await userEvent.type(within(editorItems()[0]).getByLabelText("Số nét"), "7");
    await userEvent.click(screen.getByTestId("set-editor-add"));
    expect(editorItems()).toHaveLength(2);
    await userEvent.type(within(editorItems()[1]).getByLabelText(/Chữ Hán/), "你");
    await userEvent.type(within(editorItems()[1]).getByLabelText(/Phiên âm/), "nǐ");
    await userEvent.type(meaningField(editorItems()[1]), "bạn");
    expect(client.createStudySet).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("set-editor-save"));
    await waitFor(() => expect(client.createStudySet).toHaveBeenCalledWith(TARGET, { folderId: "f1", title: "Bài 1", description: undefined, isPrivate: true, skill: undefined }, false));
    await waitFor(() => expect(client.createItemsBulk).toHaveBeenCalledTimes(1));
    const [, setId, inputs] = vi.mocked(client.createItemsBulk).mock.calls[0];
    expect(setId).toBe("s-new");
    expect((inputs as HanziWordInput[]).map((i) => [i.hanzi, i.pinyin, i.meaning, i.strokeCount, i.index])).toEqual([["我", "wǒ", "tôi", 7, 0], ["你", "nǐ", "bạn", undefined, 1]]);
    expect(toast.success).toHaveBeenCalledWith("Tạo Bộ học thành công!");
    expect(nav.push.at(-1)).toBe("/hanzi/manage?packageId=p1&folderId=f1");
  });

  it("'Nhập nhanh' theo thứ tự chữ Hán, nghĩa, pinyin, số nét, bộ thủ, Hán Việt (parseBulkHanzi); không returnUrl => sau khi lưu mở bộ vừa tạo trong cây", async () => {
    nav.set("/hanzi/create?packageId=p1&folderId=f1");
    renderPage(() => <HanziSetEditorPageContent />);
    await screen.findByDisplayValue("Gói 1");
    await userEvent.click(within(editorItems()[0]).getByRole("button", { name: "Xóa chữ 1" }));
    expect(screen.queryAllByTestId("set-editor-item")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: /Nhập nhanh/ }));
    await userEvent.type(screen.getByLabelText(/Mỗi dòng một chữ/), "我,tôi,wǒ,7,戈,ngã{enter}dòng lỗi");
    await userEvent.click(screen.getByRole("button", { name: "Thêm từ văn bản" }));
    expect(toast.success).toHaveBeenCalledWith("Đã thêm 1 chữ; bỏ 1 dòng thiếu dữ liệu");
    expect(editorItems()).toHaveLength(1);
    expect(within(editorItems()[0]).getByLabelText(/Chữ Hán/)).toHaveValue("我");
    expect(within(editorItems()[0]).getByLabelText("Số nét")).toHaveValue(7);
    expect(within(editorItems()[0]).getByLabelText("Bộ thủ")).toHaveValue("戈");
    expect(within(editorItems()[0]).getByLabelText("Hán Việt")).toHaveValue("ngã");
    await userEvent.type(screen.getByLabelText("Tên Bộ học"), "B");
    await userEvent.click(screen.getByTestId("set-editor-save"));
    await waitFor(() => expect(nav.push.at(-1)).toBe("/hanzi/manage?packageId=p1&folderId=f1&studySetId=s-new"));
  });

  it("sửa: tải bộ + chữ + thư mục; đổi nghĩa => PUT đúng chữ; xoá chữ => DELETE; cập nhật bộ; về bộ trong cây /hanzi/manage", async () => {
    nav.set("/hanzi/edit/s1");
    renderPage(() => <HanziSetEditorPageContent studySetId="s1" />);
    expect(await screen.findByDisplayValue("Bộ 1")).toBeInTheDocument();
    expect(client.getStudySet).toHaveBeenCalledWith(TARGET, "s1");
    expect(client.listItems).toHaveBeenCalledWith(TARGET, "s1");
    expect(screen.getByText("Thư mục 1")).toBeInTheDocument();
    expect(editorItems()).toHaveLength(2);
    expect(within(editorItems()[0]).getByLabelText(/Chữ Hán/)).toHaveValue("我"); // sắp theo index
    await userEvent.clear(meaningField(editorItems()[0]));
    await userEvent.type(meaningField(editorItems()[0]), "tôi, ta");
    await userEvent.click(within(editorItems()[1]).getByRole("button", { name: "Xóa chữ 2" }));
    await userEvent.click(screen.getByTestId("set-editor-save"));
    await waitFor(() => expect(client.updateStudySet).toHaveBeenCalledWith(TARGET, "s1", { folderId: "f1", title: "Bộ 1", description: "Mô tả bộ", isPrivate: true, skill: undefined }, false));
    await waitFor(() => expect(client.updateItem).toHaveBeenCalledTimes(1));
    expect(client.updateItem).toHaveBeenCalledWith(TARGET, "w1", expect.objectContaining({ hanzi: "我", meaning: "tôi, ta", strokeCount: 7, radical: "戈", index: 0 }), false);
    expect(client.deleteItem).toHaveBeenCalledWith(TARGET, "w2", false);
    expect(client.createItemsBulk).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Cập nhật Bộ học thành công!");
    expect(nav.push.at(-1)).toBe("/hanzi/manage?packageId=p1&folderId=f1&studySetId=s1");
  });

  it("id không hợp lệ => thông báo nhắc về màn Quản lý Luyện viết, không gọi API; dịch vụ chưa cấu hình => WAITING FOR BACKEND, không form", async () => {
    nav.set("/hanzi/edit/..%2Fx");
    const first = render(
      <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
        <ManagementShell area="admin">
          <HanziSetEditorPageContent studySetId="../x" />
        </ManagementShell>
      </Provider>,
    );
    expect(await screen.findByTestId("set-editor-invalid-id")).toHaveTextContent("Quản lý Luyện viết");
    expect(client.getStudySet).not.toHaveBeenCalled();
    first.unmount();
    vi.mocked(client.getStudySet).mockRejectedValue(new ApiNotConfiguredError());
    nav.set("/hanzi/edit/s1");
    renderPage(() => <HanziSetEditorPageContent studySetId="s1" />);
    const notice = await screen.findByTestId("set-editor-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(screen.queryByTestId("set-editor-save")).toBeNull();
  });
});

describe("/hanzi/manage/select-type và /hanzi/manage/create-package", () => {
  it("select-type: 4 thẻ loại gói bản hanzi dẫn tới create-package?type=...; có lối về màn quản lý (bản cũ chỉ redirect)", () => {
    nav.set("/hanzi/manage/select-type");
    renderPage(HanziSelectTypePageContent);
    expect(screen.getByRole("heading", { level: 5, name: /Chọn loại gói luyện viết/ })).toBeInTheDocument();
    const cards = screen.getAllByTestId("hanzi-type-card");
    expect(cards.map((c) => c.getAttribute("data-type"))).toEqual(["LEARNING_PATH", "LEARNING", "VIDEO_COURSE", "FREE"]);
    expect(cards[3]).toHaveAttribute("href", "/hanzi/manage/create-package?type=FREE");
    expect(within(cards[3]).getByText("Học miễn phí")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Về màn Quản lý Luyện viết" })).toHaveAttribute("href", "/hanzi/manage");
    expect(screen.getByRole("link", { name: "Quay lại" })).toHaveAttribute("href", "/hanzi/manage");
    expect(document.querySelector(".content.manage-hanzi-page")).not.toBeNull();
  });

  it("create-package: ?type= chọn trước loại; thiếu tên => toast bản cũ, không gọi API; đủ => createPackage với body chuẩn hoá, toast 'Tạo gói thành công!' rồi mở gói vừa tạo trong cây", async () => {
    nav.set("/hanzi/manage/create-package?type=learning_path");
    renderPage(HanziCreatePackagePageContent);
    expect(await screen.findByTestId("hanzi-create-package")).toBeInTheDocument();
    expect(screen.getByLabelText(/Loại gói/)).toHaveValue("LEARNING_PATH");
    expect(screen.getByRole("link", { name: "Hủy" })).toHaveAttribute("href", "/hanzi/manage");
    await userEvent.click(screen.getByTestId("hanzi-create-package-submit"));
    expect(toast.error).toHaveBeenCalledWith("Vui lòng điền đầy đủ các trường bắt buộc");
    expect(client.createPackage).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/Tên gói/), "  HSK 1 Luyện viết  ");
    await userEvent.selectOptions(screen.getByLabelText(/Loại gói/), "FREE");
    await userEvent.type(screen.getByLabelText("Mô tả"), " 10 chữ đầu ");
    await userEvent.click(screen.getByTestId("hanzi-create-package-submit"));
    await waitFor(() => expect(client.createPackage).toHaveBeenCalledWith(TARGET, { name: "HSK 1 Luyện viết", type: "FREE", description: "10 chữ đầu" }, false));
    expect(toast.success).toHaveBeenCalledWith("Tạo gói thành công!");
    await waitFor(() => expect(nav.push.at(-1)).toBe("/hanzi/manage?packageId=p9"));
  });

  it("create-package: loại lạ trong URL về FREE; API lỗi => toast thông điệp máy chủ, ở lại trang; máy chủ không trả id => về gốc màn quản lý", async () => {
    vi.mocked(client.createPackage).mockRejectedValueOnce(new ApiError("Tên gói đã tồn tại", 409)).mockResolvedValueOnce({ name: "X", type: "FREE" } as ContentPackage);
    nav.set("/hanzi/manage/create-package?type=khong-co");
    renderPage(HanziCreatePackagePageContent);
    expect(await screen.findByLabelText(/Loại gói/)).toHaveValue("FREE");
    await userEvent.type(screen.getByLabelText(/Tên gói/), "Gói A");
    await userEvent.click(screen.getByTestId("hanzi-create-package-submit"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Tên gói đã tồn tại"));
    expect(nav.push).toHaveLength(0);
    expect(toast.success).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("hanzi-create-package-submit"));
    await waitFor(() => expect(nav.push.at(-1)).toBe("/hanzi/manage"));
  });

  it("create-package: công tắc ghi đóng => WriteLockedNotice + form khoá; giảng viên không ticket WRITING => 'Chế độ Xem duy nhất' + form khoá", async () => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "disabled");
    nav.set("/hanzi/manage/create-package");
    const first = render(
      <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
        <ManagementShell area="admin">
          <HanziCreatePackagePageContent />
        </ManagementShell>
      </Provider>,
    );
    expect(await screen.findByTestId("write-locked")).toHaveTextContent("Tạo gói luyện viết");
    expect(screen.getByTestId("hanzi-create-package-submit")).toBeDisabled();
    expect(screen.getByLabelText(/Tên gói/)).toBeDisabled();
    first.unmount();
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
    renderPage(HanziCreatePackagePageContent, teacher, "instructor");
    expect(await screen.findByTestId("content-readonly-alert")).toHaveTextContent("Chế độ Xem duy nhất");
    expect(screen.getByTestId("hanzi-create-package-submit")).toBeDisabled();
    expect(screen.queryByTestId("write-locked")).toBeNull();
  });
});
