import { describe,it,expect } from "vitest";
import { LESSON_ACTIVITIES, lessonActivity, lessonHref, safeTimetableReturn } from "@/components/student/timetable/lesson-navigation";
describe("lesson navigation without attached content",()=>{
 it("uses only the class, session and selected tab in new lesson links",()=>{
  for(const activity of LESSON_ACTIVITIES){
   const href=lessonHref({scheduleId:"schedule-9",classId:"class-5",sessionId:"session-9"},activity.key);
   const url=new URL(href,"http://localhost");
   expect(url.pathname).toBe("/learning-path/online-course/homework/schedule-9");
   expect(Object.fromEntries(url.searchParams)).toEqual({classId:"class-5",sessionId:"session-9",tab:activity.key});
  }
 });
 it("returns to the lesson's class when no legacy return URL is supplied",()=>{
  const url=new URL(safeTimetableReturn(null,"class/5"),"http://localhost");
  expect(url.pathname).toBe("/student/student-timetable");
  expect(url.searchParams.get("classId")).toBe("class/5");
 });
 it("recognizes sidebar tabs and explicit skill types",()=>{expect(lessonActivity("LISTENING").key).toBe("listening");expect(lessonActivity("speaking").chinese).toBe("口语");expect(lessonActivity(null).key).toBe("slides");});
 it("preserves the timetable filter when returning",()=>{expect(safeTimetableReturn("/student/student-timetable?courseId=h50&month=2026-11")).toBe("/student/student-timetable?courseId=h50&month=2026-11");});
 it("rejects external, protocol-relative, unrelated and backslash return URLs",()=>{for(const value of ["https://example.com","//example.com","/admin/dashboard","/\\example.com","/student/student-timetable\n"]){expect(safeTimetableReturn(value)).toBe("/student/student-timetable");}});
});
