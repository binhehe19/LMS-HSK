import { describe,it,expect,vi,beforeEach } from "vitest";
import { loadTimetable, syllabusSessions, classSession, loadSessionModules, mapLimited, loadSessionStudy, classifyModule, publishedModules } from "@/components/student/timetable/timetable-source";
import { sessionProgress, getSessionState } from "@/components/student/timetable/timetable-data";
import { activityResources } from "@/components/student/timetable/lesson-source";
import type { SyllabusDetailResponse } from "@/types/lms";
const api=vi.hoisted(()=>({vocabularyStates:vi.fn(),adminList:vi.fn(),adminClass:vi.fn(),adminSessions:vi.fn(),list:vi.fn(),detail:vi.fn(),classes:vi.fn(),classDetail:vi.fn(),resources:vi.fn(),draft:vi.fn(),progress:vi.fn(),sessionProgress:vi.fn(),attempts:vi.fn(),adminAttempts:vi.fn()}));
vi.mock("@/lib/api/lms-class-client",()=>({listAllClasses:api.adminList,getClass:api.adminClass,listClassSessions:api.adminSessions}));
vi.mock("@/lib/api/lms-syllabus-client",()=>({listSyllabuses:api.list,getSyllabus:api.detail}));
vi.mock("@/lib/api/student-client",()=>({studentApi:{vocabularyStates:api.vocabularyStates,classes:api.classes,classDetail:api.classDetail,resources:api.resources,progress:api.progress,sessionProgress:api.sessionProgress,attempts:api.attempts,adminAttempts:api.adminAttempts}}));
vi.mock("@/lib/api/syllabus-schedule-resources-client",()=>({listScheduleResources:api.draft}));
const syllabus:SyllabusDetailResponse={id:"s1",name:"HSK 3",schedule:[{id:"schedule-1",topic:"Bài trong giáo trình",content:"Nội dung thật",studentMaterials:[{materialTitle:"Slide học viên",materialLink:"https://example.com/slide"}],teacherMaterials:[{materialTitle:"Tài liệu giáo viên"}],studentTasks:"Làm bài",teacherTasks:"Chuẩn bị bài"}]};
beforeEach(()=>{vi.resetAllMocks();api.vocabularyStates.mockResolvedValue([]);api.adminAttempts.mockResolvedValue({attempts:[]});api.resources.mockResolvedValue({});api.draft.mockResolvedValue([]);api.progress.mockResolvedValue({personalProgress:null,homeworkDiligence:null,averageScore:null,sessions:[]});api.sessionProgress.mockResolvedValue({homeworkProgress:null});});
describe("live timetable source",()=>{
 it("admin loads all classes and their dated sessions, not every syllabus row",async()=>{api.adminList.mockResolvedValue({items:[{id:"a"},{id:"b"}],truncated:false});api.adminClass.mockImplementation(async(id:string)=>({id,code:id,syllabusId:"s1"}));api.adminSessions.mockImplementation(async(id:string)=>[{id:id+"-session",sessionNo:1,startAt:"2026-11-14T08:00:00",endAt:"2026-11-14T10:00:00"}]);api.detail.mockResolvedValue(syllabus);const result=await loadTimetable(true);expect(result.classes?.map(c=>c.id)).toEqual(["a","b"]);expect(result.sessions.map(s=>[s.classId,s.date])).toEqual([["a","2026-11-14"],["b","2026-11-14"]]);expect(api.list).not.toHaveBeenCalled();expect(api.classes).not.toHaveBeenCalled();expect(api.progress).not.toHaveBeenCalled();expect(result.sessions[0].teacherTasks).toBe("Chuẩn bị bài");});
 it("reports class failure without falling back to syllabus previews",async()=>{api.adminList.mockResolvedValue({items:[{id:"bad"}],truncated:false});api.adminClass.mockRejectedValue(Error("ERP unavailable"));api.adminSessions.mockResolvedValue([]);const result=await loadTimetable(true);expect(result.sessions).toEqual([]);expect(result.warnings[0]).toContain("ERP unavailable");expect(api.list).not.toHaveBeenCalled();});
 it("does not fall back to preview when the class list API fails",async()=>{api.adminList.mockRejectedValue(Error("Database offline"));await expect(loadTimetable(true)).rejects.toThrow("Database offline");});
 it("student uses only the authorized session content even when syllabus access is forbidden",async()=>{api.classes.mockResolvedValue([{id:"class1"}]);api.classDetail.mockResolvedValue({id:"class1",code:"HSK3-01",syllabusId:"s1",sessions:[{id:"session1",classId:"class1",sessionNo:1,topic:"Bài của lớp v1",studentTasks:"Bài học viên",studentMaterials:[{materialTitle:"Slide học viên",materialLink:"https://example.com/slide"}],startAt:"2026-11-06T08:00:00",endAt:"2026-11-06T10:00:00"}]});api.detail.mockResolvedValue(syllabus);const result=await loadTimetable(false);expect(api.list).not.toHaveBeenCalled();expect(result.sessions[0]).toMatchObject({title:"Bài của lớp v1",date:"2026-11-06",startTime:"08:00",classCode:"HSK3-01"});expect(result.sessions[0].teacherTasks).toBeUndefined();expect(result.sessions[0].modules).toHaveLength(1);expect(api.detail).not.toHaveBeenCalled();});
 it("joins by scheduleItemId before session index",()=>{const data={...syllabus,schedule:[...syllabus.schedule!,{id:"schedule-2",topic:"Đúng theo ID"}]};const session=classSession({id:"c"},{id:"x",classId:"c",sessionNo:1,scheduleItemId:"schedule-2"},data);expect(session.title).toBe("Đúng theo ID");});
 it("never invents dates or personal progress from syllabus metadata",()=>{const session=syllabusSessions(syllabus,true)[0];expect(getSessionState(session)).toBe("unscheduled");expect(sessionProgress(session)).toBeNull();expect(session.score).toBeUndefined();expect(session.attendance).toBeUndefined();});
 it("keeps resource errors visible and only admin requests draft resources",async()=>{api.resources.mockRejectedValue(Error("Published content failed"));const session=syllabusSessions(syllabus,false)[0];const result=await loadSessionModules(session,false);expect(api.draft).not.toHaveBeenCalled();expect(result.warnings).toEqual(["Published content failed"]);expect(result.modules[0].title).toBe("Slide học viên");});
 it("includes resources from admin draft endpoints",async()=>{api.draft.mockResolvedValue([{id:"draft-link",resourceType:"GRAMMAR",resourceContent:{title:"Ngữ pháp nháp"}}]);const result=await loadSessionModules(syllabusSessions(syllabus,true)[0],true);expect(api.draft).toHaveBeenCalledTimes(5);expect(result.modules.some(m=>m.title === "Ngữ pháp nháp")).toBe(true);});
 it("limits concurrency while preserving request order",async()=>{let running=0;let maximum=0;const results=await mapLimited(Array.from({length:13},(_,i)=>i),async value=>{running++;maximum=Math.max(maximum,running);await new Promise(resolve=>setTimeout(resolve,1));running--;return value;});expect(maximum).toBeLessThanOrEqual(5);expect(results.map(result=>result.status === "fulfilled"?result.value:null)).toEqual(Array.from({length:13},(_,i)=>i));});
});

describe("progress and assessment integration",()=>{
 it("uses explicit assessment classification for the four skill labels",()=>{for(const [type,label,icon] of [["LISTENING","Phần Nghe","nghe"],["READING","Phần Đọc","doc"],["WRITING","Phần Viết","viet"],["SPEAKING","Phần Nói","noi"]])expect(classifyModule(type,"Bài 1")).toEqual({title:label+": Bài 1",icon});});
 it("preserves safe metadata when the quiz body is withheld",()=>{const [module]=publishedModules({quiz:{freeResources:[{id:"link",learningResourceId:"res",resourceTitle:"听力",assessmentType:"LISTENING",resourceType:"ASSESSMENT",resourceContent:null}]}});expect(module.title).toBe("Phần Nghe: 听力");expect(module.resourceId).toBe("res");expect(module.content).toBeNull();});
 it("reads backend progress and maps submitted attempts without confusing grade with completion",async()=>{api.resources.mockResolvedValue({quiz:{freeResources:[{id:"link",learningResourceId:"res",assessmentType:"LISTENING",resourceType:"ASSESSMENT",resourceContent:null}]}});api.sessionProgress.mockResolvedValue({homeworkProgress:42});api.attempts.mockResolvedValue({attempts:[{attemptId:"a",status:"SUBMITTED",gradingStatus:"GRADED",earnedPoints:2,totalPoints:10}]});const session=classSession({id:"c",syllabusId:"s1"},{id:"session",classId:"c",sessionNo:1},syllabus);const result=await loadSessionStudy(session,false);expect(result.progress).toBe(42);expect(result.modules.find(m=>m.id === "link")?.progress).toBe(100);expect(result.attempts[0].earnedPoints).toBe(2);expect(api.attempts).toHaveBeenCalledWith("res","session");});
 it("admin never requests personal progress or someone else's attempts",async()=>{await loadSessionStudy(syllabusSessions(syllabus,true)[0],true);expect(api.sessionProgress).not.toHaveBeenCalled();expect(api.attempts).not.toHaveBeenCalled();});
 it("keeps progress unavailable when its API fails",async()=>{api.sessionProgress.mockRejectedValue(Error("Progress service offline"));const result=await loadSessionStudy(classSession({id:"c",syllabusId:"s1"},{id:"session",classId:"c",sessionNo:1},syllabus),false);expect(result.progress).toBeNull();expect(result.warnings.some(w=>w.includes("Progress service offline"))).toBe(true);});
});

it("admin replaces student metadata with the full content of the same attachment",async()=>{
 api.resources.mockResolvedValue({quiz:{freeResources:[{id:"same-link",learningResourceId:"res",resourceType:"ASSESSMENT",assessmentType:"QUIZ",resourceTitle:"Quiz",resourceContent:null}]}});
 api.draft.mockImplementation(async(_id:string,type:string)=>type === "ASSESSMENT"?[{id:"same-link",learningResourceId:"res",resourceType:"ASSESSMENT",assessmentType:"QUIZ",resourceContent:{title:"Quiz",layout:{meta:{skill:"READING"}},questions:[{questionId:"q1",questionType:"ESSAY",questionText:"Read and answer"}]}}]:[]);
 const result=await loadSessionModules(syllabusSessions(syllabus,true)[0],true);
 const attached=result.modules.filter(m=>m.id === "same-link");
 expect(attached).toHaveLength(1);
 expect(attached[0].skill).toBe("READING");
 expect(attached[0].content).toMatchObject({questions:[{questionId:"q1"}]});
});

it("loads restored HSK quizzes into the matching session and skill, retaining their questions",async()=>{
 const rows=[{id:"reading-link",sessionNo:1,resourceType:"ASSESSMENT",assessmentType:"QUIZ",publication:"DRAFT",resourceContent:{title:"test",layout:{meta:{skill:"READING"}},questions:[{questionId:"r1"},{questionId:"r2"}]}},{id:"listening-link",sessionNo:2,resourceType:"ASSESSMENT",assessmentType:"QUIZ",publication:"DRAFT",resourceContent:{title:"test1",layout:{meta:{skill:"LISTENING"}},questions:[{questionId:"l1"},{questionId:"l2"},{questionId:"l3"},{questionId:"l4"}]}}];
 api.draft.mockImplementation(async(_id:string,type:string,sessionNo:number)=>type === "ASSESSMENT"?rows.filter(row=>row.sessionNo===sessionNo):[]);
 const sessions=syllabusSessions({...syllabus,schedule:[{id:"row1"},{id:"row2"}]},true);
 const first=await loadSessionModules(sessions[0],true);const second=await loadSessionModules(sessions[1],true);
 expect(activityResources(first.modules,"reading")[0].content).toMatchObject({questions:[{questionId:"r1"},{questionId:"r2"}]});
 expect(activityResources(first.modules,"listening")).toEqual([]);
 expect(activityResources(second.modules,"listening")[0].content).toMatchObject({questions:[{questionId:"l1"},{questionId:"l2"},{questionId:"l3"},{questionId:"l4"}]});
 expect(activityResources(second.modules,"reading")).toEqual([]);
});

it("admin reads all activity sources for each session without stale published content",async()=>{
 api.resources.mockResolvedValue({quiz:{freeResources:[{id:"removed-from-draft",resourceType:"ASSESSMENT",assessmentType:"READING"}]}});
 api.draft.mockImplementation(async(_id:string,type:string,no:number)=>{
  const common={id:type+no,learningResourceId:type+no,resourceType:type,publication:"DRAFT"};
  if(type === "SLIDE" || type === "MATERIAL")return [{...common,resourceContent:{title:type,fileId:"file"+no}}];
  if(type === "VOCABULARY")return [{...common,resourceContent:{word:"你好"+no}}];
  if(type === "ASSESSMENT")return ["LISTENING","READING","WRITING","SPEAKING"].map(skill=>({...common,id:skill+no,assessmentType:"QUIZ",resourceContent:{layout:{meta:{skill}},questions:[{questionId:skill+no}]}}));
  return [];
 });
 for(const no of [1,2,8]){
  const session={...syllabusSessions(syllabus,true)[0],sessionNo:no};const result=await loadSessionModules(session,true);
  for(const type of ["VOCABULARY","ASSESSMENT","GRAMMAR","SLIDE","MATERIAL"])expect(api.draft).toHaveBeenCalledWith("s1",type,no);
  expect(activityResources(result.modules,"slides").filter(m=>m.resourceId).map(m=>m.resourceType)).toEqual(["SLIDE","MATERIAL"]);
  for(const skill of ["listening","reading","writing","speaking"] as const)expect(activityResources(result.modules,skill).map(m=>m.id)).toEqual([skill.toUpperCase()+no]);
  expect(result.modules.some(m=>m.id==="VOCABULARY"+no)).toBe(true);
  expect(result.modules.some(m=>m.id==="removed-from-draft")).toBe(false);
 }
 expect(api.resources).not.toHaveBeenCalled();
});

it("retains completed skill state during a later retry and opens the submitted attempt",async()=>{
 api.resources.mockResolvedValue({quiz:{freeResources:[{id:"reading",learningResourceId:"read",assessmentType:"QUIZ",skill:"READING",resourceType:"ASSESSMENT",resourceContent:null}]}});
 api.attempts.mockResolvedValue({attempts:[{attemptId:"retry",status:"IN_PROGRESS"},{attemptId:"submitted",status:"SUBMITTED",gradingStatus:"PENDING"}]});
 const result=await loadSessionStudy(classSession({id:"c",syllabusId:"s1"},{id:"session",classId:"c",sessionNo:1},syllabus),false);
 expect(result.modules.find(m=>m.id==="reading")).toMatchObject({progress:100,attemptId:"submitted"});
});
it("does not mark unsubmitted answers complete",async()=>{
 api.resources.mockResolvedValue({quiz:{freeResources:[{id:"reading",learningResourceId:"read",assessmentType:"QUIZ",skill:"READING",resourceType:"ASSESSMENT",resourceContent:null}]}});
 api.attempts.mockResolvedValue({attempts:[{attemptId:"draft",status:"IN_PROGRESS"}]});
 const result=await loadSessionStudy(classSession({id:"c",syllabusId:"s1"},{id:"session",classId:"c",sessionNo:1},syllabus),false);
 expect(result.modules.find(m=>m.id==="reading")?.progress).toBe(0);
});

it("admin completion is read from own practice history without student class requests",async()=>{
 api.draft.mockImplementation(async(_id:string,type:string)=>type === "ASSESSMENT"?[{id:"link",learningResourceId:"quiz",contentPackageVersionId:"draft",resourceType:"ASSESSMENT",assessmentType:"QUIZ",resourceContent:{layout:{meta:{skill:"READING"}}}}]:[]);
 api.adminAttempts.mockResolvedValue({attempts:[{attemptId:"admin-attempt",status:"SUBMITTED",gradingStatus:"GRADED"}]});
 const result=await loadSessionStudy(syllabusSessions(syllabus,true)[0],true);
 expect(result.modules.find(m=>m.id==="link")).toMatchObject({progress:100,attemptId:"admin-attempt"});
 expect(result.progress).toBe(100);
 expect(api.adminAttempts).toHaveBeenCalledWith("quiz","draft",1);expect(api.attempts).not.toHaveBeenCalled();expect(api.sessionProgress).not.toHaveBeenCalled();
});

it("keeps learner class summaries and progress separate across classes and account reloads",async()=>{
 api.classes.mockResolvedValueOnce([{id:"a"},{id:"b"}]).mockResolvedValueOnce([{id:"c"}]);
 api.classDetail.mockImplementation(async(id:string)=>({id,code:id,syllabusId:"s1",teacher:{fullName:"Teacher "+id},schedulePatterns:[{dayOfWeek:"MONDAY",startTime:"08:00",endTime:"10:00"}],myAttendanceSummary:{totalRecorded:1,attendanceRate:id==="a"?50:100},sessions:[{id:id+"-session",classId:id,sessionNo:1}]}));
 api.detail.mockResolvedValue(syllabus);
 api.progress.mockImplementation(async(id:string)=>({personalProgress:id==="a"?20:80,averageScore:id==="a"?30:90,homeworkDiligence:10,sessions:[{sessionId:id+"-session",homeworkProgress:id==="a"?25:100}]}));
 const first=await loadTimetable(false);
 expect(first.classes?.map(c=>[c.id,c.personalProgress,c.averageScore])).toEqual([["a",20,30],["b",80,90]]);
 expect(first.sessions.map(s=>[s.classId,s.homeworkProgress])).toEqual([["a",25],["b",100]]);
 const second=await loadTimetable(false);
 expect(second.classes?.map(c=>c.id)).toEqual(["c"]);expect(second.sessions.map(s=>s.classId)).toEqual(["c"]);
 expect(api.list).not.toHaveBeenCalled();expect(api.draft).not.toHaveBeenCalled();
});

it("loads admin practice progress independently for each session",async()=>{
 api.draft.mockImplementation(async(_id:string,type:string,no:number)=>type==="ASSESSMENT"?[{id:"link"+no,learningResourceId:"quiz"+no,contentPackageVersionId:"version",resourceType:"ASSESSMENT",assessmentType:"QUIZ",skill:"READING"}]:[]);
 api.adminAttempts.mockImplementation(async(_id:string,_version:string,no:number)=>({attempts:no===1?[{attemptId:"submitted",status:"SUBMITTED",gradingStatus:"GRADED",earnedPoints:0,totalPoints:20}]:[]}));
 const first=await loadSessionStudy({...syllabusSessions(syllabus,true)[0],sessionNo:1},true);
 const second=await loadSessionStudy({...syllabusSessions(syllabus,true)[0],sessionNo:2},true);
 expect(first.progress).toBe(100);expect(second.progress).toBe(0);expect(second.attempts).toEqual([]);
 expect(api.adminAttempts).toHaveBeenCalledWith("quiz1","version",1);expect(api.adminAttempts).toHaveBeenCalledWith("quiz2","version",2);
});
it("does not report zero progress when the actual attempt history request fails",async()=>{
 api.draft.mockImplementation(async(_id:string,type:string)=>type==="ASSESSMENT"?[{id:"link",learningResourceId:"quiz",contentPackageVersionId:"version",resourceType:"ASSESSMENT"}]:[]);
 api.adminAttempts.mockRejectedValue(Error("History offline"));
 const result=await loadSessionStudy(syllabusSessions(syllabus,true)[0],true);
 expect(result.progress).toBeNull();expect(result.modules.find(m=>m.id==="link")?.progress).toBeNull();expect(result.warnings.some(w=>w.includes("History offline"))).toBe(true);
});

it("reads real vocabulary mastery for the current user into lesson activity completion",async()=>{api.draft.mockImplementation(async(_id:string,type:string)=>type==="VOCABULARY"?[{id:"vocab-link",learningResourceId:"word",resourceType:"VOCABULARY",resourceContent:{word:"你好"}}]:[]);api.vocabularyStates.mockResolvedValue([{learningResourceId:"word",comprehensionLevel:"KNOWN"}]);const result=await loadSessionStudy(syllabusSessions(syllabus,true)[0],true);expect(api.vocabularyStates).toHaveBeenCalledWith(["word"]);expect(result.modules.find(m=>m.id==="vocab-link")?.progress).toBe(100);});
