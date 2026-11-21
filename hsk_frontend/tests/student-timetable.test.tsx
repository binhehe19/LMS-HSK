import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import StudentTimetable from "@/components/student/timetable/student-timetable";
import StudentHeader from "@/components/student/dashboard/student-header";
import { timetableReadCache } from "@/components/student/timetable/timetable-read-cache";
import { useTimetableCacheEvents } from "@/components/student/timetable/use-timetable-read";

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams("classId=a&month=2026-11"),
  pathname: "/student/student-timetable",
  roles: ["ROLE_STUDENT"],
  push: vi.fn(),
  classes: vi.fn(),
  classDetail: vi.fn(),
  progress: vi.fn(),
  sessionProgress: vi.fn(),
  resources: vi.fn(),
  adminCatalog: vi.fn(),
  adminClass: vi.fn(),
  adminSessions: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => mocks.params,
}));
vi.mock("@/components/student/student-notifications", () => ({ default: () => null }));
vi.mock("@/redux/hooks", () => ({ useAppDispatch: () => vi.fn() }));
vi.mock("@/components/student/student-data", () => ({
  useStudentIdentity: () => ({ avatarUrl: "/assets/avatar.png", user: { id: "timetable-test-user", roles: mocks.roles } }),
  useStudentData: () => ({ history: { loading: false } }),
}));
vi.mock("@/lib/api/student-client", () => ({
  studentApi: { classes: mocks.classes, classDetail: mocks.classDetail, progress: mocks.progress, sessionProgress: mocks.sessionProgress, resources: mocks.resources },
}));
vi.mock("@/lib/api/lms-class-client", () => ({
  listClasses: mocks.adminCatalog, getClass: mocks.adminClass, listClassSessions: mocks.adminSessions,
}));

beforeEach(() => {
  vi.clearAllMocks();
  timetableReadCache.clear();
  mocks.roles = ["ROLE_STUDENT"];
  mocks.pathname = "/student/student-timetable";
  mocks.params = new URLSearchParams("month=2026-11");
  window.history.replaceState(null, "", "/student/student-timetable?month=2026-11");
  mocks.classes.mockResolvedValue([{ id: "a", code: "Lớp A" }, { id: "b", code: "Lớp B" }]);
  mocks.classDetail.mockImplementation(async (id: string) => ({
    id, code: id, sessions: [{ id: id + "-session", classId: id, sessionNo: 1, topic: "Chủ đề " + id, startAt: "2026-11-15T08:00:00" }],
  }));
  mocks.progress.mockResolvedValue({ sessions: [] });
  mocks.sessionProgress.mockResolvedValue({ homeworkProgress: null });
  mocks.resources.mockResolvedValue({});
});
afterEach(() => vi.restoreAllMocks());

it("opens the only class directly from the dashboard without a dropdown", async () => {
  mocks.pathname = "/student/student-dashboard";
  mocks.classes.mockResolvedValue([{ id: "a", code: "Lớp A" }]);
  render(<StudentHeader />);

  const timetable = screen.getByRole("button", { name: "Thời khóa biểu" });
  await waitFor(() => expect(timetable).toBeEnabled());
  expect(timetable).not.toHaveAttribute("aria-haspopup");
  fireEvent.click(timetable);
  expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/student/student-timetable?classId=a");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});

it("opens the class list when the timetable label is clicked on the dashboard", async () => {
  mocks.pathname = "/student/student-dashboard";
  render(<StudentHeader />);

  await waitFor(() => expect(screen.getByRole("button", { name: "Thời khóa biểu" })).toHaveAttribute("aria-haspopup", "menu"));
  fireEvent.click(screen.getByText("Thời khóa biểu"));
  const menu = await screen.findByRole("menu");
  expect(within(menu).getByRole("menuitem", { name: "Lớp A" })).toBeInTheDocument();
  expect(within(menu).getByRole("menuitem", { name: "Lớp B" })).toBeInTheDocument();
  fireEvent.click(within(menu).getByRole("menuitem", { name: "Tất cả lớp" }));
  expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/student/student-timetable?classId=ALL");
});

it("shows only the first two closed-class sessions in whole-course scope and restores month controls for a started class",async()=>{
 mocks.params=new URLSearchParams("classId=a&month=2026-11");
 mocks.classDetail.mockImplementation(async(id:string)=>({
  id,code:id,lifecycleStatus:id==="a"?"RECRUITMENT_CLOSED":"IN_PROGRESS",
  sessions:[3,2,1].map(sessionNo=>({id:`${id}-${sessionNo}`,classId:id,sessionNo,
   topic:`${id} buổi ${sessionNo}`,startAt:`2027-01-0${sessionNo}T08:00:00`})),
 }));
 const {rerender}=render(<StudentTimetable />);
 expect(await screen.findByRole("button",{name:"Chi tiết buổi 1: a buổi 1"})).toBeInTheDocument();
 expect(screen.getByRole("button",{name:"Chi tiết buổi 2: a buổi 2"})).toBeInTheDocument();
 expect(screen.queryByRole("button",{name:"Chi tiết buổi 3: a buổi 3"})).not.toBeInTheDocument();
 expect(screen.getByRole("radio",{name:"Toàn khóa"})).toBeChecked();
 expect(screen.queryByRole("radio",{name:"Theo tháng"})).not.toBeInTheDocument();
 expect(screen.queryByRole("button",{name:"Hôm nay"})).not.toBeInTheDocument();
 mocks.params=new URLSearchParams("classId=b&month=2027-01");
 rerender(<StudentTimetable />);
 expect(await screen.findByRole("button",{name:"Chi tiết buổi 3: b buổi 3"})).toBeInTheDocument();
 expect(screen.getByRole("radio",{name:"Theo tháng"})).toBeChecked();
 expect(screen.getByRole("button",{name:"Hôm nay"})).toBeInTheDocument();
});

it("keeps the mobile overview compact and lists only available class details", async () => {
  mocks.classDetail.mockResolvedValue({
    id: "a", code: "GS0353", syllabusName: "Tiếng Trung công sở",
    startDate: "2026-11-04", totalSessions: 32, completedSessions: 6,
  });
  mocks.progress.mockResolvedValue({ personalProgress: 0, sessions: [] });
  render(<StudentTimetable />);

  const overview = await screen.findByRole("region", { name: "Tổng quan lớp học" });
  const content = within(overview);
  expect(content.getAllByText("GS0353")).toHaveLength(1);
  expect(overview).toHaveTextContent("6/32 buổi · 18,8%");
  const details = content.getByText("Xem thêm thông tin lớp").closest("details");
  expect(details).not.toHaveAttribute("open");
  expect(details).toHaveTextContent("Khai giảng04/11/2026");
  expect(details).toHaveTextContent("Tiến độ cá nhân0%");
  expect(details).not.toHaveTextContent(/Giáo viên|Điểm trung bình|Chuyên cần/);
});

it("loads only one class for a bare URL even when 50 classes are available", async () => {
  mocks.classes.mockResolvedValue(Array.from({ length: 50 }, (_, index) => ({ id: String(index) })));
  render(<StudentTimetable />);
  await screen.findByRole("button", { name: "Chi tiết buổi 1: Chủ đề 0" });
  const query = new URLSearchParams(window.location.search);
  expect(query.get("classId")).toBe("0");
  expect(query.get("month")).toBe("2026-11");
  expect(mocks.classes).toHaveBeenCalledTimes(1);
  expect(mocks.classDetail).toHaveBeenCalledExactlyOnceWith("0");
  expect(mocks.progress).toHaveBeenCalledExactlyOnceWith("0");
  const nav = screen.getByRole("navigation", { name: "Điều hướng chính" });
  fireEvent.click(within(nav).getByRole("button", { name: "Thời khóa biểu" }));
  const menu = await screen.findByRole("menu");
  expect(within(menu).getAllByRole("menuitem")).toHaveLength(51);
  expect(mocks.classes).toHaveBeenCalledTimes(1);
});

it("only loads personal classes for Admin, even with a legacy catalog URL", async () => {
  mocks.roles = ["ROLE_ADMIN"];
  mocks.params = new URLSearchParams("courseId=other&classPage=2&month=2026-11");
  const { rerender } = render(<StudentTimetable />);
  await screen.findByRole("button", { name: "Chi tiết buổi 1: Chủ đề a" });
  expect(mocks.classDetail).toHaveBeenCalledExactlyOnceWith("a");
  expect(mocks.progress).toHaveBeenCalledExactlyOnceWith("a");
  expect(screen.queryByRole("button", { name: "Trang lớp sau" })).not.toBeInTheDocument();

  mocks.params = new URLSearchParams("classId=ALL&month=2026-11");
  rerender(<StudentTimetable />);
  await screen.findByRole("button", { name: "Chi tiết buổi 1: Chủ đề b" });
  expect(mocks.classes).toHaveBeenCalledTimes(1);
  expect(mocks.classDetail).not.toHaveBeenCalledWith("other");
  expect(mocks.adminCatalog).not.toHaveBeenCalled();
  expect(mocks.adminClass).not.toHaveBeenCalled();
  expect(mocks.adminSessions).not.toHaveBeenCalled();
});

it("queries the selected class, keeps the other filter options, and reuses the data across months", async () => {
  mocks.params = new URLSearchParams("courseId=a&month=2026-11");
  const { rerender } = render(<StudentTimetable />);
  await screen.findByRole("button", { name: "Chi tiết buổi 1: Chủ đề a" });
  fireEvent.click(screen.getByRole("button", { name: "Thời khóa biểu" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Lớp B" }));
  expect(new URLSearchParams(window.location.search).get("classId")).toBe("b");
  expect(new URLSearchParams(window.location.search).has("courseId")).toBe(false);
  expect(mocks.classDetail).toHaveBeenCalledExactlyOnceWith("a");
  expect(mocks.progress).toHaveBeenCalledExactlyOnceWith("a");

  fireEvent.click(screen.getByRole("button", { name: "Tháng sau" }));
  mocks.params = new URLSearchParams(window.location.search);
  expect(mocks.params.get("classId")).toBe("a");
  expect(mocks.params.get("month")).toBe("2026-12");
  rerender(<StudentTimetable />);
  expect(await screen.findByRole("heading", { name: "Chưa có lịch học" })).toBeInTheDocument();
  expect(mocks.classDetail).toHaveBeenCalledTimes(1);
  expect(mocks.progress).toHaveBeenCalledTimes(1);

  mocks.params = new URLSearchParams("classId=b&courseId=a&month=2026-11");
  rerender(<StudentTimetable />);
  await screen.findByRole("button", { name: "Chi tiết buổi 1: Chủ đề b" });
  expect(screen.queryByRole("button", { name: "Chi tiết buổi 1: Chủ đề a" })).not.toBeInTheDocument();
  expect(mocks.classes).toHaveBeenCalledTimes(1);
  expect(mocks.classDetail.mock.calls).toEqual([["a"], ["b"]]);
  expect(mocks.progress.mock.calls).toEqual([["a"], ["b"]]);
});

it("shows an empty timetable for Admin without personal classes", async () => {
  mocks.roles = ["ROLE_ADMIN"];
  mocks.classes.mockResolvedValue([]);
  render(<StudentTimetable />);
  expect(await screen.findByRole("heading", { name: "Chưa có lịch học" })).toBeInTheDocument();
  expect(new URLSearchParams(window.location.search).has("classId")).toBe(false);
  expect(mocks.classDetail).not.toHaveBeenCalled();
  expect(mocks.progress).not.toHaveBeenCalled();
  expect(mocks.adminCatalog).not.toHaveBeenCalled();
});

it("opens the session dialog with a named title, progress and separate activity groups", async () => {
  mocks.classDetail.mockResolvedValue({
    id: "a", code: "Lớp A", syllabusId: "syllabus-a", syllabusName: "HSK 3",
    sessions: [{ id: "session-a", classId: "a", sessionNo: 1, topic: "Chủ đề buổi học", startAt: "2026-11-15T08:00:00", status: "DONE" }],
  });
  render(<StudentTimetable />);
  fireEvent.click(await screen.findByRole("button", { name: "Xem lại buổi học" }));
  const reviewUrl = new URL(mocks.push.mock.lastCall?.[0], "http://localhost");
  expect(reviewUrl.searchParams.get("tab")).toBe("slides");
  expect(reviewUrl.searchParams.get("sessionId")).toBe("session-a");
  fireEvent.click(screen.getByRole("button", { name: "Bài tập & Học liệu" }));
  const dialog = await screen.findByRole("dialog", { name: /Chủ đề buổi học/ });
  const progress = within(dialog).getByRole("region", { name: "Tổng quan buổi học" });
  expect(within(progress).getByRole("button", { name: "Xem lại buổi học" })).toBeInTheDocument();
  const slides = within(progress).getByRole("link", { name: "Xem tài liệu học tập - Slides" });
  expect(Object.fromEntries(new URL(slides.getAttribute("href")!, "http://localhost").searchParams)).toEqual({ classId: "a", sessionId: "session-a", tab: "slides" });
  const materials = within(dialog).getByRole("region", { name: "Ngữ pháp & Từ vựng" });
  const grammar = within(materials).getByRole("link", { name: "Ngữ pháp" });
  expect(grammar).toHaveTextContent(/^Ngữ pháp$/);
  expect(within(materials).queryByRole("link", { name: /slides/i })).not.toBeInTheDocument();
  expect(within(dialog).getByRole("region", { name: "Luyện tập" })).toBeInTheDocument();
  await waitFor(() => expect(within(dialog).queryByText("Đang tải tài nguyên của buổi học…")).not.toBeInTheDocument());
  fireEvent.click(within(dialog).getByRole("button", { name: /close/i }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: /Chủ đề buổi học/ })).not.toBeInTheDocument());
});

it("keeps All classes as an explicit filter", async () => {
  const { rerender } = render(<StudentTimetable />);
  await screen.findByRole("button", { name: "Chi tiết buổi 1: Chủ đề a" });
  fireEvent.click(screen.getByRole("button", { name: "Thời khóa biểu" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Tất cả lớp" }));
  expect(new URLSearchParams(window.location.search).get("classId")).toBe("ALL");
  mocks.params = new URLSearchParams(window.location.search);
  rerender(<StudentTimetable />);
  await screen.findByRole("button", { name: "Chi tiết buổi 1: Chủ đề b" });
  expect(screen.getByRole("button", { name: "Chi tiết buổi 1: Chủ đề a" })).toBeInTheDocument();
});

it("avoids focus refetches and refreshes progress after a write without refetching the catalog", async () => {
  function WithProgressEvents() {
    useTimetableCacheEvents("timetable-test-user");
    return <StudentTimetable />;
  }
  const now = vi.spyOn(Date, "now");
  now.mockReturnValue(1_000_000);
  render(<WithProgressEvents />);
  await screen.findByRole("button", { name: "Chi tiết buổi 1: Chủ đề a" });
  now.mockReturnValue(2_000_000);
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(mocks.classDetail).toHaveBeenCalledTimes(1);
  expect(mocks.classes).toHaveBeenCalledTimes(1);

  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  await act(async () => window.dispatchEvent(new Event("hsk:lesson-submitted")));
  expect(mocks.progress).toHaveBeenCalledTimes(1);
  visibility.mockReturnValue("visible");
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(mocks.progress).toHaveBeenCalledTimes(2);
  expect(mocks.classes).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "Tải lại lịch" }));
  await waitFor(() => expect(mocks.progress).toHaveBeenCalledTimes(3));
});
