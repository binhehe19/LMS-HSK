import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import LessonSidebarMenu from "@/components/student/timetable/lesson-sidebar-menu";
import type { TimetableModule } from "@/components/student/timetable/timetable-data";

it("keeps vocabulary tools visible and shows progress for the selected skill", () => {
 const onSelect = vi.fn();
 const modules: TimetableModule[] = [
  { id: "audio", title: "Bài nghe", kind: "practice", skill: "LISTENING", description: "", icon: "nghe", progress: 100 },
 ];
 render(<LessonSidebarMenu modules={modules} tab="listening" onSelect={onSelect} />);

 const materials = within(screen.getByRole("region", { name: "Tài liệu học tập" }));
 expect(materials.getAllByRole("button")).toHaveLength(2);
 fireEvent.click(materials.getByRole("button", { name: "Xem lại buổi học" }));
 expect(onSelect).toHaveBeenCalledWith("slides");

 const vocabularyRegion = screen.getByRole("region", { name: "Ngữ pháp & Từ vựng" });
 const vocabulary = within(vocabularyRegion);
 for (const name of ["Ngữ pháp", "Từ vựng", "Flashcard", "Luyện viết", "Game"]) {
  expect(vocabulary.getByRole("button", { name }).parentElement).toBe(vocabularyRegion);
 }
 fireEvent.click(vocabulary.getByRole("button", { name: "Flashcard" }));
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
