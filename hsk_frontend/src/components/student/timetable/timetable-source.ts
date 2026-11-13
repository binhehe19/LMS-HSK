import { assessmentSkill } from "./assessment-skill";
import dayjs from "dayjs";
import { fileUrl } from "@/lib/api/storage-client";
import { listSyllabuses, getSyllabus } from "@/lib/api/lms-syllabus-client";
import { studentApi, type StudentClass, type StudentSession } from "@/lib/api/student-client";
import { listScheduleResources } from "@/lib/api/syllabus-schedule-resources-client";
import type { SyllabusDetailResponse, SyllabusScheduleItem } from "@/types/lms";
import type { TimetableModule, TimetableSession, TimetableAttempt } from "./timetable-data";

export interface TimetableData { sessions: TimetableSession[]; warnings: string[]; syllabusCount: number; }
const text=(value: unknown): string => typeof value === "string" ? value : "";
const object=(value: unknown): Record<string,unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
export function plainText(value: unknown): string { return text(value).replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim(); }
const errorText=(error: unknown) => error instanceof Error ? error.message : "Không tải được dữ liệu.";
export async function mapLimited<T,R>(items: T[], action: (item:T,index:number)=>Promise<R>): Promise<PromiseSettledResult<R>[]> {
 const results: PromiseSettledResult<R>[] = new Array(items.length); let next=0;
 await Promise.all(Array.from({length:Math.min(5,items.length)}, async()=>{while(next<items.length){const index=next++;try{results[index]={status:"fulfilled",value:await action(items[index],index)};}catch(reason){results[index]={status:"rejected",reason};}}}));
 return results;
}
export function classifyModule(type: unknown, title: string): {title:string;icon:string} {
 const key=text(type).trim().toUpperCase().replace(/[\s-]+/g,"_");
 const labels:Record<string,[string,string]>={LISTENING:["Phần Nghe","nghe"],READING:["Phần Đọc","doc"],WRITING:["Phần Viết","viet"],SPEAKING:["Phần Nói","noi"],PRONUNCIATION:["Phần Nói","noi"],TRANSLATION:["Phần Dịch","dich"],GRAMMAR:["Phần Ngữ pháp","nguphap"],GRAMMAR_3_0:["Phần Ngữ pháp","nguphap"]};
 const info=labels[key];return info?{title:title.startsWith(info[0])?title:`${info[0]}: ${title || info[0]}`,icon:info[1]}:{title,icon:"detap"};
}
export function scheduleModules(item: SyllabusScheduleItem, isAdmin: boolean): TimetableModule[] {
 const modules: TimetableModule[]=[];
 for(const [group,materials] of [["student",item.studentMaterials],["teacher",isAdmin?item.teacherMaterials:[]]] as const){
  for(const [index,material] of (materials ?? []).entries())modules.push({id:`${item.id}-${group}-${index}`,title:plainText(material.materialTitle)||`Tài liệu ${index+1}`,icon:"tailieu",kind:"material",progress:null,description:group === "teacher"?"Tài liệu giáo viên — chỉ hiển thị cho admin.":"Tài liệu học viên từ giáo trình.",url:material.materialLink});
 }
 for(const [index,module] of (item.moduleOnLuyen ?? []).entries())modules.push({id:`${item.id}-module-${index}`,...classifyModule(module.moduleType,plainText(module.moduleContent)||plainText(module.moduleType)||`Module ôn luyện ${index+1}`),kind:"practice",progress:null,description:plainText(module.moduleContent),content:module.moduleContent,resourceType:module.moduleType,assessmentType:text(module.moduleType).toUpperCase()});
 return modules;
}
export function syllabusSessions(syllabus: SyllabusDetailResponse,isAdmin: boolean): TimetableSession[] {
 return (syllabus.schedule ?? []).map((item,index)=>({id:`syllabus:${syllabus.id}:${item.id || index}`,syllabusId:syllabus.id,scheduleItemId:item.id,classId:syllabus.id,classCode:syllabus.code || "",courseName:syllabus.name || syllabus.code || syllabus.id,teacher:"",sessionNo:index+1,title:plainText(item.topic)||`Buổi ${index+1}`,topic:plainText(item.topic),content:plainText(item.content),studentTasks:plainText(item.studentTasks),teacherTasks:isAdmin?plainText(item.teacherTasks):undefined,date:"",startTime:"",endTime:"",status:"upcoming",access:"full",modules:scheduleModules(item,isAdmin)}));
}
export function classSession(course: StudentClass,session: StudentSession,syllabus?: SyllabusDetailResponse): TimetableSession {
 const item=syllabus?.schedule?.find(entry=>entry.id === session.scheduleItemId) ?? (session.sessionNo != null ? syllabus?.schedule?.[session.sessionNo-1] : undefined);
 const start=session.startAt && dayjs(session.startAt).isValid()?dayjs(session.startAt):null;
 const end=session.endAt && dayjs(session.endAt).isValid()?dayjs(session.endAt):null;
 return {id:session.id,syllabusId:course.syllabusId,scheduleItemId:item?.id,classId:course.id,classCode:course.code || "",courseName:syllabus?.name || course.syllabusName || course.code || course.id,teacher:session.teacherName || course.teacher?.fullName || "",sessionNo:session.sessionNo ?? 0,title:plainText(item?.topic || session.topic)||`Buổi ${session.sessionNo ?? ""}`,topic:plainText(item?.topic || session.topic),content:plainText(item?.content || session.content),studentTasks:plainText(item?.studentTasks),date:start?.format("YYYY-MM-DD") || "",startTime:start?.format("HH:mm") || "",endTime:end?.format("HH:mm") || "",status:session.status === "CANCELLED"?"cancelled":session.status === "DONE" || session.status === "COMPLETED"?"done":"upcoming",access:"full",meetingUrl:session.meetingLink || course.meetingLink,attendance:session.myAttendanceStatus === "PRESENT"?"present":session.myAttendanceStatus === "ABSENT"?"absent":undefined,modules:item?scheduleModules(item,false):[]};
}
export async function loadTimetable(isAdmin: boolean): Promise<TimetableData> {
 const warnings:string[]=[];
 if(isAdmin){
  const summaries=await listSyllabuses();
  const results=await mapLimited(summaries,summary=>getSyllabus(summary.id));
  const sessions:TimetableSession[]=[];
  results.forEach((result,index)=>{if(result.status === "fulfilled")sessions.push(...syllabusSessions(result.value,true));else warnings.push(`Giáo trình ${summaries[index].name || summaries[index].id}: ${errorText(result.reason)}`);});
  return {sessions,warnings,syllabusCount:summaries.length};
 }
 const classes=await studentApi.classes();
 const details=await mapLimited(classes,course=>studentApi.classDetail(course.id));
 const courses:StudentClass[]=[];
 details.forEach((result,index)=>{if(result.status === "fulfilled")courses.push(result.value);else warnings.push(`Lớp ${classes[index].code || classes[index].id}: ${errorText(result.reason)}`);});
 const ids=[...new Set(courses.map(course=>course.syllabusId).filter((id):id is string=>!!id))];
 const syllabuses=new Map<string,SyllabusDetailResponse>();const results=await mapLimited(ids,getSyllabus);
 results.forEach((result,index)=>{if(result.status === "fulfilled")syllabuses.set(ids[index],result.value);else warnings.push(`Giáo trình ${ids[index]}: ${errorText(result.reason)}`);});
 const progressResults=await mapLimited(courses,course=>studentApi.progress(course.id));
 const sessions:TimetableSession[]=[];
 courses.forEach((course,index)=>{const result=progressResults[index];const metrics=result.status === "fulfilled"?result.value:null;
  if(result.status === "rejected")warnings.push(`Tiến độ lớp ${course.code || course.id}: ${errorText(result.reason)}`);
  for(const item of course.sessions ?? []){const session=classSession(course,item,course.syllabusId?syllabuses.get(course.syllabusId):undefined);const metric=metrics?.sessions?.find(entry=>entry.sessionId === item.id);
   if(metrics){session.classPersonalProgress=metrics.personalProgress;session.classHomeworkDiligence=metrics.homeworkDiligence;session.classAverageScore=metrics.averageScore;}
   if(metric){session.homeworkProgress=metric.homeworkProgress;session.personalProgress=metric.personalProgress;}
   sessions.push(session);
  }
 });
 return {sessions,warnings,syllabusCount:syllabuses.size};
}
export function publishedModules(payload: Record<string,unknown>): TimetableModule[] {
 const labels:Record<string,[string,string]>={slide:["Slide","tailieu"],material:["Tài liệu","tailieu"],grammar:["Ngữ pháp","nguphap"],vocabulary:["Từ vựng","doc"],quiz:["Quick Test","detap"],grammarQuiz:["Bài tập ngữ pháp","nguphap"],vocabularyQuiz:["Bài tập từ vựng","doc"]};
 return Object.entries(labels).flatMap(([key,[label,icon]])=>{const resources=object(payload[key]).freeResources;if(!Array.isArray(resources))return [];return resources.map((raw,index)=>{const entry=object(raw);const content=object(entry.resourceContent);return {id:text(entry.id)||`${key}-${index}`,...classifyModule(assessmentSkill({skill:entry.skill,assessmentType:entry.assessmentType,content}),plainText(entry.resourceTitle || content.title || content.word || content.name || content.fileName)||label),icon:assessmentSkill({skill:entry.skill,assessmentType:entry.assessmentType,content}) ? classifyModule(assessmentSkill({skill:entry.skill,assessmentType:entry.assessmentType,content}),"").icon : icon,group:key,publication:"PUBLISHED" as const,resourceId:text(entry.learningResourceId),packageVersionId:text(entry.contentPackageVersionId),assessmentType:text(entry.assessmentType || content.assessmentType),skill:assessmentSkill({skill:entry.skill,assessmentType:entry.assessmentType,content}),kind:(key === "slide" || key === "material"?"material":"practice") as TimetableModule["kind"],progress:null,description:plainText(content.description || content.content),content:entry.resourceContent,resourceType:text(entry.resourceType),url:text(content.url || content.fileUrl || content.link)||fileUrl(text(content.fileId))||undefined};});});
}
export async function loadSessionModules(session: TimetableSession,isAdmin: boolean): Promise<{ modules:TimetableModule[]; warnings:string[] }> {
 if(!session.syllabusId || session.sessionNo < 1)return {modules:session.modules,warnings:["Buổi học chưa có mã giáo trình hoặc số buổi hợp lệ."]};
 const warnings:string[]=[];const modules=[...session.modules];
 try{modules.push(...publishedModules(await studentApi.resources(session.syllabusId,session.sessionNo)));}catch(error){warnings.push(errorText(error));}
 // Admin sees attached draft content as well. Student endpoints only expose published content.
 if(isAdmin){const results=await mapLimited(["VOCABULARY","ASSESSMENT","GRAMMAR"] as const,type=>listScheduleResources(session.syllabusId!,type,session.sessionNo));results.forEach((result,index)=>{if(result.status === "fulfilled"){for(const resource of result.value){const existingIndex=modules.findIndex(item=>item.id === resource.id);if(existingIndex >= 0)modules.splice(existingIndex,1);const content=object(resource.resourceContent);modules.push({id:resource.id,...classifyModule(assessmentSkill({skill:resource.skill,assessmentType:resource.assessmentType,content}),plainText(resource.resourceTitle || content.title || content.word || content.name)||resource.resourceType),icon:assessmentSkill({skill:resource.skill,assessmentType:resource.assessmentType,content})?classifyModule(assessmentSkill({skill:resource.skill,assessmentType:resource.assessmentType,content}),"").icon:["doc","detap","nguphap"][index],resourceId:resource.learningResourceId,packageVersionId:resource.contentPackageVersionId,assessmentType:resource.assessmentType,skill:assessmentSkill({skill:resource.skill,assessmentType:resource.assessmentType,content}),publication:resource.publication,kind:"practice",progress:null,description:plainText(content.description),content:resource.resourceContent,resourceType:resource.resourceType});}}else warnings.push(`Nội dung quản trị ${["Từ vựng","Bài tập","Ngữ pháp"][index]}: ${errorText(result.reason)}`);});}
 const attachedSkills=new Set(modules.filter(item=>item.resourceId && assessmentSkill(item)).map(item=>assessmentSkill(item)));
 return {modules:modules.filter(item=>item.resourceId || !assessmentSkill(item) || !attachedSkills.has(assessmentSkill(item))),warnings};
}

export interface SessionStudyData { modules:TimetableModule[]; warnings:string[]; progress:number|null; attempts:TimetableAttempt[]; }
export async function loadSessionStudy(session:TimetableSession,isAdmin:boolean):Promise<SessionStudyData> {
 const resources=await loadSessionModules(session,isAdmin);const warnings=[...resources.warnings];const attempts:TimetableAttempt[]=[];
 if(isAdmin)return {...resources,progress:null,attempts};
 let progress=session.homeworkProgress ?? null;
 try{const response=await studentApi.sessionProgress(session.classId,session.id);progress=response.homeworkProgress;}catch(error){warnings.push(`Tiến độ buổi học: ${errorText(error)}`);}
 const assessments=resources.modules.filter(module=>module.resourceType === "ASSESSMENT" && module.resourceId);
 const unique=[...new Map(assessments.map(module=>[module.resourceId!,module])).values()];
 const results=await mapLimited(unique,module=>studentApi.attempts(module.resourceId!,session.id));
 const moduleProgress=new Map<string,number|null>();const attemptIds=new Map<string,string>();
 results.forEach((result,index)=>{const item=unique[index];if(result.status === "rejected"){warnings.push(`Bài làm ${item.title}: ${errorText(result.reason)}`);return;}
  if(!Array.isArray(result.value.attempts)){warnings.push(`Lịch sử bài làm ${item.title} không đúng định dạng.`);return;}
  const latest=result.value.attempts[0];if(latest)attemptIds.set(item.resourceId!,latest.attemptId);moduleProgress.set(item.resourceId!,latest?.status === "SUBMITTED"?100:latest?null:0);
  for(const attempt of result.value.attempts)attempts.push({...attempt,moduleId:item.id,title:item.title});
 });
 return {modules:resources.modules.map(module=>module.resourceId && moduleProgress.has(module.resourceId)?{...module,progress:moduleProgress.get(module.resourceId)!,attemptId:attemptIds.get(module.resourceId)}:module),warnings,progress,attempts};
}
