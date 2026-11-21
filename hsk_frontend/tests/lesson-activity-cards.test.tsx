import {cleanup,render,screen,within} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
vi.mock("next/link",()=>({default:({children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}>{children}</a>}));
import LessonActivityCards from "@/components/student/timetable/lesson-activity-cards";
import type {TimetableModule,TimetableSession} from "@/components/student/timetable/timetable-data";
afterEach(cleanup);
const session={id:"s",title:"Lesson",sessionNo:1,courseName:"HSK",classId:"c",syllabusId:"syllabus"} as TimetableSession;
const lessonModule=(id:string,extra:Partial<TimetableModule>):TimetableModule=>({id,title:id,icon:"doc",kind:"practice",progress:null,description:"",...extra});
const full:TimetableModule[]=[
 lessonModule("g",{resourceType:"GRAMMAR",group:"grammar",resourceId:"lr-g"}),
 lessonModule("v",{resourceType:"VOCABULARY",group:"vocabulary",resourceId:"lr-v"}),
 ...(["LISTENING","READING","WRITING","SPEAKING"] as const).map(skill=>lessonModule(skill,{resourceType:"ASSESSMENT",skill,resourceId:"lr-"+skill})),
];
const tabs=(group:string)=>within(screen.getByRole("region",{name:group})).getAllByRole("link").map(link=>{
 expect(link.textContent).toBe(link.getAttribute("aria-label"));
 expect(link.querySelector(".fa-chevron-right")).toHaveAttribute("aria-hidden","true");
 const params=new URL(link.getAttribute("href")!,"http://localhost").searchParams;
 expect(Object.fromEntries(params)).toEqual({classId:"c",sessionId:"s",tab:params.get("tab")});
 return params.get("tab");
});
it("groups the materials and lists the four skills in learning order with their own links", () => {
 render(<LessonActivityCards session={session} modules={full} />);
 expect(tabs("Ngữ pháp & Từ vựng")).toEqual(["grammar","vocabulary","flashcards","handwriting"]);
 expect(tabs("Luyện tập")).toEqual(["listening","reading","writing","speaking"]);
});
it("only shows the cards the session has content for (an exercise-only session has no grammar/vocabulary group)", () => {
 // Buổi chỉ có bài tập Nghe/Đọc/Viết (như Buổi 2 HSK3) và một mục ôn luyện ERP không có resourceId (không làm bài được).
 render(<LessonActivityCards session={session} modules={[...full.slice(2,5),lessonModule("erp",{subType:"SPEAKING"})]} />);
 expect(screen.queryByRole("region",{name:"Ngữ pháp & Từ vựng"})).not.toBeInTheDocument();
 expect(tabs("Luyện tập")).toEqual(["listening","reading","writing"]);
});
it("shows an explicit note instead of empty groups when the session has nothing attached, and nothing while loading", () => {
 const {rerender}=render(<LessonActivityCards session={session} modules={[]} loading />);
 expect(screen.queryByRole("status")).not.toBeInTheDocument();
 rerender(<LessonActivityCards session={session} modules={[]} />);
 expect(screen.getByRole("status")).toHaveTextContent("Buổi học chưa được gắn ngữ pháp, từ vựng hay bài tập luyện tập.");
 expect(screen.queryByRole("region")).not.toBeInTheDocument();
});
