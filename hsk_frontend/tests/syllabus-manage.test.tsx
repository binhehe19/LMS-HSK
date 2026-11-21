import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { Provider } from "react-redux";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManagementShell } from "@/components/management/management-shell";
import { SyllabusManagePageContent } from "@/components/management/syllabus/syllabus-manage-page-content";
import { confirmAction } from "@/components/shared/confirm-action";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import type { AuthUser } from "@/lib/api/auth-client";
import { getSyllabus, listSyllabusVersions, listSyllabuses, requestCmsCacheEvict } from "@/lib/api/lms-syllabus-client";
import { listFlashcardPackages, listPackageItems } from "@/lib/api/lms-content-client";
import { listGrammarPackages, listPackageGrammarPoints } from "@/lib/api/lms-grammar-client";
import { listPackageQuizItems, listQuizPackages } from "@/lib/api/lms-quiz-client";
import { getUnreadCount } from "@/lib/api/notification-client";
import { attachLibraryItemsToSchedule, listScheduleResources, removeScheduleResource, reorderScheduleResources, type ScheduleResourceLink } from "@/lib/api/syllabus-schedule-resources-client";
import { getTickets } from "@/lib/api/ticket-client";
import type { ManagementArea } from "@/lib/management/area";
import { makeStore } from "@/redux/store";
import type { SyllabusDetailResponse, SyllabusSummaryResponse, SyllabusVersionResponse } from "@/types/lms";
import { adminUser } from "./fixtures/classes";

const PATH = "/learning-path/syllabus/manage";
// Màn có sidebar + antd Table/Modal: mỗi ca render nặng, các ca nhiều bước cần hạn dài hơn 5 s mặc định.
const LONG = 30_000;

// Router giả CÓ trạng thái: push/replace đổi URL hiện tại và báo cho useSearchParams (giống Next thật).
const nav = vi.hoisted(() => {
  let url = "/learning-path/syllabus/manage";
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
vi.mock("@/lib/api/lms-syllabus-client", () => ({ listSyllabuses: vi.fn(), getSyllabus: vi.fn(), listSyllabusVersions: vi.fn(), requestCmsCacheEvict: vi.fn() }));
vi.mock("@/lib/api/syllabus-schedule-resources-client", () => ({ listScheduleResources: vi.fn(), attachLibraryItemsToSchedule: vi.fn(), reorderScheduleResources: vi.fn(), removeScheduleResource: vi.fn() }));
vi.mock("@/lib/api/lms-content-client", () => ({ listFlashcardPackages: vi.fn(), listPackageItems: vi.fn() }));
vi.mock("@/lib/api/lms-quiz-client", () => ({ listQuizPackages: vi.fn(), listPackageQuizItems: vi.fn() }));
vi.mock("@/lib/api/lms-grammar-client", () => ({ listGrammarPackages: vi.fn(), listPackageGrammarPoints: vi.fn() }));
vi.mock("sonner", async (importOriginal) => ({ ...(await importOriginal<typeof import("sonner")>()), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// Hộp xác nhận antd (Modal.confirm) không render được trong jsdom; kiểm tra hợp đồng của màn với confirmAction thay vì nội bộ antd.
vi.mock("@/components/shared/confirm-action", () => ({ confirmAction: vi.fn() }));

const teacher: AuthUser = { ...adminUser, id: "u-teacher-1", fullName: "Giáo Viên Một", email: "gv1@example.test", roles: ["ROLE_TEACHER"] };
const syl = (i: number): SyllabusSummaryResponse => ({ id: `syl-${i}`, name: `Giáo trình HSK ${i}`, code: `GT-${i}`, educationLevelName: `HSK ${i}`, type: "STANDARD", author: "Tổ chuyên môn", latestVersionNo: 2, createdAt: "2026-01-15T08:00:00Z" });
const SCH1 = "syl-1-sch-1";
const SCH2 = "syl-1-sch-2";
const detail: SyllabusDetailResponse = {
  ...syl(1),
  status: "PUBLISHED",
  description: "Mô tả giáo trình",
  trainingProgram: "Tiếng Trung tổng quát",
  minimumPassingScore: 60,
  scoreRange: "0–100",
  clo: [{ id: "c1", code: "CLO1", name: "Nghe hiểu hội thoại", description: "Nghe hiểu hội thoại thường ngày" }],
  materials: [{ id: "mat1", title: "HSK Standard Course 1", type: "Giáo trình chính", author: "Jiang Liping", publisher: "BLCUP", year: 2015 }],
  schedule: [
    {
      id: SCH1,
      topic: "Buổi 1: Chào hỏi",
      content: "Chào hỏi, giới thiệu bản thân",
      delivery: "Trực tuyến",
      coreCloId: ["c1"],
      moduleOnLuyen: [{ moduleType: "QUIZ", moduleContent: "Bài tập buổi 1" }],
      studentMaterials: [{ materialTitle: "Slide buổi 1", materialLink: "https://files.test/slide-1" }],
      teacherMaterials: [{ materialTitle: "Giáo án 1", materialLink: "#" }],
      studentTasks: "Làm bài tập về nhà",
      teacherTasks: "Chấm bài trong 3 ngày",
    },
    { id: SCH2, topic: "Buổi 2: Gia đình", content: "Từ vựng gia đình", delivery: "Trực tuyến", moduleOnLuyen: [{ moduleType: "GRAMMAR", moduleContent: "Ngữ pháp 的" }] },
  ],
  gradingStructure: [{ id: "g1", item: "Chuyên cần", type: "Điểm danh", weight: 10, cloIds: ["c1"] }],
  testTemplate: { midtermFormat: "Trắc nghiệm 40 câu", finalFormat: "Nghe – Đọc – Viết" },
};
const versions: SyllabusVersionResponse[] = [
  { id: "v1", versionNo: 1, status: "ARCHIVED", publishedAt: "2026-01-15T08:00:00Z", publishedBy: "admin" },
  { id: "v2", versionNo: 2, status: "PUBLISHED", publishedAt: "2026-06-01T08:00:00Z", publishedBy: "admin", changeNote: "Cập nhật buổi 7–10" },
];
// Buổi 1 (sessionNo=1): 1 Từ vựng (#1) + 1 Quiz (#2); buổi 2 (sessionNo=2): rỗng.
const linkFor = (type: string, id: string, displayOrder: number, content: unknown): ScheduleResourceLink => ({ id: `rl-${id}`, learningResourceId: id, learningResourceVersionId: `${id}-v1`, sessionNo: 1, displayOrder, resourceType: type, resourceContent: content });
const vocabLink = linkFor("VOCABULARY", "res-vocab-1", 0, { word: "Từ vựng buổi 1" });
const quizLink = linkFor("ASSESSMENT", "res-quiz-1", 1, { title: "Bài tập buổi 1" });
const flashcardPackages = [{ id: "pkg-flashcard-1", name: "Từ vựng HSK 1 — Bài 1", type: "VOCABULARY" }];
const flashcardItems = [
  { id: "item-f1", studySetId: "", index: 0, term: "你好", meaning: "Xin chào" },
  { id: "item-f2", studySetId: "", index: 1, term: "谢谢", meaning: "Cảm ơn" },
];

function scheduleResourcesImpl(syllabusId: string, type: string, sessionNo: number): Promise<ScheduleResourceLink[]> {
  if (sessionNo !== 1) return Promise.resolve([]);
  if (type === "VOCABULARY") return Promise.resolve([vocabLink]);
  if (type === "ASSESSMENT") return Promise.resolve([quizLink]);
  return Promise.resolve([]);
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_AUTH_FRONTEND_URL", "http://auth.test.invalid");
  vi.mocked(getUnreadCount).mockReset().mockResolvedValue(0);
  vi.mocked(getTickets).mockReset().mockResolvedValue([] as never);
  vi.mocked(listSyllabuses).mockReset().mockResolvedValue([syl(1), syl(2), syl(3)]);
  vi.mocked(getSyllabus).mockReset().mockResolvedValue(detail);
  vi.mocked(listSyllabusVersions).mockReset().mockResolvedValue(versions);
  vi.mocked(requestCmsCacheEvict).mockReset().mockResolvedValue(undefined);
  vi.mocked(listScheduleResources).mockReset().mockImplementation(scheduleResourcesImpl);
  vi.mocked(attachLibraryItemsToSchedule).mockReset().mockResolvedValue({ added: 1, failed: [] });
  vi.mocked(reorderScheduleResources).mockReset().mockResolvedValue(undefined);
  vi.mocked(removeScheduleResource).mockReset().mockResolvedValue(undefined);
  vi.mocked(listFlashcardPackages).mockReset().mockResolvedValue(flashcardPackages as never);
  vi.mocked(listPackageItems).mockReset().mockResolvedValue(flashcardItems as never);
  vi.mocked(listQuizPackages).mockReset().mockResolvedValue([]);
  vi.mocked(listPackageQuizItems).mockReset().mockResolvedValue([]);
  vi.mocked(listGrammarPackages).mockReset().mockResolvedValue([]);
  vi.mocked(listPackageGrammarPoints).mockReset().mockResolvedValue([]);
  vi.mocked(confirmAction).mockReset().mockResolvedValue(true);
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  nav.push.length = 0;
  nav.replace.length = 0;
  nav.set(PATH);
});

function renderPage(user: AuthUser = adminUser, area: ManagementArea = "admin") {
  render(
    <Provider store={makeStore({ status: "authenticated", user })}>
      <ManagementShell area={area}>
        <SyllabusManagePageContent />
      </ManagementShell>
    </Provider>,
  );
}

// Query theo chữ/nhãn (nhanh) thay *ByRole trên DOM lớn (sidebar + antd), vốn tính tên trợ năng cho mọi phần tử.
const button = (text: string, root: HTMLElement | Document = document) => {
  const el = within(root as HTMLElement).getByText(text, { selector: "button, button > span" });
  return (el.closest("button") ?? el) as HTMLButtonElement;
};
const tab = (label: string) => screen.getByText(label, { selector: "button[role=tab]" });
const addButtons = () => screen.queryAllByText("Thêm module", { selector: "button" }) as HTMLButtonElement[];
const scheduleRows = () => screen.getAllByTestId("schedule-row");
const moduleTexts = (row: HTMLElement) => within(row).queryAllByTestId("module-item").map((el) => el.firstElementChild?.textContent);

describe("chế độ danh sách (?view trống) — dữ liệu thật từ backend chung", () => {
  it("Admin: tải danh sách một lần, hiển thị bảng giáo trình và phân trang theo mẫu học phần", async () => {
    renderPage();
    await screen.findByText("Giáo trình HSK 1");
    expect(listSyllabuses).toHaveBeenCalledTimes(1);
    expect(getSyllabus).not.toHaveBeenCalled();
    expect([...document.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["STT", "Tên giáo trình", "Mã", "Cấp độ", "Loại", "Tác giả", "Phiên bản mới nhất", "Ngày tạo", "Thao tác"]);
    expect(screen.getAllByText("15/01/2026")).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "Giáo trình", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("20 / trang")).toBeInTheDocument();
    expect(screen.getByText("3 bản ghi")).toBeInTheDocument();
    expect(screen.queryByText("Chế độ Xem duy nhất")).toBeNull(); // Admin luôn có quyền
  });

  it("tìm kiếm client theo tên/mã/cấp độ; không khớp => 'Không tìm thấy giáo trình phù hợp'", async () => {
    renderPage();
    await screen.findByText("Giáo trình HSK 1");
    const search = screen.getByPlaceholderText("Tên, mã, cấp độ, loại, tác giả");
    await userEvent.type(search, "gt-2");
    expect(screen.queryByText("Giáo trình HSK 1")).toBeNull();
    expect(screen.getByText("Giáo trình HSK 2")).toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, "không có gì");
    expect(await screen.findByText("Không tìm thấy giáo trình phù hợp")).toBeInTheDocument();
  }, LONG);

  it("bấm 'Xem chi tiết' => push ?view=<id> (quay lại của trình duyệt về danh sách) và chuyển sang chế độ chi tiết", async () => {
    renderPage();
    await screen.findByText("Giáo trình HSK 2");
    await userEvent.click(screen.getByLabelText("Thao tác Giáo trình HSK 2"));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Xem chi tiết" }));
    expect(nav.push).toEqual([`${PATH}?view=syl-2`]);
    await screen.findByTestId("syllabus-title");
    expect(getSyllabus).toHaveBeenCalledWith("syl-2");
  });

  it("rỗng thật => 'Chưa có giáo trình', không khối lỗi", async () => {
    vi.mocked(listSyllabuses).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Chưa có giáo trình")).toBeInTheDocument();
    expect(screen.queryByTestId("syllabus-notice")).toBeNull();
  });

  it("dịch vụ chưa cấu hình => WAITING FOR BACKEND, không toast, không bảng", async () => {
    vi.mocked(listSyllabuses).mockRejectedValue(new ApiNotConfiguredError());
    renderPage();
    const notice = await screen.findByTestId("syllabus-notice");
    expect(notice).toHaveAttribute("data-kind", "waiting");
    expect(notice).toHaveTextContent("WAITING FOR BACKEND");
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByTestId("syllabus-list")).toBeNull();
  });

  it("lỗi => toast (như bản cũ) + khối lỗi có 'Thử lại'; thử lại tải được", async () => {
    vi.mocked(listSyllabuses).mockRejectedValueOnce(new ApiError("Máy chủ lỗi", 500)).mockResolvedValueOnce([syl(1)]);
    renderPage();
    const notice = await screen.findByTestId("syllabus-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(toast.error).toHaveBeenCalledWith("Máy chủ lỗi");
    await userEvent.click(button("Thử lại", notice));
    expect(await screen.findByText("Giáo trình HSK 1")).toBeInTheDocument();
    expect(listSyllabuses).toHaveBeenCalledTimes(2);
    expect(requestCmsCacheEvict).toHaveBeenCalledTimes(1); // Admin: tải lại thì xoá cache ERP trước
  });
});

describe("chế độ chi tiết (?view=<id>) — chỉ đọc từ backend chung", () => {
  it("gọi getSyllabus + listSyllabusVersions với id từ URL, KHÔNG gọi danh sách; tab mặc định 'Thông tin chung'; nút quay lại => push đường dẫn gốc", async () => {
    nav.set(`${PATH}?view=syl-1`);
    renderPage();
    expect(await screen.findByTestId("syllabus-title")).toHaveTextContent("Giáo trình HSK 1");
    expect(getSyllabus).toHaveBeenCalledWith("syl-1");
    expect(listSyllabusVersions).toHaveBeenCalledWith("syl-1");
    expect(listSyllabuses).not.toHaveBeenCalled();
    const grid = screen.getByTestId("info-grid");
    expect(within(grid).getByText("Chương trình đào tạo").nextElementSibling).toHaveTextContent("Tiếng Trung tổng quát");
    expect(within(grid).getByText("Điểm đạt tối thiểu").nextElementSibling).toHaveTextContent("60");
    expect(within(grid).getByText("Ghi chú").nextElementSibling).toHaveTextContent("—");
    expect(tab("Thông tin chung")).toHaveAttribute("aria-selected", "true");
    await userEvent.click(button("Danh sách giáo trình"));
    expect(nav.push).toEqual([PATH]);
  });

  it("đổi tab => replace ?view&tab (không thêm lịch sử); CLO / Tài liệu / Cấu trúc đánh giá / Mẫu bài kiểm tra hiện theo DTO", async () => {
    nav.set(`${PATH}?view=syl-1`);
    renderPage();
    await screen.findByTestId("syllabus-title");
    await userEvent.click(tab("CLO"));
    expect(nav.replace.at(-1)).toBe(`${PATH}?view=syl-1&tab=clo`);
    expect(nav.push).toEqual([]);
    expect(await screen.findByTestId("clo-table")).toHaveTextContent("CLO1");
    await userEvent.click(tab("Tài liệu"));
    expect(await screen.findByTestId("materials-table")).toHaveTextContent("Jiang Liping");
    await userEvent.click(tab("Cấu trúc đánh giá"));
    const grading = await screen.findByTestId("grading-table");
    expect(grading).toHaveTextContent("Chuyên cần");
    expect(grading).toHaveTextContent("CLO1"); // cloIds => mã CLO
    await userEvent.click(tab("Mẫu bài kiểm tra"));
    expect(await screen.findByText("Trắc nghiệm 40 câu")).toBeInTheDocument();
    expect(getSyllabus).toHaveBeenCalledTimes(1); // đổi tab không tải lại chi tiết
  }, LONG);

  it("tab Phiên bản: 2 dòng từ /versions", async () => {
    nav.set(`${PATH}?view=syl-1&tab=versions`);
    renderPage();
    const table = await screen.findByTestId("versions-table");
    expect(within(table).getAllByRole("row")).toHaveLength(3); // 1 header + 2
    expect(table).toHaveTextContent("ARCHIVED");
    expect(table).toHaveTextContent("Cập nhật buổi 7–10");
    expect(table).toHaveTextContent("01/06/2026");
  });

  it("phiên bản lỗi => notice riêng có 'Thử lại', chi tiết vẫn hiện (không che)", async () => {
    vi.mocked(listSyllabusVersions).mockRejectedValue(new ApiError("Lỗi phiên bản", 500));
    nav.set(`${PATH}?view=syl-1&tab=versions`);
    renderPage();
    const notice = await screen.findByTestId("versions-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(notice).toHaveTextContent("Lỗi phiên bản");
    expect(button("Thử lại", notice)).toBeInTheDocument();
    expect(screen.getByTestId("syllabus-title")).toHaveTextContent("Giáo trình HSK 1");
  });

  it("?view không an toàn => thông báo, KHÔNG gọi API; 'Về danh sách giáo trình' => push đường dẫn gốc", async () => {
    nav.set(`${PATH}?view=a%2Fb`);
    renderPage();
    const notice = await screen.findByTestId("syllabus-notice");
    expect(notice).toHaveAttribute("data-kind", "invalid-id");
    expect(getSyllabus).not.toHaveBeenCalled();
    expect(listSyllabuses).not.toHaveBeenCalled();
    await userEvent.click(button("Về danh sách giáo trình"));
    expect(nav.push).toEqual([PATH]);
  });

  it("chi tiết chưa cấu hình => waiting; 404 => lỗi + toast + 'Thử lại'", async () => {
    vi.mocked(getSyllabus).mockRejectedValueOnce(new ApiNotConfiguredError());
    nav.set(`${PATH}?view=syl-9`);
    renderPage();
    expect(await screen.findByTestId("syllabus-notice")).toHaveAttribute("data-kind", "waiting");
    expect(toast.error).not.toHaveBeenCalled();
    vi.mocked(getSyllabus).mockRejectedValueOnce(new ApiError("Không tìm thấy giáo trình (MOCK)", 404)).mockResolvedValueOnce(detail);
    expect(requestCmsCacheEvict).not.toHaveBeenCalled(); // mở trang không xoá cache
    await userEvent.click(button("Tải lại"));
    expect(requestCmsCacheEvict).toHaveBeenCalledTimes(1);
    const err = await screen.findByTestId("syllabus-notice");
    expect(err).toHaveAttribute("data-kind", "error");
    expect(toast.error).toHaveBeenCalledWith("Không tìm thấy giáo trình (MOCK)");
    await userEvent.click(button("Thử lại", err));
    expect(await screen.findByTestId("syllabus-title")).toBeInTheDocument();
  }, LONG);
});

describe("tab Lịch trình + module ôn luyện (Admin) — gắn trực tiếp vào ContentPackage của giáo trình (cơ chế IELTS)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
    nav.set(`${PATH}?view=syl-1&tab=schedule`);
  });

  it("gọi listScheduleResources cho TỪNG buổi×loại; buổi 1 có Từ vựng + Quiz, buổi 2 trống; cột Cần bổ sung đối chiếu; tài liệu chỉ mở khi là URL", async () => {
    renderPage();
    const rows = await waitFor(() => {
      const r = scheduleRows();
      expect(moduleTexts(r[0])).toHaveLength(2);
      return r;
    });
    expect(rows).toHaveLength(2);
    expect(vi.mocked(listScheduleResources).mock.calls.map((c) => [c[0], c[1], c[2]])).toEqual(
      expect.arrayContaining([
        ["syl-1", "VOCABULARY", 1],
        ["syl-1", "ASSESSMENT", 1],
        ["syl-1", "GRAMMAR", 1],
        ["syl-1", "VOCABULARY", 2],
      ]),
    );
    expect(moduleTexts(rows[0])).toEqual(["#1 Từ vựng buổi 1", "#2 Bài tập buổi 1"]);
    expect(rows[0]).toHaveTextContent("Đủ module theo cột này");
    expect(within(rows[1]).getByText("Chưa có module")).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent("Buổi này nên thêm:");
    expect(within(rows[1]).getByText("GRAMMAR")).toHaveClass("missing-type-list");
    expect(within(rows[0]).getByText("Slide buổi 1").closest("a")).toHaveAttribute("href", "https://files.test/slide-1");
    expect(within(rows[0]).getByText("Giáo án 1").closest("a")).toBeNull(); // "#" không mở được => chỉ chữ
    expect(rows[0]).toHaveTextContent("CLO1");
    expect(screen.getByText("Phạm vi rút gọn (D-UI-3)")).toBeInTheDocument();
    expect(screen.queryByText("Chế độ Xem duy nhất")).toBeNull();
    expect(screen.queryByTestId("write-locked")).toBeNull();
    expect(addButtons()).toHaveLength(2);
  });

  it("'Đưa xuống' mục Từ vựng (duy nhất trong nhóm) => bị khoá cả 2 đầu vì nhóm chỉ có 1 mục", async () => {
    renderPage();
    await screen.findAllByTestId("module-item");
    const rows = scheduleRows();
    const upButtons = within(rows[0]).getAllByLabelText("Đưa lên");
    const downButtons = within(rows[0]).getAllByLabelText("Đưa xuống");
    // Mỗi nhóm (Từ vựng, Quiz) chỉ có 1 mục => cả ↑ và ↓ đều khoá.
    expect(upButtons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    expect(downButtons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });

  it("Xóa => hỏi xác nhận (confirmAction, nút nguy hiểm); đồng ý => removeScheduleResource(syllabusId, type, resourceId) + toast + tải lại", async () => {
    renderPage();
    const first = (await screen.findAllByTestId("module-item"))[0];
    await userEvent.click(within(first).getByLabelText("Xóa module"));
    await waitFor(() => expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Xóa module ôn luyện?", okText: "Xóa", danger: true })));
    await waitFor(() => expect(removeScheduleResource).toHaveBeenCalledWith("syl-1", "VOCABULARY", "res-vocab-1", false));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã xóa module"));
  });

  it("Xóa => từ chối xác nhận => KHÔNG gọi API, không toast", async () => {
    vi.mocked(confirmAction).mockResolvedValue(false);
    renderPage();
    const first = (await screen.findAllByTestId("module-item"))[0];
    await userEvent.click(within(first).getByLabelText("Xóa module"));
    await waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
    expect(removeScheduleResource).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("lỗi ghi (403) => toast thông điệp của API, KHÔNG toast thành công", async () => {
    vi.mocked(removeScheduleResource).mockRejectedValue(new ApiError("Bạn không có quyền thực hiện thao tác này.", 403));
    renderPage();
    const first = (await screen.findAllByTestId("module-item"))[0];
    await userEvent.click(within(first).getByLabelText("Xóa module"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Bạn không có quyền thực hiện thao tác này."));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it(
    "Thêm module: hộp theo buổi; chọn loại => tải Kho của loại đó; chọn bộ => hiện mục; tick mục => gửi attachLibraryItemsToSchedule đúng syllabus/buổi",
    async () => {
      renderPage();
      await screen.findAllByTestId("module-item");
      await userEvent.click(addButtons()[0]);
      expect(await screen.findByText(/Thêm module ôn luyện — Buổi 1: Chào hỏi/, {}, { timeout: 5000 })).toBeInTheDocument();
      await waitFor(() => expect(listFlashcardPackages).toHaveBeenCalled());
      expect(button("Thêm vào buổi")).toBeDisabled(); // chưa chọn mục nào

      await userEvent.selectOptions(screen.getByLabelText("Bộ nội dung trong Kho"), "pkg-flashcard-1");
      await waitFor(() => expect(listPackageItems).toHaveBeenCalledWith("pkg-flashcard-1"));
      const list = await screen.findByTestId("available-list");
      await userEvent.click(within(list).getByText("你好").closest("button") as HTMLButtonElement);
      expect(screen.getByText("Đã chọn 1 / 2 mục")).toBeInTheDocument();

      await userEvent.click(button("Thêm 1 mục vào buổi"));
      await waitFor(() => expect(attachLibraryItemsToSchedule).toHaveBeenCalledWith("syl-1", "VOCABULARY", 1, [{ id: "item-f1", label: "你好" }], false, null));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Đã thêm 1 mục vào buổi."));
      await waitFor(() => expect(screen.queryByText(/Thêm module ôn luyện — Buổi 1/)).toBeNull()); // hộp tự đóng

      // mở lại cho buổi 2 (sessionNo=2), đổi loại sang Bài tập (Quiz)
      await waitFor(() => expect(addButtons()[1]).toBeEnabled());
      await userEvent.click(addButtons()[1]);
      await screen.findByText(/Thêm module ôn luyện — Buổi 2: Gia đình/, {}, { timeout: 5000 });
      await userEvent.selectOptions(screen.getByLabelText("Loại nội dung"), "ASSESSMENT");
      await waitFor(() => expect(listQuizPackages).toHaveBeenCalled());
    },
    LONG,
  );

  it(
    "Thêm module Bài tập: lọc theo kỹ năng thu hẹp danh sách, bỏ lựa chọn cũ; 'Chọn tất cả' chỉ chọn mục đang hiện",
    async () => {
      vi.mocked(listQuizPackages).mockResolvedValue([{ id: "pkg-quiz-1", name: "Bài tập HSK 1", type: "ASSESSMENT", publishStatus: "DRAFT" }]);
      const quizItem = (id: string, title: string, skill?: string) => ({ id, studySetId: "", index: 0, title, skill, questionCount: 2 });
      vi.mocked(listPackageQuizItems).mockResolvedValue([quizItem("qz-1", "Nghe 1", "LISTENING"), quizItem("qz-2", "Đọc 1", "READING"), quizItem("qz-3", "Bài cũ")]);
      renderPage();
      await screen.findAllByTestId("module-item");
      await userEvent.click(addButtons()[1]);
      await screen.findByText(/Thêm module ôn luyện — Buổi 2: Gia đình/, {}, { timeout: 5000 });
      await userEvent.selectOptions(screen.getByLabelText("Loại nội dung"), "ASSESSMENT");
      await userEvent.selectOptions(await screen.findByLabelText("Bộ nội dung trong Kho"), "pkg-quiz-1");
      const list = await screen.findByTestId("available-list");
      expect(within(list).getAllByRole("button")).toHaveLength(3);
      expect(within(list).getByText("Chưa chọn kỹ năng")).toBeInTheDocument();
      await userEvent.click(within(list).getByText("Đọc 1").closest("button") as HTMLButtonElement);
      expect(screen.getByText("Đã chọn 1 / 3 mục")).toBeInTheDocument();

      await userEvent.selectOptions(screen.getByLabelText("Lọc theo kỹ năng"), "LISTENING");
      expect(screen.getByText("Đã chọn 0 / 1 mục")).toBeInTheDocument();
      expect(within(screen.getByTestId("available-list")).queryByText("Đọc 1")).toBeNull();
      await userEvent.click(button("Chọn tất cả"));
      await userEvent.click(button("Thêm 1 mục vào buổi"));
      await waitFor(() => expect(attachLibraryItemsToSchedule).toHaveBeenCalledWith("syl-1", "ASSESSMENT", 2, [{ id: "qz-1", label: "Nghe 1" }], false, null));
    },
    LONG,
  );

  it(
    "Thêm module Bài tập: kỹ năng không có bài nào => thông báo, không có mục để chọn",
    async () => {
      vi.mocked(listQuizPackages).mockResolvedValue([{ id: "pkg-quiz-1", name: "Bài tập HSK 1", type: "ASSESSMENT", publishStatus: "DRAFT" }]);
      vi.mocked(listPackageQuizItems).mockResolvedValue([{ id: "qz-1", studySetId: "", index: 0, title: "Nghe 1", skill: "LISTENING" }]);
      renderPage();
      await screen.findAllByTestId("module-item");
      await userEvent.click(addButtons()[1]);
      await screen.findByText(/Thêm module ôn luyện — Buổi 2: Gia đình/, {}, { timeout: 5000 });
      await userEvent.selectOptions(screen.getByLabelText("Loại nội dung"), "ASSESSMENT");
      await userEvent.selectOptions(await screen.findByLabelText("Bộ nội dung trong Kho"), "pkg-quiz-1");
      await screen.findByTestId("available-list");
      await userEvent.selectOptions(screen.getByLabelText("Lọc theo kỹ năng"), "SPEAKING");
      expect(screen.getByText("Bộ này không có bài tập nào thuộc kỹ năng đã chọn.")).toBeInTheDocument();
      expect(screen.queryByTestId("available-list")).toBeNull();
      expect(button("Chọn tất cả")).toBeDisabled();
    },
    LONG,
  );

  it(
    "Kho chưa có bộ nội dung => thông báo, không có mục để chọn; Kho chưa cấu hình (lỗi) => notice WAITING",
    async () => {
      vi.mocked(listFlashcardPackages).mockRejectedValue(new ApiNotConfiguredError());
      renderPage();
      await screen.findAllByTestId("module-item");
      await userEvent.click(addButtons()[0]);
      expect(await screen.findByTestId("packages-notice", {}, { timeout: 5000 })).toHaveAttribute("data-kind", "waiting");
      expect(button("Thêm vào buổi")).toBeDisabled();
      expect(attachLibraryItemsToSchedule).not.toHaveBeenCalled();
    },
    LONG,
  );

  it("module chưa cấu hình => notice WAITING, buổi vẫn hiện từ giáo trình, nút Thêm bị khoá", async () => {
    vi.mocked(listScheduleResources).mockRejectedValue(new ApiNotConfiguredError());
    renderPage();
    expect(await screen.findByTestId("modules-notice")).toHaveAttribute("data-kind", "waiting");
    expect(scheduleRows()).toHaveLength(2);
    expect(addButtons()).toHaveLength(2);
    for (const b of addButtons()) expect(b).toBeDisabled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("một buổi×loại lỗi => cả khối lỗi + 'Thử lại' (coi là rỗng không được, phải báo lỗi); thử lại tải được", async () => {
    vi.mocked(listScheduleResources)
      .mockImplementationOnce(scheduleResourcesImpl) // VOCABULARY sch1
      .mockRejectedValueOnce(new ApiError("Lỗi module", 500)); // ASSESSMENT sch1
    renderPage();
    const notice = await screen.findByTestId("modules-notice");
    expect(notice).toHaveAttribute("data-kind", "error");
    expect(notice).toHaveTextContent("Lỗi module");
    expect(screen.queryAllByTestId("module-item")).toHaveLength(0);
    vi.mocked(listScheduleResources).mockReset().mockImplementation(scheduleResourcesImpl);
    await userEvent.click(button("Thử lại", notice));
    expect(await screen.findAllByTestId("module-item")).toHaveLength(2);
  });
});

describe("module ôn luyện chỉ Admin thao tác (mọi endpoint /content-packages* chỉ ROLE_ADMIN ở backend)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_WRITE_CONTENT", "enabled");
    nav.set(`${PATH}?view=syl-1&tab=schedule`);
  });

  it("Giảng viên => Alert 'Chế độ Xem duy nhất', module vẫn xem được, không nút Thêm/↑/↓/Xóa", async () => {
    renderPage(teacher, "instructor");
    expect(await screen.findByText("Chế độ Xem duy nhất")).toBeInTheDocument();
    expect(screen.getByText(/Module ôn luyện theo buổi chỉ Admin thao tác được/)).toBeInTheDocument();
    expect(await screen.findAllByTestId("module-item")).toHaveLength(2);
    expect(addButtons()).toHaveLength(0);
    expect(screen.queryByLabelText("Đưa xuống")).toBeNull();
    expect(screen.queryByLabelText("Xóa module")).toBeNull();
  }, LONG);

  it("Admin => đủ nút ghi", async () => {
    renderPage(adminUser, "admin");
    await waitFor(() => expect(addButtons()).toHaveLength(2));
    expect(screen.queryByText("Chế độ Xem duy nhất")).toBeNull();
  }, LONG);
});
