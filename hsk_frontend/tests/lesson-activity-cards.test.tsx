import {cleanup,render,screen,within} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
vi.mock("next/link",()=>({default:({children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}>{children}</a>}));
import LessonActivityCards from "@/components/student/timetable/lesson-activity-cards";
import type {TimetableSession} from "@/components/student/timetable/timetable-data";
afterEach(cleanup);
const session={id:"s",title:"Lesson",sessionNo:1,courseName:"HSK",classId:"c",syllabusId:"syllabus"} as TimetableSession;
it("groups the materials and lists the four skills in learning order with their own links", () => {
 const returnUrl = "/student/student-timetable?classId=c";
 render(<LessonActivityCards session={session} returnUrl={returnUrl} />);
 const tabs = (group: string) => within(screen.getByRole("region", { name: group })).getAllByRole("link").map(link => {
  expect(link.textContent).toBe(link.getAttribute("aria-label"));
  expect(link.querySelector(".fa-chevron-right")).toHaveAttribute("aria-hidden", "true");
  const params = new URL(link.getAttribute("href")!, "http://localhost").searchParams;
  expect(params.get("returnUrl")).toBe(returnUrl);
  return params.get("tab");
 });
 expect(tabs("Học liệu")).toEqual(["grammar", "vocabulary", "flashcards", "handwriting"]);
 expect(tabs("Bài tập")).toEqual(["listening", "reading", "writing", "speaking"]);
});
