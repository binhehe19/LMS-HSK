import {beforeEach,it,expect,vi} from "vitest";
import {render,screen,cleanup,fireEvent} from "@testing-library/react";
import SessionResultView from "@/components/student/timetable/session-result-view";
import {loadSessionResult,resultTotals,type SessionResultData} from "@/components/student/timetable/session-result-source";
const api=vi.hoisted(()=>({lesson:vi.fn(),result:vi.fn()}));
vi.mock("@/components/student/timetable/lesson-source",()=>({loadLesson:api.lesson,safeResourceUrl:(s:string)=>s?.startsWith("https://")?s:null}));
vi.mock("@/components/student/timetable/timetable-source",()=>({mapLimited:async(items:unknown[],fn:(v:unknown)=>Promise<unknown>)=>Promise.all(items.map(async v=>{try{return {status:"fulfilled",value:await fn(v)};}catch(reason){return {status:"rejected",reason};}}))}));
vi.mock("@/lib/api/student-client",()=>({studentApi:{result:api.result}}));
const data:SessionResultData={title:"Buổi 1 · Bài học",warnings:[],sections:[{id:"a",skill:"READING",title:"Đọc",data:{gradingStatus:"GRADED",earnedPoints:0,totalPoints:20,questions:[{questionId:"q",earnedPoints:0,maxPoints:20,answerJson:JSON.stringify({selectedOptionIndex:9}),graderComment:"Cần ôn lại",question:{questionText:"你好 nghĩa là gì?",explanation:"你好 là lời chào",options:[{optionIndex:3,content:"Xin chào",correct:true},{optionIndex:9,content:"Tạm biệt",correct:false}]}}]}}]};
beforeEach(()=>{cleanup();vi.restoreAllMocks();vi.resetAllMocks();});
it("shows actual score, selected answer, correct answer and teacher feedback",()=>{const back=vi.fn();render(<SessionResultView data={data} onBack={back}/>);expect(screen.getByText("0/20")).toBeTruthy();expect(screen.getByText("✕ Tạm biệt").closest(".session-result-option")?.className).toContain("is-wrong");expect(screen.getByText("✓ Xin chào").closest(".session-result-option")?.className).toContain("is-correct");expect(screen.getByText(/Cần ôn lại/)).toBeTruthy();const summary=screen.getByText("ⓘ Giải thích đáp án");fireEvent.click(summary);expect(summary.closest("details")?.open).toBe(true);expect(screen.getByText("你好 là lời chào")).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:/^‹\s+Quay lại$/}));expect(back).toHaveBeenCalledOnce();});
it("keeps pending questions neutral and does not invent a score or expose correct options",()=>{const pending={...data,sections:[{...data.sections[0],data:{gradingStatus:"MANUAL_GRADING",questions:[{questionId:"q",answerJson:'{"text":"Bài đã nộp"}',question:{questionText:"Viết câu"}}]}}]};render(<SessionResultView data={pending} onBack={()=>{}}/>);expect(screen.getByText("Đang chờ chấm bài")).toBeTruthy();expect(screen.getByText("Chờ chấm")).toBeTruthy();expect(screen.getByText("—")).toBeTruthy();expect(resultTotals(pending.sections).scored).toBe(0);});
it("fetches only submitted attempts resolved from the actual session",async()=>{api.lesson.mockResolvedValue({session:{sessionNo:2,title:"Đúng buổi"},warnings:[],modules:[{attemptId:"submitted",progress:100,resourceId:"resource",title:"Nghe",skill:"LISTENING"},{attemptId:"draft",progress:0}]});api.result.mockResolvedValue({learningResourceId:"resource",questions:[]});const context={classId:"class",sessionId:"session",syllabusId:"syllabus",scheduleId:"row",sessionNo:2};const result=await loadSessionResult("untrusted-url-id",context,true);expect(api.lesson).toHaveBeenCalledWith(context,true);expect(api.result).toHaveBeenCalledExactlyOnceWith("submitted");expect(result.sections[0].skill).toBe("LISTENING");});
it("rejects results for another learning resource",async()=>{api.lesson.mockResolvedValue({session:{sessionNo:1,title:"Buổi"},warnings:[],modules:[{attemptId:"a",progress:100,resourceId:"expected",title:"Đọc"}]});api.result.mockResolvedValue({learningResourceId:"other",questions:[]});const result=await loadSessionResult("a",{classId:"c",sessionId:"s",syllabusId:"y",scheduleId:"r",sessionNo:1},false);expect(result.sections).toEqual([]);expect(result.warnings[0]).toContain("không thuộc");});
it("shows a retryable error when no results could load and an empty state when there are no submissions", () => {
  const matchMedia = window.matchMedia.bind(window);
  vi.spyOn(window, "matchMedia").mockImplementation(query => ({
    ...matchMedia(query),
    matches: query === "(min-width: 992px)",
  }));
  const retry = vi.fn();
  const empty = { ...data, sections: [] };
  const { rerender } = render(<SessionResultView data={{ ...empty, warnings: ["Không kết nối được."] }} onBack={vi.fn()} onRetry={retry} />);
  expect(screen.getByRole("alert")).toHaveAttribute("data-kind", "error");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Thử lại"));
  expect(retry).toHaveBeenCalledOnce();

  rerender(<SessionResultView data={empty} onBack={vi.fn()} onRetry={retry} />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByText("Kết quả sẽ hiển thị sau khi bạn nộp bài.").parentElement).toHaveAttribute("data-state", "empty");
});
