import {studentApi} from "@/lib/api/student-client";
import {loadLesson,type LessonContext} from "./lesson-source";
import {mapLimited} from "./timetable-source";
import {assessmentSkill} from "./assessment-skill";
export const resultRecord=(v:unknown):Record<string,unknown>=>v && typeof v === "object" && !Array.isArray(v)?v as Record<string,unknown>:{};
export interface ResultSection {id:string;title:string;skill:string;data:Record<string,unknown>;}
export interface SessionResultData {title:string;sections:ResultSection[];warnings:string[];}
export async function loadSessionResult(attemptId:string,context:LessonContext|null,isAdmin:boolean):Promise<SessionResultData>{
 if(!context){return {title:"Kết quả bài làm",sections:[{id:attemptId,title:"Bài làm",skill:"",data:await studentApi.result(attemptId)}],warnings:[]};}
 const lesson=await loadLesson(context,isAdmin);
 const exercises=[...new Map(lesson.modules.filter(m=>m.attemptId && m.progress===100).map(m=>[m.attemptId!,m])).values()];
 const warnings=[...lesson.warnings];
 const results=await mapLimited(exercises,async m=>{const data=await studentApi.result(m.attemptId!);if(data.learningResourceId && data.learningResourceId!==m.resourceId)throw Error("Kết quả không thuộc bài tập của buổi học.");return {id:m.attemptId!,title:m.title,skill:assessmentSkill(m),data};});
 const sections:ResultSection[]=[];
 results.forEach((r,i)=>{if(r.status==="fulfilled")sections.push(r.value);else warnings.push(`${exercises[i].title}: ${r.reason instanceof Error?r.reason.message:"Không tải được kết quả"}`);});
 return {title:`Buổi ${lesson.session.sessionNo} · ${lesson.session.title}`,sections,warnings};
}
export function resultTotals(sections:ResultSection[]){
 let earned=0,total=0,count=0,graded=0,scored=0;
 for(const {data} of sections){count+=Array.isArray(data.questions)?data.questions.length:0;if(data.gradingStatus==="GRADED")graded++;
 if(typeof data.earnedPoints==="number" && typeof data.totalPoints==="number" && data.totalPoints>0){earned+=data.earnedPoints;total+=data.totalPoints;scored++;}}
 return {earned,total,count,graded,scored};
}
