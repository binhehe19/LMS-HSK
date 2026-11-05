// Test QuizManagePageContent (FlatContentManager + lms-quiz-client.ts, API thật repo-lms) — mirror tests/flat-content-manager.test.tsx
// (Flashcard)/flat-grammar-manager.test.tsx (Grammar) ở cấp gói/mục, cộng thêm trình soạn câu hỏi (?quizId=) vốn nằm trong content của
// resource (không có endpoint riêng cho câu hỏi) — mock getQuizResource/saveQuizQuestions thay cho quiz-question-client.ts cũ.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuizManagePageContent } from "@/components/management/content-quiz/quiz-manage-page-content";
import { ManagementShell } from "@/components/management/management-shell";
import { confirmAction } from "@/components/shared/confirm-action";
import { resetContentAccessCache } from "@/hooks/use-content-access";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import * as client from "@/lib/api/lms-quiz-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { ManagementArea } from "@/lib/management/area";
import type { ContentPackage } from "@/types/content";
import type { QuizItem, QuizQuestion } from "@/types/content-quiz";
import { adminUser } from "./fixtures/classes";

vi.setConfig({ testTimeout: 30_000 });

const nav = vi.hoisted(() => {
  let url = "/quiz/manage";
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
vi.mock("@/lib/api/lms-quiz-client", () => ({
  listQuizPackages: vi.fn(),
  createQuizPackage: vi.fn(),
  updateQuizPackage: vi.fn(),
  deleteQuizPackage: vi.fn(),
  publishQuizPackage: vi.fn(),
  unpublishQuizPackage: vi.fn(),
  listPackageQuizItems: vi.fn(),
  createQuizItem: vi.fn(),
  updateQuizItem: vi.fn(),
  deleteQuizItem: vi.fn(),
  getQuizResource: vi.fn(),
  saveQuizQuestions: vi.fn(),
}));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

const teacher = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "gv1@example.test", roles: ["ROLE_TEACHER"] };
const pkg = (i: number, over: Partial<ContentPackage> = {}): ContentPackage => ({ id: `p${i}`, name: `Gói ${i}`, type: "ASSESSMENT", publishStatus: "DRAFT", description: `Mô tả ${i}`, ...over });
const quiz = (i: number, over: Partial<QuizItem> = {}): QuizItem => ({ id: `q${i}`, studySetId: "", index: i - 1, title: `Quiz ${i}`, difficulty: "EASY", durationMinutes: 10, passingScore: 80, questionCount: i, ...over });
const mc: QuizQuestion = { id: "qq1", quizId: "q1", index: 1, type: "MULTIPLE_CHOICE", prompt: "你好 nghĩa là gì?", points: 10, options: [{ text: "Xin chào", isCorrect: true }, { text: "Cảm ơn", isCorrect: false }], explanation: "lời chào" };
const tf: QuizQuestion = { id: "qq2", quizId: "q1", index: 0, type: "TRUE_FALSE", prompt: "再见 nghĩa là xin chào.", points: 5, correctAnswer: false };

afterEach(() => {
  document.querySelectorAll("style[data-css-hash], style[data-rc-order]").forEach((node) => node.remove());
});

beforeEach(() => {
  resetContentAccessCache();
  window.sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(confirmAction).mockReset().mockResolvedValue(true);
  for (const fn of Object.values(client)) if (typeof fn === "function" && "mockReset" in fn) vi.mocked(fn as unknown as ReturnType<typeof vi.fn>).mockReset();
  vi.mocked(client.listQuizPackages).mockResolvedValue([pkg(1), pkg(2, { publishStatus: "PUBLISHED" })]);
  vi.mocked(client.listPackageQuizItems).mockResolvedValue([quiz(2, { difficulty: "HARD", durationMinutes: 0, skill: "READING" }), quiz(1)]);
  vi.mocked(client.createQuizPackage).mockResolvedValue(pkg(9));
  vi.mocked(client.deleteQuizPackage).mockResolvedValue(undefined);
  vi.mocked(client.publishQuizPackage).mockResolvedValue(undefined);
  vi.mocked(client.unpublishQuizPackage).mockResolvedValue(undefined);
  vi.mocked(client.createQuizItem).mockResolvedValue(quiz(3));
  vi.mocked(client.updateQuizItem).mockResolvedValue(quiz(1));
  vi.mocked(client.deleteQuizItem).mockResolvedValue(undefined);
  vi.mocked(client.getQuizResource).mockResolvedValue({ packageName: "Gói 1", item: quiz(1, { passageText: "我是学生。", skill: "LISTENING" }), questions: [mc, tf] });
  vi.mocked(client.saveQuizQuestions).mockImplementation(async (_p, _r, _item, questions) => questions);
  for (const fn of [toast.success, toast.error, toast.info]) vi.mocked(fn).mockClear();
  nav.push.length = 0;
  nav.set("/quiz/manage");
});

function renderPage(user = adminUser, area: ManagementArea = "admin") {
  render(
    <Provider store={makeStore({ status: "authenticated", user })}>
      <ManagementShell area={area}>
        <QuizManagePageContent />
      </ManagementShell>
    </Provider>,
  );
}

const packageRows = () => screen.getAllByTestId("content-package-row");
const modalOk = (modal: HTMLElement, name: RegExp | string) => within(modal).getByRole("button", { name });
const antModal = () => document.querySelector(".ant-modal") as HTMLElement;

describe("cấp gói (Admin)", () => {
  it("tải gói qua listQuizPackages; huy hiệu Published/Draft; chỉ 1 loại Bài tập", async () => {
    renderPage();
    await screen.findByText("Gói 1");
    expect(client.listQuizPackages).toHaveBeenCalledWith();
    expect(packageRows()).toHaveLength(2);
    expect(screen.getByRole("heading", { level: 5, name: /Quản lý bài tập theo khóa học/ })).toBeInTheDocument();
  });

  it("xoá gói: huỷ => không gọi API; đồng ý => deleteQuizPackage + toast", async () => {
    vi.mocked(confirmAction).mockResolvedValueOnce(false);
    renderPage();
    await screen.findByText("Gói 1");
    await userEvent.click(screen.getByRole("button", { name: "Xóa Gói 1" }));
    expect(client.deleteQuizPackage).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Xóa Gói 1" }));
    await waitFor(() => expect(client.deleteQuizPackage).toHaveBeenCalledWith("p1", false));
    expect(toast.success).toHaveBeenCalledWith('Package "Gói 1" đã xóa thành công!');
  });
});

describe("cấp bài tập qua URL (?packageId=)", () => {
  it("bấm gói => push ?packageId; tải bài tập qua listPackageQuizItems; cột Độ khó/Thời gian/Điểm đạt; liên kết 'Soạn câu hỏi' thêm quizId", async () => {
    renderPage();
    await userEvent.click(await screen.findByText("Gói 1"));
    expect(nav.push.at(-1)).toBe("/quiz/manage?packageId=p1");
    await screen.findByText("Quiz 1");
    expect(client.listPackageQuizItems).toHaveBeenCalledWith("p1");
    const rows = document.querySelectorAll(".ant-table-tbody tr.ant-table-row");
    expect(rows[0]).toHaveTextContent("Quiz 1");
    expect(rows[0]).toHaveTextContent("Dễ");
    expect(rows[0]).toHaveTextContent("10 phút");
    expect(rows[0]).toHaveTextContent("80%");
    expect(rows[1]).toHaveTextContent("Khó");
    expect(rows[1]).toHaveTextContent("Không giới hạn");
    expect(rows[1]).toHaveTextContent("Đọc");
    expect(screen.getByRole("link", { name: "Soạn câu hỏi Quiz 1" })).toHaveAttribute("href", "/quiz/manage?packageId=p1&quizId=q1");
  });

  it("'Thêm bài tập' => form quiz; thiếu tiêu đề => toast; đủ => createQuizItem(packageId, body chuẩn hoá + index cuối, demo)", async () => {
    nav.set("/quiz/manage?packageId=p1");
    renderPage();
    await screen.findByText("Quiz 1");
    await userEvent.click(screen.getByRole("button", { name: "Thêm bài tập" }));
    const modal = antModal();
    expect(within(modal).getByTestId("quiz-item-form")).toBeInTheDocument();
    await userEvent.click(modalOk(modal, "Thêm bài tập"));
    expect(toast.error).toHaveBeenCalledWith("Vui lòng nhập tiêu đề bài tập");
    await userEvent.type(within(modal).getByLabelText(/Tiêu đề/), " Nghe bài 2 ");
    await userEvent.selectOptions(within(modal).getByLabelText("Độ khó"), "HARD");
    await userEvent.clear(within(modal).getByLabelText("Thời gian (phút)"));
    await userEvent.type(within(modal).getByLabelText("Thời gian (phút)"), "25");
    await userEvent.click(modalOk(modal, "Thêm bài tập"));
    await waitFor(() => expect(client.createQuizItem).toHaveBeenCalledWith("p1", expect.objectContaining({ title: "Nghe bài 2", difficulty: "HARD", durationMinutes: 25, passingScore: 80, index: 2 }), false));
    expect(toast.success).toHaveBeenCalledWith("Đã thêm bài tập mới");
  });
});

describe("trình soạn câu hỏi (?quizId=)", () => {
  it("tải quiz + câu hỏi qua getQuizResource; breadcrumb theo tên gói; đoạn văn đọc; 'Quay lại' bỏ quizId", async () => {
    nav.set("/quiz/manage?packageId=p1&quizId=q1");
    renderPage();
    expect(await screen.findByTestId("quiz-question-editor")).toBeInTheDocument();
    expect(client.getQuizResource).toHaveBeenCalledWith("p1", "q1");
    await screen.findByText("再见 nghĩa là xin chào.");
    const rows = screen.getAllByTestId("quiz-question-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Đúng / Sai");
    expect(rows[0]).toHaveTextContent("Đáp án: Sai");
    expect(rows[1]).toHaveTextContent("Trắc nghiệm");
    expect(screen.getByTestId("quiz-question-count")).toHaveTextContent("2 câu");
    expect(screen.getByTestId("quiz-media")).toHaveTextContent("我是学生。");
    expect(await screen.findByText("Gói 1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Quay lại/ })).toHaveAttribute("href", "/quiz/manage?packageId=p1");
  });

  it("thêm câu hỏi Đúng/Sai: thiếu đáp án => toast; chọn Đúng => saveQuizQuestions với câu hỏi mới nối vào mảng, index cuối", async () => {
    nav.set("/quiz/manage?packageId=p1&quizId=q1");
    renderPage();
    await screen.findByText("再见 nghĩa là xin chào.");
    await userEvent.click(screen.getByRole("button", { name: "Thêm câu hỏi" }));
    const modal = antModal();
    expect(within(modal).getByTestId("quiz-question-form")).toBeInTheDocument();
    await userEvent.click(within(modal).getByRole("radio", { name: /Đúng \/ Sai/ }));
    await userEvent.type(within(modal).getByLabelText("Mệnh đề cần phán đoán"), "你好 là lời chào.");
    await userEvent.click(modalOk(modal, "Thêm câu hỏi"));
    expect(toast.error).toHaveBeenCalledWith("Vui lòng chọn đáp án Đúng hoặc Sai.");
    expect(client.saveQuizQuestions).not.toHaveBeenCalled();
    await userEvent.click(within(modal).getByLabelText("Đúng"));
    await userEvent.click(modalOk(modal, "Thêm câu hỏi"));
    await waitFor(() =>
      expect(client.saveQuizQuestions).toHaveBeenCalledWith(
        "p1",
        "q1",
        expect.objectContaining({ id: "q1" }),
        expect.arrayContaining([expect.objectContaining({ type: "TRUE_FALSE", prompt: "你好 là lời chào.", correctAnswer: true, index: 2 })]),
        false,
      ),
    );
    expect(toast.success).toHaveBeenCalledWith("Đã thêm!");
  });

  it("sửa câu hỏi: modal mở với dữ liệu cũ; đổi điểm => saveQuizQuestions với câu đã sửa; xoá: xác nhận rồi saveQuizQuestions không còn câu đó", async () => {
    nav.set("/quiz/manage?packageId=p1&quizId=q1");
    renderPage();
    await screen.findByText("再见 nghĩa là xin chào.");
    await userEvent.click(screen.getByRole("button", { name: /Sửa câu hỏi 你好/ }));
    const modal = antModal();
    expect(within(modal).getByLabelText("Nội dung câu hỏi")).toHaveValue("你好 nghĩa là gì?");
    await userEvent.clear(within(modal).getByLabelText("Điểm"));
    await userEvent.type(within(modal).getByLabelText("Điểm"), "20");
    await userEvent.click(modalOk(modal, "Cập nhật"));
    await waitFor(() =>
      expect(client.saveQuizQuestions).toHaveBeenCalledWith(
        "p1",
        "q1",
        expect.objectContaining({ id: "q1" }),
        expect.arrayContaining([expect.objectContaining({ id: "qq1", points: 20 })]),
        false,
      ),
    );
    expect(toast.success).toHaveBeenCalledWith("Đã cập nhật!");

    vi.mocked(confirmAction).mockResolvedValueOnce(false);
    await userEvent.click(screen.getByRole("button", { name: /Xóa câu hỏi 再见/ }));
    expect(client.saveQuizQuestions).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: /Xóa câu hỏi 再见/ }));
    await waitFor(() => {
      const lastCallQuestions = vi.mocked(client.saveQuizQuestions).mock.calls.at(-1)?.[3] as QuizQuestion[];
      expect(lastCallQuestions.find((q) => q.id === "qq2")).toBeUndefined();
    });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Đã xóa câu hỏi"));
  });

  it("bài tập chưa cấu hình => WAITING FOR BACKEND; rỗng => 'Chưa có câu hỏi nào'", async () => {
    vi.mocked(client.getQuizResource).mockRejectedValue(new ApiNotConfiguredError());
    nav.set("/quiz/manage?packageId=p1&quizId=q1");
    const { unmount } = render(
      <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
        <ManagementShell area="admin">
          <QuizManagePageContent />
        </ManagementShell>
      </Provider>,
    );
    const notice = await screen.findByTestId("quiz-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(toast.error).not.toHaveBeenCalled();
    unmount();

    vi.mocked(client.getQuizResource).mockResolvedValueOnce({ packageName: "Gói 1", item: quiz(1), questions: [] });
    renderPage();
    expect(await screen.findByTestId("quiz-questions-empty")).toHaveTextContent("Chưa có câu hỏi nào");
  });

  it("lỗi API => khối lỗi + 'Thử lại' tải lại", async () => {
    vi.mocked(client.getQuizResource).mockRejectedValueOnce(new ApiError("Lỗi câu hỏi", 500)).mockResolvedValue({ packageName: "Gói 1", item: quiz(1), questions: [] });
    nav.set("/quiz/manage?packageId=p1&quizId=q1");
    renderPage();
    const error = await screen.findByTestId("quiz-notice");
    expect(error).toHaveTextContent("Lỗi câu hỏi");
    await userEvent.click(within(error).getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByTestId("quiz-questions-empty")).toHaveTextContent("Chưa có câu hỏi nào");
  });

  it("giảng viên không có ticket QUIZ => Alert chỉ xem, không nút Thêm/Xoá câu hỏi; công tắc ghi đóng => WriteLockedNotice", async () => {
    vi.mocked(getTickets).mockResolvedValue([{ id: "t1", status: "OPEN", assignedId: "u-teacher-1", module: "GRAMMAR" }] as never);
    nav.set("/quiz/manage?packageId=p1&quizId=q1");
    const { unmount } = render(
      <Provider store={makeStore({ status: "authenticated", user: teacher })}>
        <ManagementShell area="instructor">
          <QuizManagePageContent />
        </ManagementShell>
      </Provider>,
    );
    await screen.findByText("再见 nghĩa là xin chào.");
    expect(await screen.findByTestId("content-readonly-alert")).toHaveTextContent("Chế độ Xem duy nhất");
    expect(screen.queryByRole("button", { name: "Thêm câu hỏi" })).toBeNull();
    unmount();

    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "");
    renderPage();
    await screen.findByText("再见 nghĩa là xin chào.");
    expect(screen.getByTestId("write-locked")).toHaveTextContent("WAITING FOR BACKEND");
  });
});
