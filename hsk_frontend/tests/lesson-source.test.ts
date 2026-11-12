import { describe,it,expect,vi,beforeEach } from "vitest";
import { loadLesson, activityResources, additionalResources, safeResourceUrl } from "@/components/student/timetable/lesson-source";
import type { TimetableModule } from "@/components/student/timetable/timetable-data";
const api=vi.hoisted(()=>({get:vi.fn(),list:vi.fn(),classDetail:vi.fn(),study:vi.fn(),classSession:vi.fn(),syllabusSessions:vi.fn()}));
vi.mock("@/lib/api/lms-syllabus-client",()=>({getSyllabus:api.get,listSyllabuses:api.list}));
vi.mock("@/lib/api/student-client",()=>({studentApi:{classDetail:api.classDetail}}));
vi.mock("@/components/student/timetable/timetable-source",()=>({classSession:api.classSession,syllabusSessions:api.syllabusSessions,loadSessionStudy:api.study,mapLimited:async(items:unknown[],fn:(value:unknown)=>Promise<unknown>)=>Promise.all(items.map(async item=>({status:"fulfilled",value:await fn(item)})))}));
const context={scheduleId:"row1",syllabusId:"s1",sessionNo:1,classId:"c1",sessionId:"session1"};
const item=(id:string,type:string,assessmentType?:string):TimetableModule=>({id,title:id,resourceType:type,assessmentType,kind:type === "SLIDE"?"material":"practice",icon:"doc",description:"",progress:null});
beforeEach(()=>vi.resetAllMocks());
describe("live lesson source",()=>{
 it("shows vocabulary and grammar as additional content instead of inventing skills",()=>{const resources=[item("word","VOCABULARY"),item("grammar","GRAMMAR"),item("listen","ASSESSMENT","LISTENING")];expect(activityResources(resources,"listening").map(r=>r.id)).toEqual(["listen"]);expect(activityResources(resources,"reading")).toEqual([]);expect(additionalResources(resources).map(r=>r.id)).toEqual(["word","grammar"]);});
 it("loads correct admin syllabus row and rejects mismatched schedule IDs",async()=>{api.get.mockResolvedValue({id:"s1"});api.syllabusSessions.mockReturnValue([{id:"syllabus:s1:row1",scheduleItemId:"row1"}]);api.study.mockResolvedValue({modules:[item("word","VOCABULARY")],warnings:[]});const result=await loadLesson(context,true);expect(result.modules).toHaveLength(1);expect(api.classDetail).not.toHaveBeenCalled();await expect(loadLesson({...context,scheduleId:"wrong"},true)).rejects.toThrow("không thuộc");});
 it("uses the student's authorized class syllabus rather than a supplied syllabus ID",async()=>{api.classDetail.mockResolvedValue({id:"c1",syllabusId:"actual",sessions:[{id:"session1"}]});api.get.mockResolvedValue({id:"actual"});api.classSession.mockReturnValue({id:"session1"});api.study.mockResolvedValue({progress:null,modules:[],warnings:[]});await loadLesson({...context,syllabusId:"forged"},false);expect(api.get).toHaveBeenCalledWith("actual");expect(api.get).not.toHaveBeenCalledWith("forged");});
 it("rejects sessions outside the authorized class",async()=>{api.classDetail.mockResolvedValue({id:"c1",syllabusId:"actual",sessions:[]});await expect(loadLesson(context,false)).rejects.toThrow("không có trong lớp");expect(api.study).not.toHaveBeenCalled();});
 it("does not turn API failures into a fake empty lesson",async()=>{api.get.mockRejectedValue(Error("ERP unavailable"));await expect(loadLesson(context,true)).rejects.toThrow("ERP unavailable");});
 it("blocks executable resource URLs",()=>{expect(safeResourceUrl("javascript:alert(1)")).toBeNull();expect(safeResourceUrl("data:text/html,test")).toBeNull();expect(safeResourceUrl("/api/storage/file/id")).toBe("/api/storage/file/id");});
});
