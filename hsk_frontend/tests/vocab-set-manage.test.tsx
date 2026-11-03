// Test VocabSetManagePageContent (/vocab-set/manage) — biến thể nhãn của FlashcardManagePageContent, giờ cũng dùng FlatContentManager +
// lms-content-client.ts (API thật repo-lms) thay vì ContentTreeManager/content-tree-client.ts (mock). Chỉ kiểm tra phần khác Flashcard
// (nhãn/tiêu đề/class trang, không thẻ lật) — phần chung (CRUD gói/mục, quyền, trạng thái dữ liệu) đã có đủ ở tests/flat-content-manager.test.tsx
// vì dùng chung VOCAB_SET_CONFIG = {...FLASHCARD_CONFIG, nhãn khác} và chung client.
import { render, screen } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VocabSetManagePageContent } from "@/components/management/content-flashcard/vocab-set-manage-page-content";
import { ManagementShell } from "@/components/management/management-shell";
import { confirmAction } from "@/components/shared/confirm-action";
import { resetContentAccessCache } from "@/hooks/use-content-access";
import * as client from "@/lib/api/lms-content-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { ContentPackage } from "@/types/content";
import type { FlashcardCard } from "@/types/content-flashcard";
import { adminUser } from "./fixtures/classes";

const nav = vi.hoisted(() => {
  let url = "/vocab-set/manage";
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

vi.setConfig({ testTimeout: 30_000 });

const pkg = (i: number, over: Partial<ContentPackage> = {}): ContentPackage => ({ id: `p${i}`, name: `Gói ${i}`, type: "VOCABULARY", publishStatus: "DRAFT", ...over });
const card = (i: number, over: Partial<FlashcardCard> = {}): FlashcardCard => ({ id: `c${i}`, studySetId: "", index: i - 1, term: `词${i}`, pinyin: `ci${i}`, meaning: `nghĩa ${i}`, ...over });

beforeEach(() => {
  resetContentAccessCache();
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(confirmAction).mockReset().mockResolvedValue(true);
  for (const fn of Object.values(client)) if (typeof fn === "function" && "mockReset" in fn) vi.mocked(fn as unknown as ReturnType<typeof vi.fn>).mockReset();
  vi.mocked(client.listFlashcardPackages).mockResolvedValue([pkg(1)]);
  vi.mocked(client.listPackageItems).mockResolvedValue([card(1)]);
  for (const fn of [toast.success, toast.error, toast.info]) vi.mocked(fn).mockClear();
  nav.set("/vocab-set/manage?packageId=p1");
});

function renderPage() {
  render(
    <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
      <ManagementShell area="admin">
        <VocabSetManagePageContent />
      </ManagementShell>
    </Provider>,
  );
}

describe("biến thể Bộ từ vựng (/vocab-set/manage)", () => {
  it("cùng dữ liệu/dịch vụ Flashcard (lms-content-client.ts) nhưng tiêu đề/nhãn khác, class trang manage-vocabulary-page, không thẻ lật", async () => {
    renderPage();
    await screen.findByText("词1");
    expect(client.listFlashcardPackages).toHaveBeenCalledWith();
    expect(client.listPackageItems).toHaveBeenCalledWith("p1");
    expect(screen.getByRole("heading", { level: 5, name: /Quản lý Từ vựng/ })).toBeInTheDocument();
    expect(document.querySelector(".content.manage-vocabulary-page")).not.toBeNull();
    expect(screen.getByText("Tổng số từ:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thêm từ" })).toBeInTheDocument();
    expect(screen.queryByTestId("flashcard-preview")).toBeNull();
  });
});
