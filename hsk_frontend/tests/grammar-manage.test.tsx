import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GRAMMAR_CONFIG, GRAMMAR_PACKAGE_TYPES } from "@/components/management/content-grammar/grammar-config";
import { GrammarManagePageContent } from "@/components/management/content-grammar/grammar-manage-page-content";
import { ManagementShell } from "@/components/management/management-shell";
import { resetContentAccessCache } from "@/hooks/use-content-access";
import * as client from "@/lib/api/content-tree-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { ContentFolder, ContentPackage, ContentStudySet } from "@/types/content";
import type { GrammarPoint } from "@/types/content-grammar";
import { adminUser } from "./fixtures/classes";

const nav = vi.hoisted(() => {
  let url = "/grammar/manage";
  const listeners = new Set<() => void>();
  return {
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
  useRouter: () => ({ push: (to: string) => nav.set(to), replace: (to: string) => nav.set(to), back: vi.fn() }),
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

const TARGET = { apiPrefix: "/grammar", itemsPath: "grammar-points" };
const pkg: ContentPackage = { id: "p1", name: "Ngữ pháp HSK 1–2", type: "LEARNING_PATH", publishStatus: "PUBLISHED" };
const folder: ContentFolder = { id: "f1", packageId: "p1", name: "Câu cơ bản" };
const set: ContentStudySet = { id: "s1", folderId: "f1", title: "Cấu trúc câu HSK 1", itemCount: 2 };
const point = (i: number, over: Partial<GrammarPoint> = {}): GrammarPoint => ({ id: `g${i}`, studySetId: "s1", index: i - 1, title: `Điểm ${i}`, category: "Câu trần thuật", structure: `S + ${i}`, explanation: `Giải thích ${i}`, generalDefinition: `Định nghĩa ${i}`, hskLevel: String(i), exampleSentenceZh: "我是学生。", exampleSentencePinyin: "Wǒ shì xuésheng.", exampleSentenceVi: "Tôi là học sinh.", ...over });

afterEach(() => {
  document.querySelectorAll("style[data-css-hash], style[data-rc-order]").forEach((node) => node.remove());
});

beforeEach(() => {
  resetContentAccessCache();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  for (const fn of Object.values(client)) if (typeof fn === "function" && "mockReset" in fn) vi.mocked(fn as unknown as ReturnType<typeof vi.fn>).mockReset();
  vi.mocked(client.listPackages).mockResolvedValue([pkg]);
  vi.mocked(client.listFolders).mockResolvedValue([folder]);
  vi.mocked(client.listStudySets).mockResolvedValue([set]);
  vi.mocked(client.listItems).mockResolvedValue([point(2, { generalDefinition: undefined, hskLevel: undefined }), point(1)]);
  vi.mocked(client.createItem).mockResolvedValue(point(3));
  for (const fn of [toast.success, toast.error, toast.info]) vi.mocked(fn).mockClear();
  nav.set("/grammar/manage");
});

function renderPage() {
  render(
    <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
      <ManagementShell area="admin">
        <GrammarManagePageContent />
      </ManagementShell>
    </Provider>,
  );
}
const antModal = () => document.querySelector(".ant-modal") as HTMLElement;

describe("GRAMMAR_CONFIG trên nền content-tree", () => {
  it("config: module GRAMMAR, /grammar + grammar-points, không kỹ năng, nhãn Cấu trúc ngữ pháp/Điểm ngữ pháp, 4 loại gói với mô tả ngữ pháp, cột như bản cũ", () => {
    expect(GRAMMAR_CONFIG).toMatchObject({ module: "GRAMMAR", apiPrefix: "/grammar", itemsPath: "grammar-points", pageClassName: "manage-grammar-page", supportsImport: true });
    expect(GRAMMAR_CONFIG.hasSkill).toBeUndefined();
    expect(GRAMMAR_CONFIG.labels).toEqual({ package: "Package", folder: "Thư mục", studySet: "Cấu trúc ngữ pháp", item: "Điểm ngữ pháp" });
    expect(GRAMMAR_PACKAGE_TYPES.map((t) => [t.value, t.description])).toEqual([
      ["LEARNING_PATH", "Ngữ pháp theo lộ trình HSK chính thức"],
      ["LEARNING", "Ngữ pháp trong khóa học"],
      ["VIDEO_COURSE", "Ngữ pháp đi kèm khóa học video"],
      ["FREE", "Tài nguyên ngữ pháp miễn phí"],
    ]);
    expect(GRAMMAR_CONFIG.itemColumns.map((c) => c.title)).toEqual(["Điểm ngữ pháp", "Định nghĩa chung", "Giải thích", "Ví dụ", "Phân loại", "Trình độ"]);
  });

  it("cấp gói: tiêu đề 'Quản lý ngữ pháp theo khóa học', tab 4 loại, nút Nhập Excel => toast chưa chuyển; class trang manage-grammar-page", async () => {
    renderPage();
    await screen.findByText("Ngữ pháp HSK 1–2");
    expect(client.listPackages).toHaveBeenCalledWith(TARGET);
    expect(document.querySelector(".content.manage-grammar-page")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 5, name: /Quản lý Ngữ pháp/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 5, name: /Quản lý ngữ pháp theo khóa học/ })).toBeInTheDocument();
    expect(screen.getByText("Tổ chức và quản lý các điểm ngữ pháp HSK")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Học miễn phí \(0\)/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Nhập Excel/ }));
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("chưa được chuyển"));
  });

  it("cấp điểm ngữ pháp: bảng theo index với các cột của bản cũ, huy hiệu HSK, '—' khi thiếu; nút 'Thêm điểm ngữ pháp'", async () => {
    nav.set("/grammar/manage?packageId=p1&folderId=f1&studySetId=s1");
    renderPage();
    await screen.findByText("Điểm 1");
    expect(client.listItems).toHaveBeenCalledWith(TARGET, "s1");
    const headers = [...document.querySelectorAll(".ant-table-thead th")].map((th) => th.textContent?.trim());
    expect(headers).toEqual(["STT", "Điểm ngữ pháp", "Định nghĩa chung", "Giải thích", "Ví dụ", "Phân loại", "Trình độ", "Thao tác"]);
    const rows = document.querySelectorAll(".ant-table-tbody tr.ant-table-row");
    expect(rows[0]).toHaveTextContent("Điểm 1");
    expect(rows[0]).toHaveTextContent("S + 1");
    expect(rows[0]).toHaveTextContent("Định nghĩa 1");
    expect(rows[0]).toHaveTextContent("HSK 1");
    expect(rows[0]).toHaveTextContent("Wǒ shì xuésheng.");
    expect(rows[1]).toHaveTextContent("—"); // không có định nghĩa chung / trình độ
    expect(within(rows[1] as HTMLElement).queryByText(/HSK/)).toBeNull();
    expect(screen.getByText("Tổng số điểm ngữ pháp:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thêm điểm ngữ pháp" })).toBeInTheDocument();
  });

  it("thêm điểm ngữ pháp: thiếu phân loại => toast (required của modal cũ); đủ => createItem với body chuẩn hoá, hskLevel chuỗi", async () => {
    nav.set("/grammar/manage?packageId=p1&folderId=f1&studySetId=s1");
    renderPage();
    await screen.findByText("Điểm 1");
    await userEvent.click(screen.getByRole("button", { name: "Thêm điểm ngữ pháp" }));
    const modal = antModal();
    expect(within(modal).getByTestId("grammar-point-form")).toBeInTheDocument();
    await userEvent.type(within(modal).getByLabelText(/Điểm ngữ pháp/), " Câu với 也 ");
    await userEvent.click(within(modal).getByRole("button", { name: "Thêm điểm ngữ pháp" }));
    expect(toast.error).toHaveBeenCalledWith("Vui lòng nhập phân loại");
    expect(client.createItem).not.toHaveBeenCalled();
    await userEvent.type(within(modal).getByLabelText(/Phân loại/), "Phó từ");
    await userEvent.type(within(modal).getByLabelText(/Cấu trúc/), "S + 也 + V");
    await userEvent.type(within(modal).getByLabelText(/Giải thích/), "cũng");
    await userEvent.selectOptions(within(modal).getByLabelText("Cấp độ HSK"), "2");
    await userEvent.click(within(modal).getByRole("button", { name: "Thêm điểm ngữ pháp" }));
    await waitFor(() => expect(client.createItem).toHaveBeenCalledWith(TARGET, "s1", expect.objectContaining({ title: "Câu với 也", category: "Phó từ", structure: "S + 也 + V", explanation: "cũng", hskLevel: "2", note: undefined, index: 2 }), false));
    expect(toast.success).toHaveBeenCalledWith("Đã thêm điểm ngữ pháp mới");
  });
});
