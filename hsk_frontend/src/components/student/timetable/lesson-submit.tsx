"use client";
import {useRef,useState} from "react";
import {studentApi} from "@/lib/api/student-client";
import type {TimetableModule} from "./timetable-data";
import {hasQuestionAnswer,selectedChoices} from "./lesson-answer-draft";
import {record} from "./lesson-assessment-source";
export type DraftQuestion={id:string;question:Record<string,unknown>;resource:TimetableModule};
export function serializeLessonAnswer(item:DraftQuestion,answers:Record<string,string>,selected:Record<string,string>):{questionId:string;answerJson:string}{
 const q=item.question;let value:unknown;const choice=selected[item.id];
 if(typeof q.questionId!=="string")throw Error("Câu hỏi thiếu mã; chưa thể nộp bài.");
 if(q.questionType === "MULTIPLE_CHOICE" || q.questionType === "MULTIPLE_SELECT"){
  const options=Array.isArray(q.options)?q.options:[];const option=record(options[Number(choice)]);const index=typeof option.optionIndex === "number"?option.optionIndex:Number(choice);
  value=choice === undefined?{}:q.questionType === "MULTIPLE_SELECT"?{selectedOptionIndexes:selectedChoices(choice).map(i=>typeof record(options[i]).optionIndex === "number"?record(options[i]).optionIndex:i)}:{selectedOptionIndex:index};
 }else if(q.questionType === "FILL_IN_BLANK" || q.questionType === "MATCHING"){
  const matching=q.questionType === "MATCHING";const fields=matching?q.matchingPairs:q.blanks;
  // Câu nối gửi optionIndex (số) đã chọn của từng dòng; câu điền gửi chữ.
  value={[matching?"matchingAnswers":"blankAnswers"]:Object.fromEntries((Array.isArray(fields)?fields:[]).map((raw,i)=>{const part=record(raw);const given=answers[item.id+":"+i] || "";return [String(part[matching?"pairIndex":"blankIndex"] ?? i),matching?(given === "" ? null : Number(given)):given];}))};
 }else if(q.questionType === "ESSAY")value={text:answers[item.id] || ""};
 else if(["AUDIO_RESPONSE","FILE_UPLOAD","SENTENCE_BUILDER"].includes(String(q.questionType))){
  const saved=record(JSON.parse(answers[item.id] || "{}"));
  if(q.questionType === "AUDIO_RESPONSE")value={audio:saved.audio};
  else if(q.questionType === "FILE_UPLOAD")value={files:saved.files};
  else value={chunkOrder:saved.chunkOrder};
 }
 else throw Error("Loại câu này chưa hỗ trợ nộp từ trang này. Bản nháp vẫn được giữ.");
 return {questionId:q.questionId,answerJson:JSON.stringify(value)};
}
export default function LessonSubmitAction({resources,questions,answers,selected,onSubmitted,onBeforeSubmit,onBusyChange,isAdmin=false}:{resources:TimetableModule[];questions:DraftQuestion[];answers:Record<string,string>;selected:Record<string,string>;onClose?:()=>void;onBeforeSubmit?:()=>void;onBusyChange?:(busy:boolean)=>void;onSubmitted?:(resources:TimetableModule[])=>void;isAdmin?:boolean}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [done,setDone]=useState(false);const submitted=useRef(new Set<string>());
 const incomplete=questions.length===0 || questions.some(q=>!hasQuestionAnswer(q.id,q.question,answers,selected));
 const submit=async()=>{if(busy||done||incomplete)return;onBeforeSubmit?.();setBusy(true);onBusyChange?.(true);setError("");try{
  // Validate every answer before creating any attempts or submitting anything.
  const encoded=resources.map(resource=>({resource,answers:questions.filter(q=>q.resource.id===resource.id).map(q=>serializeLessonAnswer(q,answers,selected))}));
  const prepared:TimetableModule[]=[];const groups:{id:string;answers:{questionId:string;answerJson:string}[]}[]=[];
  for(const entry of encoded){const resource=entry.resource;
   if(resource.progress===100)throw Error("Bài đã nộp. Hãy chọn Làm lại để tạo lượt mới.");
   if(!resource.attemptId && isAdmin)throw Error("Tài khoản admin chỉ xem trước bài tập, không nộp bài được.");
   if(!resource.attemptId)throw Error("Cần bắt đầu một lượt làm bài trước khi nộp.");
   prepared.push(resource);groups.push({id:resource.attemptId,answers:entry.answers});
  }
  for(const group of groups){if(submitted.current.has(group.id))continue;const token=crypto.randomUUID();const lock=await studentApi.lockAttempt(group.id,token);if(!lock.acquired)throw Error("Bài đang được làm ở tab khác. Chưa nộp; bản nháp vẫn giữ.");try{const result=await studentApi.submitAttempt(group.id,token,group.answers);submitted.current.add(group.id);if(result.answersIgnored)throw Error("Bài đã được nộp nhưng hết thời gian nhận đáp án mới. Hãy kiểm tra kết quả.");}finally{await studentApi.releaseAttemptLock(group.id,token).catch(()=>undefined);}}
  setDone(true);window.dispatchEvent(new Event("hsk:lesson-submitted"));onSubmitted?.(prepared);
 }catch(e){setError(e instanceof Error?e.message:"Không nộp được bài; bản nháp vẫn được giữ.");}finally{setBusy(false);onBusyChange?.(false);}};
 return <div className="lesson-submit-inline">{error && <p role="alert">{error}</p>}{done?<p role="status">Đã nộp bài thành công.</p>:<button type="button" className="lesson-submit-button" disabled={busy || incomplete} onClick={()=>void submit()}>{busy?"Đang nộp…":"Nộp bài"}</button>}</div>;
}
