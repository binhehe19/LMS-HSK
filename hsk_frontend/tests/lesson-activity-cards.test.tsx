import {cleanup,render,screen,within} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
vi.mock("next/link",()=>({default:({children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}>{children}</a>}));
import LessonActivityCards from "@/components/student/timetable/lesson-activity-cards";
import type {TimetableModule,TimetableSession} from "@/components/student/timetable/timetable-data";
afterEach(cleanup);
const session={id:"s",title:"Lesson",sessionNo:1,courseName:"HSK",classId:"c",syllabusId:"syllabus"} as TimetableSession;
const resource=(id:string,skill:string,progress:number|null):TimetableModule=>({id,skill,progress,title:id,kind:"practice",description:"",icon:"doc",resourceType:"ASSESSMENT"});
it("renders completed and retry only for submitted skills",()=>{
 render(<LessonActivityCards session={session} returnUrl="/student/student-timetable" modules={[resource("read","READING",100),resource("listen","LISTENING",0)]}/>);
 const reading=screen.getByRole("link",{name:"Phần Đọc: 阅读"});expect(within(reading).getByText("✓ Hoàn thành")).toHaveClass("is-complete");expect(within(reading).getByText("Luyện lại")).toBeInTheDocument();
 const listening=screen.getByRole("link",{name:"Phần Nghe: 听力"});expect(within(listening).queryByText("✓ Hoàn thành")).not.toBeInTheDocument();expect(within(listening).getByText("Bắt đầu!")).toBeInTheDocument();
});
it("requires every attached assessment in a skill to be submitted",()=>{
 render(<LessonActivityCards session={session} returnUrl="/student/student-timetable" modules={[resource("r1","READING",100),resource("r2","READING",0)]}/>);
 expect(within(screen.getByRole("link",{name:"Phần Đọc: 阅读"})).queryByText("✓ Hoàn thành")).not.toBeInTheDocument();
});

it("shows loading rather than claiming unavailable data on first open",()=>{render(<LessonActivityCards loading session={session} returnUrl="/student/student-timetable" modules={[]}/>);const reading=screen.getByRole("link",{name:"Phần Đọc: 阅读"});expect(within(reading).getByText("• Đang tải…")).toBeInTheDocument();expect(within(reading).queryByText("• Chưa có dữ liệu")).toBeNull();});
