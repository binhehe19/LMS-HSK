import { describe,it,expect,vi,beforeEach } from "vitest";
import { attemptResource,readLessonAssessments,startLessonAssessment } from "@/components/student/timetable/lesson-assessment-source";
import type { TimetableModule,TimetableSession } from "@/components/student/timetable/timetable-data";
const api=vi.hoisted(()=>({attempt:vi.fn(),result:vi.fn(),start:vi.fn()}));
vi.mock("@/lib/api/student-client",()=>({studentApi:{attempt:api.attempt,result:api.result,startAttempt:api.start}}));
const resource:TimetableModule={id:"link",resourceId:"resource",packageVersionId:"package-version",title:"Nghe",kind:"practice",progress:null,description:"",icon:"nghe",resourceType:"ASSESSMENT",assessmentType:"LISTENING"};
const session={id:"session",classId:"class",sessionNo:3} as TimetableSession;
beforeEach(()=>vi.resetAllMocks());
describe("lesson assessment delivery",()=>{
 it("does not create an attempt or invent questions when resource content is withheld",async()=>{const data=await readLessonAssessments([resource]);expect(data.resources[0].content).toBeUndefined();expect(api.start).not.toHaveBeenCalled();expect(api.attempt).not.toHaveBeenCalled();});
 it("reads in-progress public questions from the existing attempt",async()=>{api.attempt.mockResolvedValue({attemptId:"a",learningResourceId:"resource",questions:[{questionId:"q1",displayOrder:1,content:{questionType:"FILL_IN_BLANK",questionText:"API question",blanks:[{blankIndex:0}]}}]});const data=await readLessonAssessments([{...resource,attemptId:"a"}]);expect(api.attempt).toHaveBeenCalledWith("a");expect(data.resources[0].content).toMatchObject({questions:[{questionId:"q1",questionText:"API question"}]});expect(api.start).not.toHaveBeenCalled();});
 it("reads a submitted attempt from the attempt endpoint and keeps its raw state; the result screen loads /result itself",async()=>{api.attempt.mockResolvedValue({attemptId:"submitted",learningResourceId:"resource",status:"SUBMITTED",savedAnswers:[{questionId:"q",answerJson:'{"text":"own answer"}'}],questions:[{questionId:"q",displayOrder:1,content:{questionType:"ESSAY",questionText:"Visible question"}}]});const data=await readLessonAssessments([{...resource,attemptId:"submitted",progress:100}]);expect(api.attempt).toHaveBeenCalledWith("submitted");expect(api.result).not.toHaveBeenCalled();expect(data.resources[0].content).toMatchObject({questions:[{questionId:"q",questionText:"Visible question"}],attempt:{status:"SUBMITTED",savedAnswers:[{questionId:"q",answerJson:'{"text":"own answer"}'}]}});});
 it("surfaces API failure and preserves attached metadata instead of pretending the lesson is empty",async()=>{api.attempt.mockRejectedValue(Error("API unavailable"));const data=await readLessonAssessments([{...resource,attemptId:"a"}]);expect(data.resources[0].resourceId).toBe("resource");expect(data.warnings[0]).toContain("API unavailable");});
 it("rejects an attempt belonging to another resource",()=>{expect(()=>attemptResource(resource,{learningResourceId:"other"})).toThrow("không thuộc");});
 it("starts with the actual class/session/resource/package IDs only on explicit start",async()=>{api.start.mockResolvedValue({learningResourceId:"resource",attemptId:"a",questions:[]});await startLessonAssessment(resource,session);expect(api.start).toHaveBeenCalledWith({classId:"class",sessionId:"session",sessionNo:3,contentPackageVersionId:"package-version",learningResourceId:"resource"});});
 it("does not post when required package metadata is absent",async()=>{await expect(startLessonAssessment({...resource,packageVersionId:undefined},session)).rejects.toThrow("Thiếu");expect(api.start).not.toHaveBeenCalled();});
});

it("preserves the server-directed grading poll delay and clears it when grading finishes",()=>{
 const pending=attemptResource(resource,{attemptId:"a",questions:[],nextPollMs:1500});expect(pending.content).toMatchObject({resultNextPollMs:1500});
 const graded=attemptResource(pending,{attemptId:"a",questions:[],nextPollMs:null});expect(graded.content).toMatchObject({resultNextPollMs:null});
});
