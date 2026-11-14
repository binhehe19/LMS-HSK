import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import StudentCourses from "@/components/student/student-courses";
import { ApiError } from "@/lib/api/api-client";
import { getStudentCourse, listStudentCourses } from "@/lib/api/lms-course-client";
import type { StudentCourseApi, StudentCourseCatalog, StudentCourseDetailApi } from "@/types/student-course";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/student/student-courses" }));
vi.mock("@/components/student/dashboard/student-shell", () => ({ default: ({ children }: { children: ReactNode }) => <div data-testid="shell">{children}</div> }));
vi.mock("@/components/student/student-data", () => ({ useStudentIdentity: () => ({ name: "Cao Văn Khánh", avatarUrl: "/a.png" }) }));
vi.mock("@/lib/api/lms-course-client", () => ({ listStudentCourses: vi.fn(), getStudentCourse: vi.fn() }));

const course = (over: Partial<StudentCourseApi>): StudentCourseApi => ({ id: "x", code: "X", name: "X", owned: false, progress: 0, doneSessions: 0, totalSessions: 48, ...over });
const catalog = (items: StudentCourseApi[], enrollmentSource: StudentCourseCatalog["enrollmentSource"] = "LIVE"): StudentCourseCatalog => ({ items, enrollmentSource });

const H40 = course({ id: "h40", code: "H40", name: "KHOÁ HSK4", owned: true, progress: 11.5, doneSessions: 5, totalSessions: 48, releasedAt: "2026-03-01T00:00:00Z", levelIn: "HSK3", levelOut: "HSK4" });
const CB0 = course({ id: "cb0", code: "CB0", name: "KHOÁ CB0", releasedAt: "2026-02-01T00:00:00Z" });
const GT1 = course({ id: "gt1", code: "GT1", name: "Giao tiếp 1", category: "di-lam", releasedAt: "2026-01-01T00:00:00Z" });

beforeAll(() => {
  // jsdom chưa có showModal/close của <dialog>.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
});

beforeEach(() => {
  vi.mocked(listStudentCourses).mockReset().mockResolvedValue(catalog([H40, CB0, GT1]));
  vi.mocked(getStudentCourse).mockReset();
});

const cards = () => screen.getAllByRole("button").filter((b) => b.classList.contains("hb-course__card"));

describe("màn Khoá học học viên nối /hsk-courses", () => {
  it("gom theo danh mục, thẻ sở hữu có tiến độ thật, thẻ chưa sở hữu có nút mở khoá", async () => {
    render(<StudentCourses />);
    expect(await screen.findByText("HSK 9 CẤP")).toBeInTheDocument();
    expect(screen.getByText("TIẾNG TRUNG CHO NGƯỜI ĐI LÀM")).toBeInTheDocument();
    expect(cards()).toHaveLength(3);
    const owned = cards()[0];
    expect(within(owned).getByText("H40")).toBeInTheDocument();
    expect(within(owned).getByText("11.5%")).toBeInTheDocument();
    expect(within(owned).getByText("48 Buổi học")).toBeInTheDocument();
    expect(within(cards()[1]).getAllByText("Mở khoá ngay!").length).toBeGreaterThan(0);
    // Hero suy từ khoá sở hữu, không còn "HSK2/HSK5" cố định.
    expect(screen.getByText("Xin chào Cao Văn Khánh!")).toBeInTheDocument();
    const levels = [...document.querySelectorAll(".hb-course__hero-milestone-value")].map((e) => e.textContent);
    expect(levels).toEqual(["HSK3", "HSK3", "HSK4"]);
  });

  it("'Khoá học của tôi' chỉ còn khoá sở hữu; bộ lọc danh mục thu hẹp", async () => {
    const user = userEvent.setup();
    render(<StudentCourses />);
    await screen.findByText("HSK 9 CẤP");
    await user.click(screen.getByRole("tab", { name: "Khoá học của tôi" }));
    expect(cards()).toHaveLength(1);
    expect(screen.getByText("Đang hiển thị khoá học đã sở hữu")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Tất cả khoá học" }));
    await user.click(screen.getByRole("checkbox", { name: "Tiếng Trung cho người đi làm" }));
    expect(cards()).toHaveLength(1);
    expect(screen.queryByText("HSK 9 CẤP")).not.toBeInTheDocument();
  });

  it("báo khi ERP không trả được đăng ký; danh mục rỗng có thông báo riêng", async () => {
    vi.mocked(listStudentCourses).mockResolvedValue(catalog([CB0], "UNAVAILABLE"));
    const { unmount } = render(<StudentCourses />);
    expect(await screen.findByTestId("enrollment-unavailable")).toBeInTheDocument();
    unmount();
    vi.mocked(listStudentCourses).mockResolvedValue(catalog([]));
    render(<StudentCourses />);
    expect(await screen.findByTestId("student-courses-empty")).toHaveTextContent("Chưa có khoá học nào.");
  });

  it("lỗi tải danh mục có 'Thử lại' và tải lại được", async () => {
    vi.mocked(listStudentCourses).mockRejectedValueOnce(new ApiError("Máy chủ lỗi", 503));
    const user = userEvent.setup();
    render(<StudentCourses />);
    const notice = await screen.findByTestId("student-courses-notice");
    expect(notice).toHaveTextContent("Máy chủ lỗi");
    await user.click(within(notice).getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("HSK 9 CẤP")).toBeInTheDocument();
    expect(listStudentCourses).toHaveBeenCalledTimes(2);
  });

  it("modal khoá sở hữu: lộ trình thật và tài liệu có link an toàn", async () => {
    const detail: StudentCourseDetailApi = {
      course: H40,
      syllabusStatus: "OK",
      sessions: [{ id: "s1", sessionNo: 1, topic: "第一课 你好", content: "Chào hỏi" }],
      materials: [{ id: "m1", title: "Giáo trình Hán ngữ", url: "https://drive.example/a.pdf" }],
      previewTopics: [],
      enrollmentSource: "LIVE",
    };
    vi.mocked(getStudentCourse).mockResolvedValue(detail);
    const user = userEvent.setup();
    render(<StudentCourses />);
    await screen.findByText("HSK 9 CẤP");
    await user.click(cards()[0]);
    expect(getStudentCourse).toHaveBeenCalledWith("h40");
    expect(await screen.findByText("第一课 你好")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vào thời khoá biểu" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Tài liệu khoá học/ }));
    expect(screen.getByRole("link", { name: /Giáo trình Hán ngữ/ })).toHaveAttribute("href", "https://drive.example/a.pdf");
    await user.click(screen.getByRole("button", { name: "Đóng" }));
    expect(screen.queryByText("第一课 你好")).not.toBeInTheDocument();
  });

  it("modal khoá chưa sở hữu chỉ có tên các buổi đầu; lỗi ERP giáo trình có thông báo", async () => {
    vi.mocked(getStudentCourse).mockResolvedValueOnce({ course: CB0, syllabusStatus: "OK", sessions: [], materials: [], previewTopics: ["Bài mở đầu", "Bài 2"], enrollmentSource: "LIVE" });
    const user = userEvent.setup();
    render(<StudentCourses />);
    await screen.findByText("HSK 9 CẤP");
    await user.click(cards()[1]);
    expect(await screen.findByText("Bài mở đầu")).toBeInTheDocument();
    expect(screen.getByText("Bài 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lộ trình học tập/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Đóng" }));

    vi.mocked(getStudentCourse).mockResolvedValueOnce({ course: H40, syllabusStatus: "UNAVAILABLE", sessions: [], materials: [], previewTopics: [], enrollmentSource: "LIVE" });
    await user.click(cards()[0]);
    expect(await screen.findByText(/Không tải được lộ trình từ hệ thống đào tạo/)).toBeInTheDocument();
  });

  it("lỗi tải chi tiết có 'Thử lại'", async () => {
    vi.mocked(getStudentCourse).mockRejectedValueOnce(new ApiError("Hết thời gian chờ", 504)).mockResolvedValueOnce({
      course: H40, syllabusStatus: "OK", sessions: [{ sessionNo: 1, topic: "Bài 1", content: "" }], materials: [], previewTopics: [], enrollmentSource: "LIVE",
    });
    const user = userEvent.setup();
    render(<StudentCourses />);
    await screen.findByText("HSK 9 CẤP");
    await user.click(cards()[0]);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Hết thời gian chờ");
    await user.click(within(alert).getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(screen.getByText("Bài 1")).toBeInTheDocument());
  });
});
