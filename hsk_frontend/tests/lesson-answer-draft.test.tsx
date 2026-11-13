import {beforeEach,expect,it,vi} from "vitest";
import {act,fireEvent,render,screen,waitFor,cleanup} from "@testing-library/react";
const api=vi.hoisted(()=>({startAdminPractice:vi.fn(),lockAttempt:vi.fn(),submitAttempt:vi.fn(),releaseAttemptLock:vi.fn(),result:vi.fn()}));
vi.mock("@/lib/api/student-client",()=>({studentApi:api}));
vi.mock("@/components/student/student-data",()=>({useStudentRequest:()=>({data:null,loading:false}),useStudentIdentity:()=>({user:{id:"learner1"}})}));
vi.mock("@/components/student/timetable/lesson-vocabulary",()=>({default:()=>null}));
vi.mock("@/components/student/timetable/lesson-handwriting",()=>({default:()=>null}));
import {ExercisePanel} from "@/components/student/timetable/lesson-panels";
import {hasQuestionAnswer} from "@/components/student/timetable/lesson-answer-draft";
import type {TimetableModule,TimetableSession} from "@/components/student/timetable/timetable-data";
const resources:TimetableModule[]=[{id:"link",resourceId:"r1",packageVersionId:"v1",title:"Test",kind:"practice",progress:null,description:"",icon:"doc",content:{questions:[{questionId:"q1",questionType:"MULTIPLE_CHOICE",questionText:"Choose one",options:[{content:"Answer A"},{content:"Answer B"}]},{questionId:"q2",questionType:"ESSAY",questionText:"Write something"}]}}];
const session={id:"session1",sessionNo:1} as TimetableSession;
beforeEach(()=>{cleanup();localStorage.clear();vi.resetAllMocks();
 api.startAdminPractice.mockResolvedValue({attemptId:"admin-attempt",learningResourceId:"r1",questions:[]});api.lockAttempt.mockResolvedValue({acquired:true});api.submitAttempt.mockResolvedValue({attemptId:"admin-attempt",answersIgnored:false});api.releaseAttemptLock.mockResolvedValue({});
 api.result.mockResolvedValue({attemptId:"admin-attempt",learningResourceId:"r1",questions:[{questionId:"q1",question:{questionType:"MULTIPLE_CHOICE",options:[{content:"Answer A"},{content:"Answer B"}]},answerJson:'{"selectedOptionIndex":0}',earnedPoints:1,maxPoints:1},{questionId:"q2",question:{questionType:"ESSAY",questionText:"Write something"},answerJson:'{"text":"An answer"}',earnedPoints:null}]});
});
it("retains selected answers on next/back, checks answered questions and restores the browser draft",async()=>{
 const view=render(<ExercisePanel resources={resources} skill="reading" session={session} isAdmin/>);
 const answer=await screen.findByRole("button",{name:/Answer A/});await waitFor(()=>expect(answer).toBeEnabled());fireEvent.click(answer);
 expect(answer).toHaveAttribute("aria-pressed","true");expect(answer).toHaveClass("is-selected");
 expect(screen.getByRole("button",{name:"Câu 1"})).not.toHaveClass("is-answered");
 fireEvent.click(screen.getByRole("button",{name:/Câu sau/}));
 expect(screen.getByRole("button",{name:"Câu 1, đã trả lời"})).toHaveTextContent("✓");
 expect(screen.getByRole("button",{name:"Câu 2"})).not.toHaveClass("is-answered");
 fireEvent.click(screen.getByRole("button",{name:/Câu trước/}));expect(screen.getByRole("button",{name:/Answer A/})).toHaveAttribute("aria-pressed","true");
 view.unmount();render(<ExercisePanel resources={resources} skill="reading" session={session} isAdmin/>);
 await waitFor(()=>expect(screen.getByRole("button",{name:/Answer A/})).toHaveAttribute("aria-pressed","true"));
});
it("does not reuse a draft for a different session",async()=>{
 localStorage.setItem('hsk-lesson-answer-v1:'+JSON.stringify(["learner1","session1","reading",[["r1","v1",null]]]),JSON.stringify({answers:{},selected:{"r1:q1":"0"}}));
 render(<ExercisePanel resources={resources} skill="reading" session={{...session,id:"session2"}} isAdmin/>);
 await waitFor(()=>expect(screen.getByRole("button",{name:/Answer A/})).toBeEnabled());
 expect(screen.getByRole("button",{name:/Answer A/})).toHaveAttribute("aria-pressed","false");
});
it("checks all required blanks and clears completion when a response is erased",()=>{
 const q={questionType:"FILL_IN_BLANK",blanks:[{},{}]};expect(hasQuestionAnswer("q",q,{"q:0":"answer"},{})).toBe(false);
 expect(hasQuestionAnswer("q",q,{"q:0":"answer","q:1":"other"},{})).toBe(true);
 expect(hasQuestionAnswer("q",q,{"q:0":"answer","q:1":" "},{})).toBe(false);
});

it("shows submit on the last question and keeps the active question unticked until leaving",async()=>{
 render(<ExercisePanel resources={resources} skill="reading" session={session} isAdmin/>);
 await waitFor(()=>expect(screen.getByRole("button",{name:/Answer A/})).toBeEnabled());
 fireEvent.click(screen.getByRole("button",{name:/Answer A/}));fireEvent.click(screen.getByRole("button",{name:/Câu sau/}));
 fireEvent.change(screen.getByRole("textbox",{name:"Câu trả lời"}),{target:{value:"An answer"}});
 expect(screen.getByRole("button",{name:"Câu 2"})).not.toHaveClass("is-answered");
 fireEvent.click(screen.getByRole("button",{name:"Nộp bài"}));
 expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
 await waitFor(()=>expect(api.submitAttempt).toHaveBeenCalledTimes(1));
 await screen.findByText("Đã làm");
});

it("disables submission until every question is answered, and disables it again when cleared",async()=>{
 render(<ExercisePanel resources={resources} skill="reading" session={session} isAdmin/>);
 await waitFor(()=>expect(screen.getByRole("button",{name:/Answer A/})).toBeEnabled());
 expect(screen.queryByRole("button",{name:"Nộp bài"})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:/Câu sau/}));expect(screen.getByRole("button",{name:"Nộp bài"})).toBeDisabled();
 fireEvent.change(screen.getByRole("textbox",{name:"Câu trả lời"}),{target:{value:"Answer"}});
 expect(screen.getByRole("button",{name:"Nộp bài"})).toBeDisabled();
 fireEvent.click(screen.getByRole("button",{name:/Câu trước/}));fireEvent.click(screen.getByRole("button",{name:/Answer B/}));fireEvent.click(screen.getByRole("button",{name:/Câu sau/}));
 expect(screen.getByRole("button",{name:"Nộp bài"})).toBeEnabled();
 fireEvent.change(screen.getByRole("textbox",{name:"Câu trả lời"}),{target:{value:" "}});expect(screen.getByRole("button",{name:"Nộp bài"})).toBeDisabled();
});

it("removes the browser-draft note and shows the submitted answer and waiting state from the result",async()=>{
 const rows=[{...resources[0],attemptId:"submitted",progress:100,content:{questions:[{questionId:"q",questionType:"ESSAY",questionText:"Read the dialogue",answerJson:'{"text":"My saved answer"}',gradingStatus:"PENDING",earnedPoints:null}]}}];
 await act(async()=>{render(<ExercisePanel resources={rows} skill="reading" session={session} isAdmin/>);});
 expect(screen.queryByText(/Đáp án được lưu nháp trên trình duyệt/)).not.toBeInTheDocument();
 expect(screen.getByText("Đã làm")).toBeInTheDocument();
 expect(screen.getByRole("textbox",{name:"Câu trả lời"})).toHaveValue("My saved answer");
 expect(screen.getByRole("textbox",{name:"Câu trả lời"})).toBeDisabled();
 expect(screen.getByText("Chờ giáo viên chấm")).toBeInTheDocument();
 expect(screen.queryByRole("button",{name:"Nộp bài"})).not.toBeInTheDocument();
 expect(screen.getByText(/Hệ thống đã nhận bài làm/)).toBeInTheDocument();
});

it("allows previous and next navigation through a submitted result without editing answers",async()=>{
 const rows=[{...resources[0],attemptId:"submitted",progress:100,content:{questions:[{questionId:"q1",questionType:"ESSAY",questionText:"First question",answerJson:'{"text":"First saved answer"}',earnedPoints:1,maxPoints:1},{questionId:"q2",questionType:"ESSAY",questionText:"Second question",answerJson:'{"text":"Second saved answer"}',earnedPoints:1,maxPoints:1}]}}];
 await act(async()=>{render(<ExercisePanel resources={rows} skill="reading" session={session} isAdmin/>);});
 expect(screen.getByRole("button",{name:"‹ Trước"})).toBeDisabled();expect(screen.getByRole("button",{name:"Sau ›"})).toBeEnabled();
 fireEvent.click(screen.getByRole("button",{name:"Sau ›"}));
 expect(screen.getByRole("textbox",{name:"Câu trả lời"})).toHaveValue("Second saved answer");expect(screen.getByRole("textbox",{name:"Câu trả lời"})).toBeDisabled();
 expect(screen.getByRole("button",{name:"Sau ›"})).toBeDisabled();expect(screen.getByRole("button",{name:"‹ Trước"})).toBeEnabled();
 fireEvent.click(screen.getByRole("button",{name:"‹ Trước"}));expect(screen.getByRole("textbox",{name:"Câu trả lời"})).toHaveValue("First saved answer");
});

it.each(["reading","listening","writing","speaking"] as const)("keeps API-confirmed ticks after refresh in %s",async(skill)=>{
 const rows=[{...resources[0],progress:100,attemptId:"submitted",content:{questions:[{questionId:"q1",questionType:"ESSAY",questionText:"First",answerJson:'{"text":"Answer"}',earnedPoints:null},{questionId:"q2",questionType:"ESSAY",questionText:"Second",answerJson:'{"text":"Other"}',earnedPoints:null}]}}];
 await act(async()=>{render(<ExercisePanel resources={rows} skill={skill} session={session} isAdmin/>);});
 expect(screen.getByRole("button",{name:"Câu 1, đã trả lời"})).toHaveClass("is-answered");expect(screen.getByRole("button",{name:"Câu 2, đã trả lời"})).toHaveClass("is-answered");
 fireEvent.click(screen.getByRole("button",{name:"Sau ›"}));expect(screen.getByRole("button",{name:"Câu 1, đã trả lời"})).toHaveClass("is-answered");expect(screen.getByRole("button",{name:"Câu 2, đã trả lời"})).toHaveClass("is-answered");
});
