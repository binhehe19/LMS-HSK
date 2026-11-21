import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import LessonSidebarMenu from "@/components/student/timetable/lesson-sidebar-menu";
import type { TimetableModule } from "@/components/student/timetable/timetable-data";

afterEach(cleanup);
const lessonModule = (id: string, extra: Partial<TimetableModule>): TimetableModule => ({ id, title: id, icon: "doc", kind: "practice", progress: null, description: "", ...extra });
const slide = lessonModule("slide", { kind: "material", resourceType: "SLIDE", resourceId: "lr-slide", url: "/api/storage/file/s" });
const grammar = lessonModule("grammar", { resourceType: "GRAMMAR", group: "grammar", resourceId: "lr-g" });
const vocabulary = lessonModule("word", { resourceType: "VOCABULARY", group: "vocabulary", resourceId: "lr-v" });
const exercise = (skill: string, progress: number | null) => lessonModule(skill, { resourceType: "ASSESSMENT", skill, resourceId: "lr-" + skill, progress });

it("keeps vocabulary tools visible and shows progress for the selected skill", () => {
 const onSelect = vi.fn();
 const modules = [slide, grammar, vocabulary, exercise("LISTENING", 100), exercise("READING", 0), exercise("WRITING", 0), exercise("SPEAKING", 0)];
 render(<LessonSidebarMenu modules={modules} tab="listening" onSelect={onSelect} />);

 const materials = within(screen.getByRole("region", { name: "Tài liệu học tập" }));
 expect(materials.getAllByRole("button").map(button => button.textContent)).toEqual(["Slides"]);
 fireEvent.click(materials.getByRole("button", { name: "Slides" }));
 expect(onSelect).toHaveBeenCalledWith("slides");

 const vocabularyRegion = screen.getByRole("region", { name: "Ngữ pháp & Từ vựng" });
 const vocabularyMenu = within(vocabularyRegion);
 for (const name of ["Ngữ pháp", "Từ vựng", "Flashcard", "Luyện viết", "Game"]) {
  expect(vocabularyMenu.getByRole("button", { name }).parentElement).toBe(vocabularyRegion);
 }
 fireEvent.click(vocabularyMenu.getByRole("button", { name: "Flashcard" }));
 expect(onSelect).toHaveBeenCalledWith("flashcards");

 const practiceRegion = screen.getByRole("region", { name: "Luyện tập" });
 const comments = screen.getByRole("region", { name: "Nhận xét của giáo viên" });
 expect(practiceRegion.nextElementSibling).toBe(comments);
 fireEvent.click(within(comments).getByRole("button", { name: "Xem nhận xét" }));
 expect(onSelect).toHaveBeenCalledWith("comments");
 const practice = within(practiceRegion);
 expect(practice.getByText("1/4")).toBeInTheDocument();
 const listening = practice.getByRole("button", { name: /Nghe 听力/ });
 expect(listening).toHaveAttribute("aria-current", "page");
 expect(listening).toHaveTextContent("100%");
 fireEvent.click(practice.getByRole("button", { name: /Đọc 阅读/ }));
 expect(onSelect).toHaveBeenCalledWith("reading");
});

it("only lists what the session has: an exercise-only session shows its skills, counted over those skills", () => {
 // Như Buổi 2 HSK3: slide + bài Nghe/Đọc/Viết, không có ngữ pháp/từ vựng/bài Nói. Mục ôn luyện ERP (không resourceId) không tính là có bài.
 const erpPlaceholder = lessonModule("erp-speaking", { subType: "SPEAKING" });
 render(<LessonSidebarMenu modules={[slide, exercise("LISTENING", 33), exercise("READING", 33), exercise("WRITING", 100), erpPlaceholder]} tab="writing" onSelect={vi.fn()} />);
 expect(screen.getByRole("region", { name: "Tài liệu học tập" })).toBeInTheDocument();
 expect(screen.queryByRole("region", { name: "Ngữ pháp & Từ vựng" })).not.toBeInTheDocument();
 expect(screen.queryByRole("button", { name: "Xem lại buổi học" })).not.toBeInTheDocument();
 const practice = within(screen.getByRole("region", { name: "Luyện tập" }));
 expect(practice.getAllByRole("button").map(button => button.textContent?.replace(/\d+%$/, "").trim())).toEqual(["Nghe 听力", "Đọc 阅读", "Viết 写作"]);
 expect(practice.getByText("1/3")).toBeInTheDocument();
});

it("shows grammar without vocabulary tools when only grammar is attached, and only comments for an empty session", () => {
 const { rerender } = render(<LessonSidebarMenu modules={[grammar]} tab="grammar" onSelect={vi.fn()} />);
 const menu = within(screen.getByRole("region", { name: "Ngữ pháp & Từ vựng" }));
 expect(menu.getByRole("button", { name: "Ngữ pháp" })).toHaveAttribute("aria-current", "page");
 for (const name of ["Từ vựng", "Flashcard", "Luyện viết", "Game"]) expect(menu.queryByRole("button", { name })).not.toBeInTheDocument();

 rerender(<LessonSidebarMenu modules={[]} tab="slides" onSelect={vi.fn()} />);
 expect(screen.getAllByRole("region").map(region => region.getAttribute("aria-label"))).toEqual(["Nhận xét của giáo viên"]);
});
