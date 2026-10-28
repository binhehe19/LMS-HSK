import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QUIZ_CONFIG, QUIZ_PACKAGE_TYPES } from "@/components/management/content-quiz/quiz-config";
import { QuizManagePageContent } from "@/components/management/content-quiz/quiz-manage-page-content";
import { ManagementShell } from "@/components/management/management-shell";
import { confirmAction } from "@/components/shared/confirm-action";
import { resetContentAccessCache } from "@/hooks/use-content-access";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import * as tree from "@/lib/api/content-tree-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import * as qq from "@/lib/api/quiz-question-client";
import { getTickets } from "@/lib/api/ticket-client";
import { makeStore } from "@/redux/store";
import type { ManagementArea } from "@/lib/management/area";
import type { ContentFolder, ContentPackage, ContentStudySet } from "@/types/content";
import type { QuizItem, QuizQuestion } from "@/types/content-quiz";
import { adminUser } from "./fixtures/classes";

// Cây antd 4 cấp + cấp câu hỏi trong jsdom: 30s mặc định không đủ khi cả bộ chạy song song (xem tests/content-hanzi.test.tsx).
vi.setConfig({ testTimeout: 90_000 });

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
vi.mock("@/lib/api/quiz-question-client", () => ({ getQuiz: vi.fn(), listQuestions: vi.fn(), createQuestion: vi.fn(), updateQuestion: vi.fn(), deleteQuestion: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

vi.setConfig({ testTimeout: 30_000 });

const TARGET = { apiPrefix: "/quiz", itemsPath: "quizzes" };
const teacher = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "gv1@example.test", roles: ["ROLE_TEACHER"] };
const pkg: ContentPackage = { id: "p1", name: "Bài tập HSK 1", type: "LEARNING_PATH", publishStatus: "PUBLISHED", folderCount: 1 };
const folder: ContentFolder = { id: "f1", packageId: "p1", name: "Bài 1–3", studySetCount: 1 };
const set: ContentStudySet = { id: "s1", folderId: "f1", title: "Bài 1: Chào hỏi", skill: "LISTENING", itemCount: 2 };
const quiz = (i: number, over: Partial<QuizItem> = {}): QuizItem => ({ id: `q${i}`, studySetId: "s1", index: i - 1, title: `Quiz ${i}`, difficulty: "EASY", durationMinutes: 10, passingScore: 80, questionCount: i, ...over });
const mc: QuizQuestion = { id: "qq1", quizId: "q1", index: 1, type: "MULTIPLE_CHOICE", prompt: "你好 nghĩa là gì?", points: 10, options: [{ text: "Xin chào", isCorrect: true }, { text: "Cảm ơn", isCorrect: false }], explanation: "lời chào" };
const tf: QuizQuestion = { id: "qq2", quizId: "q1", index: 0, type: "TRUE_FALSE", prompt: "再见 nghĩa là xin chào.", points: 5, correctAnswer: false };

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
  for (const fn of [...Object.values(tree), ...Object.values(qq)]) if (typeof fn === "function" && "mockReset" in fn) vi.mocked(fn as unknown as ReturnType<typeof vi.fn>).mockReset();
  vi.mocked(tree.listPackages).mockResolvedValue([pkg]);
  vi.mocked(tree.listFolders).mockResolvedValue([folder]);
  vi.mocked(tree.listStudySets).mockResolvedValue([set]);
  vi.mocked(tree.getStudySet).mockResolvedValue(set);
  vi.mocked(tree.listItems).mockResolvedValue([quiz(2, { difficulty: "HARD", durationMinutes: 0, skill: "READING" }), quiz(1)]);
  vi.mocked(tree.createItem).mockResolvedValue(quiz(3));
  vi.mocked(tree.createStudySet).mockResolvedValue(set);
  vi.mocked(qq.getQuiz).mockResolvedValue(quiz(1, { passageText: "我是学生。", skill: "LISTENING" }));
  vi.mocked(qq.listQuestions).mockResolvedValue([mc, tf]);
  vi.mocked(qq.createQuestion).mockResolvedValue({ ...tf, id: "qq3" });
  vi.mocked(qq.updateQuestion).mockResolvedValue(mc);
  vi.mocked(qq.deleteQuestion).mockResolvedValue({});
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
const antModal = () => document.querySelector(".ant-modal") as HTMLElement;
const modalOk = (modal: HTMLElement, name: RegExp | string) => within(modal).getByRole("button", { name });

describe("QUIZ_CONFIG trên nền content-tree", () => {
  it("config: module QUIZ, prefix /quiz, mục quizzes, hasSkill với 8 kỹ năng, 4 loại gói của quiz cũ, nhãn Bộ đề/Bài tập", () => {
    expect(QUIZ_CONFIG).toMatchObject({ module: "QUIZ", apiPrefix: "/quiz", itemsPath: "quizzes", hasSkill: true, pageClassName: "manage-quiz-page", supportsImport: true });
    expect(QUIZ_CONFIG.skills?.map((s) => s.value)).toContain("GRAMMAR_3_0");
    expect(QUIZ_PACKAGE_TYPES.map((t) => t.value)).toEqual(["LEARNING_PATH", "FREE", "LEARNING", "VIDEO_COURSE"]);
    expect(QUIZ_CONFIG.labels).toEqual({ package: "Package", folder: "Thư mục", studySet: "Bộ đề", item: "Bài tập" });
  });

  it("cấp bài tập: tiêu đề/class trang, bảng theo index với cột Độ khó/Thời gian/Điểm đạt/Câu hỏi; liên kết 'Soạn câu hỏi' giữ query và thêm quizId", async () => {
    nav.set("/quiz/manage?packageId=p1&folderId=f1&studySetId=s1");
    renderPage();
    await screen.findByText("Quiz 1");
    expect(tree.listItems).toHaveBeenCalledWith(TARGET, "s1");
    expect(document.querySelector(".content.manage-quiz-page.content-tree-page .card.manage-lp-container")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 5, name: /Quản lý Bài tập/ })).toBeInTheDocument();
    const rows = document.querySelectorAll(".ant-table-tbody tr.ant-table-row");
    expect(rows[0]).toHaveTextContent("Quiz 1");
    expect(rows[0]).toHaveTextContent("Dễ");
    expect(rows[0]).toHaveTextContent("10 phút");
    expect(rows[0]).toHaveTextContent("80%");
    expect(rows[0]).toHaveTextContent("Theo bộ đề");
    expect(rows[1]).toHaveTextContent("Khó");
    expect(rows[1]).toHaveTextContent("Không giới hạn");
    expect(rows[1]).toHaveTextContent("Đọc");
    expect(screen.getByRole("link", { name: "Soạn câu hỏi Quiz 1" })).toHaveAttribute("href", "/quiz/manage?packageId=p1&folderId=f1&studySetId=s1&quizId=q1");
    expect(screen.getByText("Tổng số bài tập:")).toBeInTheDocument();
  });

  it("tạo bộ đề: ô Kỹ năng bắt buộc (hasSkill); thiếu => toast 'Vui lòng chọn kỹ năng'; chọn => createStudySet với skill", async () => {
    nav.set("/quiz/manage?packageId=p1&folderId=f1");
    renderPage();
    await screen.findByText("Bài 1: Chào hỏi");
    await userEvent.click(screen.getByRole("button", { name: "Thêm bộ đề" }));
    const modal = antModal();
    const skill = within(modal).getByLabelText("Kỹ năng");
    expect(within(skill).getAllByRole("option")).toHaveLength(9); // "Chọn kỹ năng" + 8
    await userEvent.type(within(modal).getByLabelText("Tên Bộ đề"), "Đề số 2");
    await userEvent.click(modalOk(modal, "Tạo Bộ đề"));
    expect(toast.error).toHaveBeenCalledWith("Vui lòng chọn kỹ năng");
    expect(tree.createStudySet).not.toHaveBeenCalled();
    await userEvent.selectOptions(skill, "WRITING");
    await userEvent.click(modalOk(modal, "Tạo Bộ đề"));
    await waitFor(() => expect(tree.createStudySet).toHaveBeenCalledWith(TARGET, expect.objectContaining({ folderId: "f1", title: "Đề số 2", skill: "WRITING" }), false));
  });

  it("thêm bài tập: form quiz; thiếu tiêu đề => toast; đủ => createItem(studySetId, body chuẩn hoá + index cuối)", async () => {
    nav.set("/quiz/manage?packageId=p1&folderId=f1&studySetId=s1");
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
    await waitFor(() => expect(tree.createItem).toHaveBeenCalledWith(TARGET, "s1", expect.objectContaining({ title: "Nghe bài 2", difficulty: "HARD", durationMinutes: 25, passingScore: 80, skill: undefined, index: 2 }), false));
    expect(toast.success).toHaveBeenCalledWith("Đã thêm bài tập mới");
  });
});

describe("trình soạn câu hỏi (?quizId=)", () => {
  it("tải quiz + câu hỏi + bộ đề; breadcrumb; danh sách theo index; đoạn văn đọc; 'Quay lại' bỏ quizId", async () => {
    nav.set("/quiz/manage?packageId=p1&folderId=f1&studySetId=s1&quizId=q1");
    renderPage();
    expect(await screen.findByTestId("quiz-question-editor")).toBeInTheDocument();
    expect(qq.getQuiz).toHaveBeenCalledWith("q1");
    expect(qq.listQuestions).toHaveBeenCalledWith("q1");
    expect(tree.getStudySet).toHaveBeenCalledWith(TARGET, "s1");
    expect(tree.listItems).not.toHaveBeenCalled();
    await screen.findByText("再见 nghĩa là xin chào.");
    const rows = screen.getAllByTestId("quiz-question-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Đúng / Sai");
    expect(rows[0]).toHaveTextContent("Đáp án: Sai");
    expect(rows[1]).toHaveTextContent("Trắc nghiệm");
    expect(rows[1]).toHaveTextContent("Xin chào");
    expect(rows[1]).toHaveTextContent("lời chào");
    expect(screen.getByTestId("quiz-question-count")).toHaveTextContent("2 câu");
    expect(screen.getByTestId("quiz-media")).toHaveTextContent("我是学生。");
    const crumbs = [...screen.getByTestId("quiz-breadcrumb").querySelectorAll("li")].map((li) => li.textContent?.trim());
    await waitFor(() => expect(crumbs.length).toBe(3));
    expect(await screen.findByText("Bài 1: Chào hỏi")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Quay lại/ })).toHaveAttribute("href", "/quiz/manage?packageId=p1&folderId=f1&studySetId=s1");
    expect(document.querySelector(".content.manage-quiz-page")).not.toBeNull();
  });

  it("thêm câu hỏi Đúng/Sai: thiếu đáp án => toast; chọn Đúng => createQuestion(quizId, body chuẩn hoá, index = số câu) + toast 'Đã thêm!'", async () => {
    nav.set("/quiz/manage?packageId=p1&folderId=f1&studySetId=s1&quizId=q1");
    renderPage();
    await screen.findByText("再见 nghĩa là xin chào.");
    await userEvent.click(screen.getByRole("button", { name: "Thêm câu hỏi" }));
    const modal = antModal();
    expect(within(modal).getByTestId("quiz-question-form")).toBeInTheDocument();
    expect(within(modal).getByRole("radio", { name: /Xây dựng câu/ })).toBeDisabled();
    await userEvent.click(within(modal).getByRole("radio", { name: /Đúng \/ Sai/ }));
    await userEvent.type(within(modal).getByLabelText("Mệnh đề cần phán đoán"), "你好 là lời chào.");
    await userEvent.click(modalOk(modal, "Thêm câu hỏi"));
    expect(toast.error).toHaveBeenCalledWith("Vui lòng chọn đáp án Đúng hoặc Sai.");
    expect(qq.createQuestion).not.toHaveBeenCalled();
    await userEvent.click(within(modal).getByLabelText("Đúng"));
    await userEvent.click(modalOk(modal, "Thêm câu hỏi"));
    await waitFor(() => expect(qq.createQuestion).toHaveBeenCalledWith("q1", expect.objectContaining({ type: "TRUE_FALSE", prompt: "你好 là lời chào.", points: 10, correctAnswer: true, index: 2 }), false));
    expect(vi.mocked(qq.createQuestion).mock.calls[0][1]).not.toHaveProperty("options");
    expect(toast.success).toHaveBeenCalledWith("Đã thêm!");
    await waitFor(() => expect(qq.listQuestions).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(document.querySelector(".ant-modal")).toBeNull());
  });

  it("thêm trắc nghiệm: 2 lựa chọn, chọn đáp án đúng, bỏ lựa chọn trống => options gọn", async () => {
    nav.set("/quiz/manage?packageId=p1&folderId=f1&studySetId=s1&quizId=q1");
    renderPage();
    await screen.findByText("再见 nghĩa là xin chào.");
    await userEvent.click(screen.getByRole("button", { name: "Thêm câu hỏi" }));
    const modal = antModal();
    await userEvent.type(within(modal).getByLabelText("Nội dung câu hỏi"), "谢谢 nghĩa là?");
    await userEvent.type(within(modal).getByLabelText("Lựa chọn 1"), "Cảm ơn");
    await userEvent.type(within(modal).getByLabelText("Lựa chọn 2"), "Xin lỗi");
    await userEvent.click(modalOk(modal, "Thêm câu hỏi"));
    expect(toast.error).toHaveBeenCalledWith("Trắc nghiệm chỉ được có 1 đáp án đúng.");
    await userEvent.click(within(modal).getByLabelText("Lựa chọn 1 là đáp án đúng"));
    await userEvent.click(modalOk(modal, "Thêm câu hỏi"));
    await waitFor(() => expect(qq.createQuestion).toHaveBeenCalledWith("q1", expect.objectContaining({ type: "MULTIPLE_CHOICE", prompt: "谢谢 nghĩa là?", options: [{ text: "Cảm ơn", isCorrect: true }, { text: "Xin lỗi", isCorrect: false }] }), false));
  });

  it("sửa câu hỏi: modal mở với dữ liệu cũ; đổi điểm => updateQuestion(id, body, false) giữ index; xoá: xác nhận rồi deleteQuestion", async () => {
    nav.set("/quiz/manage?packageId=p1&folderId=f1&studySetId=s1&quizId=q1");
    renderPage();
    await screen.findByText("再见 nghĩa là xin chào.");
    await userEvent.click(screen.getByRole("button", { name: /Sửa câu hỏi 你好/ }));
    const modal = antModal();
    expect(within(modal).getByLabelText("Nội dung câu hỏi")).toHaveValue("你好 nghĩa là gì?");
    expect(within(modal).getByLabelText("Lựa chọn 1")).toHaveValue("Xin chào");
    await userEvent.clear(within(modal).getByLabelText("Điểm"));
    await userEvent.type(within(modal).getByLabelText("Điểm"), "20");
    await userEvent.click(modalOk(modal, "Cập nhật"));
    await waitFor(() => expect(qq.updateQuestion).toHaveBeenCalledWith("qq1", expect.objectContaining({ type: "MULTIPLE_CHOICE", points: 20, index: 1 }), false));
    expect(toast.success).toHaveBeenCalledWith("Đã cập nhật!");
    await waitFor(() => expect(document.querySelector(".ant-modal")).toBeNull());

    vi.mocked(confirmAction).mockResolvedValueOnce(false);
    await userEvent.click(screen.getByRole("button", { name: /Xóa câu hỏi 再见/ }));
    await waitFor(() => expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xóa câu hỏi", danger: true })));
    expect(qq.deleteQuestion).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Xóa câu hỏi 再见/ }));
    await waitFor(() => expect(qq.deleteQuestion).toHaveBeenCalledWith("qq2", false));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Đã xóa câu hỏi"));
  });

  it("quiz chưa cấu hình => WAITING FOR BACKEND; câu hỏi lỗi => khối lỗi + Thử lại tải lại; rỗng => 'Chưa có câu hỏi nào'", async () => {
    vi.mocked(qq.getQuiz).mockRejectedValue(new ApiNotConfiguredError());
    vi.mocked(qq.listQuestions).mockRejectedValue(new ApiNotConfiguredError());
    nav.set("/quiz/manage?packageId=p1&folderId=f1&studySetId=s1&quizId=q1");
    const { unmount } = render(
      <Provider store={makeStore({ status: "authenticated", user: adminUser })}>
        <ManagementShell area="admin">
          <QuizManagePageContent />
        </ManagementShell>
      </Provider>,
    );
    const notice = await screen.findByTestId("quiz-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(notice).toHaveTextContent("WAITING FOR BACKEND");
    expect(toast.error).not.toHaveBeenCalled();
    unmount();

    vi.mocked(qq.getQuiz).mockResolvedValue(quiz(1));
    vi.mocked(qq.listQuestions).mockRejectedValueOnce(new ApiError("Lỗi câu hỏi", 500)).mockResolvedValue([]);
    renderPage();
    const error = await screen.findByTestId("quiz-questions-notice");
    expect(error).toHaveTextContent("Lỗi câu hỏi");
    await userEvent.click(within(error).getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByTestId("quiz-questions-empty")).toHaveTextContent("Chưa có câu hỏi nào");
  });

  it("giảng viên không có ticket QUIZ => Alert chỉ xem, không nút Thêm/Sửa/Xoá câu hỏi; công tắc ghi đóng => WriteLockedNotice", async () => {
    vi.mocked(getTickets).mockResolvedValue([{ id: "t1", status: "OPEN", assignedId: "u-teacher-1", module: "GRAMMAR" }] as never);
    nav.set("/quiz/manage?packageId=p1&folderId=f1&studySetId=s1&quizId=q1");
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
    expect(screen.queryByRole("button", { name: /Xóa câu hỏi/ })).toBeNull();
    unmount();

    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "");
    renderPage();
    await screen.findByText("再见 nghĩa là xin chào.");
    expect(screen.getByTestId("write-locked")).toHaveTextContent("WAITING FOR BACKEND");
    expect(screen.queryByRole("button", { name: "Thêm câu hỏi" })).toBeNull();
  });
});
