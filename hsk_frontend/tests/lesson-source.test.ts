import { describe,it,expect,vi,beforeEach } from "vitest";
import { loadLesson, activityResources, additionalResources, grammarResources, lessonAvailability, safeResourceUrl, slideResources } from "@/components/student/timetable/lesson-source";
import type { TimetableModule } from "@/components/student/timetable/timetable-data";
const api=vi.hoisted(()=>({get:vi.fn(),list:vi.fn(),classDetail:vi.fn(),study:vi.fn(),classSession:vi.fn(),syllabusSessions:vi.fn()}));
vi.mock("@/lib/api/lms-syllabus-client",()=>({getSyllabus:api.get,listSyllabuses:api.list}));
vi.mock("@/lib/api/student-client",()=>({studentApi:{classDetail:api.classDetail}}));
vi.mock("@/components/student/timetable/timetable-source",()=>({classSession:api.classSession,syllabusSessions:api.syllabusSessions,loadSessionStudy:api.study,mapLimited:async(items:unknown[],fn:(value:unknown)=>Promise<unknown>)=>Promise.all(items.map(async item=>({status:"fulfilled",value:await fn(item)})))}));
const context={scheduleId:"row1",syllabusId:"s1",sessionNo:1,classId:"c1",sessionId:"session1"};
const item=(id:string,type:string,subType?:string):TimetableModule=>({id,title:id,resourceType:type,subType,kind:type === "SLIDE"?"material":"practice",icon:"doc",description:"",progress:null});
beforeEach(()=>vi.resetAllMocks());
describe("live lesson source",()=>{
 it("collects grammar materials for the dedicated tab without including grammar exercises",()=>{
  const resources=[item("word","VOCABULARY"),item("grammar","GRAMMAR"),item("older-grammar","GRAMMAR_3_0"),item("quiz","ASSESSMENT","GRAMMAR")];
  expect(grammarResources(resources).map(resource=>resource.id)).toEqual(["grammar","older-grammar"]);
 });
 it("shows vocabulary and grammar as additional content instead of inventing skills",()=>{const resources=[item("word","VOCABULARY"),item("grammar","GRAMMAR"),item("listen","ASSESSMENT","LISTENING")];expect(activityResources(resources,"listening").map(r=>r.id)).toEqual(["listen"]);expect(activityResources(resources,"reading")).toEqual([]);expect(additionalResources(resources).map(r=>r.id)).toEqual(["word","grammar"]);});
 it("loads correct admin syllabus row and rejects mismatched schedule IDs",async()=>{api.get.mockResolvedValue({id:"s1"});api.syllabusSessions.mockReturnValue([{id:"syllabus:s1:row1",scheduleItemId:"row1"}]);api.study.mockResolvedValue({modules:[item("word","VOCABULARY")],warnings:[]});const result=await loadLesson({...context,sessionId:"syllabus:s1:row1"},true);expect(result.modules).toHaveLength(1);expect(api.classDetail).not.toHaveBeenCalled();await expect(loadLesson({...context,sessionId:"syllabus:s1:row1",scheduleId:"wrong"},true)).rejects.toThrow("không thuộc");});
 it("uses the student's authorized class syllabus rather than a supplied syllabus ID",async()=>{api.classDetail.mockResolvedValue({id:"c1",syllabusId:"actual",sessions:[{id:"session1"}]});api.get.mockResolvedValue({id:"actual"});api.classSession.mockReturnValue({id:"session1"});api.study.mockResolvedValue({progress:null,modules:[],warnings:[]});await loadLesson({...context,syllabusId:"forged"},false);expect(api.get).not.toHaveBeenCalled();});
 it("rejects sessions outside the authorized class",async()=>{api.classDetail.mockResolvedValue({id:"c1",syllabusId:"actual",sessions:[]});await expect(loadLesson(context,false)).rejects.toThrow("không có trong lớp");expect(api.study).not.toHaveBeenCalled();});
 it("does not turn API failures into a fake empty lesson",async()=>{api.get.mockRejectedValue(Error("ERP unavailable"));await expect(loadLesson({...context,sessionId:"syllabus:s1:row1"},true)).rejects.toThrow("ERP unavailable");});
 it("slides: package slides first, ERP study notes without a link are dropped, ERP links kept after",()=>{
  // Như Buổi 2 HSK3: ERP studentMaterials ("Đề cương khóa học"… không có link) đứng trước 2 slide pptx của học phần.
  const erp=(id:string,url?:string):TimetableModule=>({id,title:id,kind:"material",icon:"tailieu",description:"",progress:null,url});
  const pkg=(id:string,url?:string):TimetableModule=>({...item(id,"SLIDE"),resourceId:"lr-"+id,url});
  const modules=[erp("Đề cương khóa học"),erp("Form bài tập (LMS)"),erp("Drive","https://drive.example.com/x"),erp("Bad","javascript:alert(1)"),pkg("3.1 H3_3.0.pptx","/api/storage/file/a"),pkg("3.2 H3_3.0.pptx")];
  expect(slideResources(modules).map(r=>r.id)).toEqual(["3.1 H3_3.0.pptx","3.2 H3_3.0.pptx","Drive"]);
  expect(activityResources(modules,"slides")).toEqual(slideResources(modules));
  expect(slideResources([erp("Đề cương khóa học")])).toEqual([]);
 });
 it("availability: only real content counts — skills need an exercise with resourceId",()=>{
  const exercise=(id:string,skill:string):TimetableModule=>({...item(id,"ASSESSMENT"),skill,resourceId:"lr-"+id});
  const erpPractice:TimetableModule={...item("erp","PRACTICE"),subType:"SPEAKING"};
  expect(lessonAvailability([])).toEqual({slides:false,grammar:false,vocabulary:false,skills:[]});
  expect(lessonAvailability([exercise("w","WRITING"),exercise("l","LISTENING"),erpPractice,{...item("note","SLIDE"),kind:"material"}])).toEqual({slides:false,grammar:false,vocabulary:false,skills:["listening","writing"]});
  expect(lessonAvailability([item("word","VOCABULARY"),item("grammar","GRAMMAR"),{...item("s","SLIDE"),resourceId:"lr-s"}])).toEqual({slides:true,grammar:true,vocabulary:true,skills:[]});
 });
 it("blocks executable resource URLs",()=>{expect(safeResourceUrl("javascript:alert(1)")).toBeNull();expect(safeResourceUrl("data:text/html,test")).toBeNull();expect(safeResourceUrl("/api/storage/file/id")).toBe("/api/storage/file/id");});
});

it("admin opens a real session through the same personal class API",async()=>{api.classDetail.mockResolvedValue({id:"c1",syllabusId:"actual",sessions:[{id:"session1"}]});api.get.mockResolvedValue({id:"actual"});api.classSession.mockReturnValue({id:"session1"});api.study.mockResolvedValue({progress:null,modules:[],warnings:[]});await loadLesson({...context,syllabusId:"forged"},true);expect(api.classDetail).toHaveBeenCalledWith("c1");expect(api.get).not.toHaveBeenCalled();expect(api.study).toHaveBeenCalledWith({id:"session1"},false);});
