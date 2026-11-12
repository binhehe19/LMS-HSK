import { studentApi } from "@/lib/api/student-client";
import { mapLimited } from "./timetable-source";
import type { TimetableModule, TimetableSession } from "./timetable-data";
export const record=(value:unknown):Record<string,unknown>=>value && typeof value === "object" && !Array.isArray(value)?value as Record<string,unknown>:{};
/** Attempt endpoint wraps each public question in content; the library endpoint uses flat questions. */
export function attemptResource(resource:TimetableModule,payload:Record<string,unknown>):TimetableModule{
 if(payload.learningResourceId && payload.learningResourceId !== resource.resourceId)throw Error("Bài làm không thuộc học liệu đang mở.");
 if(!Array.isArray(payload.questions))throw Error("API bài làm trả dữ liệu câu hỏi không đúng định dạng.");
 const questions=Array.isArray(payload.questions)?payload.questions.map((value,index)=>{const row=record(value);return {...record(row.content || row.question),questionId:row.questionId,displayOrder:row.displayOrder ?? index,answerJson:row.answerJson,gradingStatus:row.gradingStatus,graderComment:row.graderComment};}):[];
 const previous=record(resource.content);return {...resource,content:{...previous,questions,layout:payload.layout || previous.layout},attemptId:typeof payload.attemptId === "string"?payload.attemptId:resource.attemptId};
}
export async function readLessonAssessments(resources:TimetableModule[]):Promise<{resources:TimetableModule[];warnings:string[]}>{
 const warnings:string[]=[];const result=await mapLimited(resources,async resource=>{
  if(!resource.attemptId)return resource;
  try{return attemptResource(resource,await (resource.progress === 100?studentApi.result(resource.attemptId):studentApi.attempt(resource.attemptId)));}catch(error){warnings.push(`${resource.title}: ${error instanceof Error?error.message:"Không tải được bài làm"}`);return resource;}
 });return {resources:result.flatMap(item=>item.status === "fulfilled"?[item.value]:[]),warnings};
}
export async function startLessonAssessment(resource:TimetableModule,session:TimetableSession):Promise<TimetableModule>{
 if(!resource.resourceId || !resource.packageVersionId || !session.id || !session.classId)throw Error("Thiếu thông tin bài tập hoặc lớp học. Hãy mở lại buổi học từ thời khóa biểu.");
 return attemptResource(resource,await studentApi.startAttempt({sessionId:session.id,classId:session.classId,sessionNo:session.sessionNo,contentPackageVersionId:resource.packageVersionId,learningResourceId:resource.resourceId}));
}
