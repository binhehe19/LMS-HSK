import { assessmentSkill } from "./assessment-skill";
import { getSyllabus, listSyllabuses } from "@/lib/api/lms-syllabus-client";
import { studentApi } from "@/lib/api/student-client";
import { classSession, syllabusSessions, loadSessionStudy, mapLimited } from "./timetable-source";
import type { TimetableModule, TimetableSession } from "./timetable-data";
import type { LessonActivity } from "./lesson-navigation";
export interface LessonContext { scheduleId:string; syllabusId:string; sessionNo:number; classId:string; sessionId:string; }
export interface LessonData { session:TimetableSession; modules:TimetableModule[]; warnings:string[]; }
export async function loadLesson(context:LessonContext,isAdmin:boolean):Promise<LessonData> {
 if(!isAdmin || (context.classId && context.sessionId && !context.sessionId.startsWith("syllabus:"))){
  if(!context.classId || !context.sessionId)throw Error("Thiếu thông tin lớp hoặc buổi học. Hãy mở lại từ thời khóa biểu.");
  const course=await studentApi.classDetail(context.classId);
  const actual=course.sessions?.find(item=>item.id === context.sessionId);
  if(!actual)throw Error("Buổi học không có trong lớp được cấp quyền.");
  if(!course.syllabusId)throw Error("Lớp học chưa được gắn giáo trình.");
  const session=classSession(course,actual);const detail=await loadSessionStudy(session,false);
  return {session:{...session,homeworkProgress:detail.progress},modules:detail.modules,warnings:detail.warnings};
 }
 let syllabus=context.syllabusId?await getSyllabus(context.syllabusId):null;
 // Older timetable URLs did not carry syllabusId; resolve the actual schedule row instead of guessing.
 if(!syllabus){const list=await listSyllabuses();const results=await mapLimited(list,item=>getSyllabus(item.id));syllabus=results.flatMap(result=>result.status === "fulfilled"?[result.value]:[]).find(item=>item.schedule?.some(row=>row.id === context.scheduleId)) ?? null;}
 if(!syllabus)throw Error("Không tìm thấy giáo trình của buổi học. Hãy mở lại từ thời khóa biểu.");
 const sessions=syllabusSessions(syllabus,true);const session=sessions.find(item=>item.scheduleItemId === context.scheduleId || item.id === context.scheduleId);
 if(!session)throw Error("Buổi học không thuộc giáo trình được chọn. Hãy mở lại từ thời khóa biểu.");
 const detail=await loadSessionStudy(session,true);
 return {session,modules:detail.modules,warnings:detail.warnings};
}
export function activityResources(modules:TimetableModule[],activity:LessonActivity):TimetableModule[] {
 if(activity === "slides")return modules.filter(item=>item.kind === "material");
 const type={listening:"LISTENING",reading:"READING",writing:"WRITING",speaking:"SPEAKING"}[activity];
 return modules.filter(item=>assessmentSkill(item) === type || (activity === "speaking" && assessmentSkill(item) === "PRONUNCIATION"));
}
export function grammarResources(modules:TimetableModule[]):TimetableModule[] {
 return modules.filter(item=>item.group==="grammar" || item.resourceType==="GRAMMAR" || item.resourceType==="GRAMMAR_3_0");
}
export function additionalResources(modules:TimetableModule[]):TimetableModule[] {
 const mapped=new Set(["LISTENING","READING","WRITING","SPEAKING","PRONUNCIATION"]);
 return modules.filter(item=>item.kind !== "material" && !mapped.has(assessmentSkill(item) || ""));
}
export function safeResourceUrl(value:string|undefined):string|null {
 if(!value)return null;
 try{const url=new URL(value,"http://localhost");if(!["https:","http:"].includes(url.protocol))return null;return value.startsWith("/") && !value.startsWith("//")?value:url.href;}catch{return null;}
}

export function unclassifiedAssessments(modules:TimetableModule[]):TimetableModule[] {
 return modules.filter(item=>item.resourceType === "ASSESSMENT" && (!assessmentSkill(item) || assessmentSkill(item) === "QUIZ"));
}
