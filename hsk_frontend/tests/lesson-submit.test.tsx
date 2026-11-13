import {beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
const api=vi.hoisted(()=>({startAdminPractice:vi.fn(),lockAttempt:vi.fn(),submitAttempt:vi.fn(),releaseAttemptLock:vi.fn()}));
vi.mock("@/lib/api/student-client",()=>({studentApi:api}));
import LessonSubmitAction,{serializeLessonAnswer} from "@/components/student/timetable/lesson-submit";
import type {TimetableModule} from "@/components/student/timetable/timetable-data";
const r={id:"r",attemptId:"attempt"} as TimetableModule;
const questions=[{id:"r:q",resource:r,question:{questionId:"q",questionType:"MULTIPLE_CHOICE",options:[{optionIndex:3}]}}];
beforeEach(()=>{cleanup();vi.resetAllMocks();api.lockAttempt.mockResolvedValue({acquired:true});api.submitAttempt.mockResolvedValue({attemptId:"attempt",answersIgnored:false});api.releaseAttemptLock.mockResolvedValue({});});
it("posts only on confirmation and sends the real option index, then releases the lock",async()=>{
 render(<LessonSubmitAction resources={[r]} questions={questions} answers={{}} selected={{"r:q":"0"}} onClose={()=>{}}/>);
 expect(api.submitAttempt).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Nộp bài"}));
 await waitFor(()=>expect(screen.getByRole("status")).toHaveTextContent("Đã nộp bài thành công"));
 expect(api.submitAttempt).toHaveBeenCalledWith("attempt",expect.any(String),[{questionId:"q",answerJson:'{"selectedOptionIndex":3}'}]);
 expect(api.releaseAttemptLock).toHaveBeenCalled();
});
it("does not submit when the attempt is locked elsewhere",async()=>{
 api.lockAttempt.mockResolvedValue({acquired:false});render(<LessonSubmitAction resources={[r]} questions={questions} answers={{}} selected={{"r:q":"0"}} onClose={()=>{}}/>);
 fireEvent.click(screen.getByRole("button",{name:"Nộp bài"}));await screen.findByRole("alert");expect(api.submitAttempt).not.toHaveBeenCalled();
});
it("preserves blank indices and rejects unsupported response types before submitting",()=>{
 expect(serializeLessonAnswer({id:"q",resource:r,question:{questionId:"q",questionType:"FILL_IN_BLANK",blanks:[{blankIndex:4}]}},{"q:0":"word"},{}).answerJson).toBe('{"blankAnswers":{"4":"word"}}');
 expect(serializeLessonAnswer({id:"q",resource:r,question:{questionId:"q",questionType:"FILE_UPLOAD"}},{q:'{"files":[{"fileId":"uploaded-file"}]}'},{}).answerJson).toBe('{"files":[{"fileId":"uploaded-file"}]}');
});

it("admin creates and submits a real own attempt after confirmation",async()=>{
 const resource={...r,attemptId:undefined,resourceId:"quiz",packageVersionId:"draft-version"};const onSubmitted=vi.fn();
 api.startAdminPractice.mockResolvedValue({attemptId:"admin-attempt",learningResourceId:"quiz",questions:[]});
 render(<LessonSubmitAction resources={[resource]} questions={[{...questions[0],resource}]} answers={{}} selected={{"r:q":"0"}} sessionNo={1} isAdmin onSubmitted={onSubmitted} onClose={()=>{}}/>);
 expect(api.startAdminPractice).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Nộp bài"}));
 await waitFor(()=>expect(api.submitAttempt).toHaveBeenCalledWith("admin-attempt",expect.any(String),expect.any(Array)));
 expect(api.startAdminPractice).toHaveBeenCalledWith({learningResourceId:"quiz",contentPackageVersionId:"draft-version",sessionNo:1});
 await waitFor(()=>expect(onSubmitted).toHaveBeenCalledWith([expect.objectContaining({attemptId:"admin-attempt"})]));
});

it("serializes all skill question payloads without substituting scores or correct answers",()=>{
 const make=(type:string)=>({id:"q",resource:r,question:{questionId:"q",questionType:type}});
 expect(serializeLessonAnswer(make("AUDIO_RESPONSE"),{q:'{"audio":{"fileId":"recording"}}'},{}).answerJson).toBe('{"audio":{"fileId":"recording"}}');
 expect(serializeLessonAnswer(make("SENTENCE_BUILDER"),{q:'{"chunkOrder":[2,0,1]}'},{}).answerJson).toBe('{"chunkOrder":[2,0,1]}');
 expect(serializeLessonAnswer({...make("MULTIPLE_SELECT"),question:{...make("MULTIPLE_SELECT").question,options:[{optionIndex:5},{optionIndex:7}]}},{},{q:"[0,1]"}).answerJson).toBe('{"selectedOptionIndexes":[5,7]}');
});
