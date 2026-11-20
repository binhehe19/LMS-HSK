import {fileUrl} from "@/lib/api/storage-client";
import {matchingAnswers,optionLabel} from "@/lib/assessment/answer-codec";
import {record} from "./lesson-assessment-source";
function answerText(question:Record<string,unknown>):string {
 let value:Record<string,unknown>={};try{value=record(typeof question.answerJson === "string"?JSON.parse(question.answerJson):question.answerJson);}catch{return "Chưa tải được đáp án";}
 if(record(value.audio).fileId)return "Bản ghi âm đã nộp";
 if(Array.isArray(value.files))return value.files.map(f=>String(record(f).fileName || "Tệp đã nộp")).join(", ");
 if(typeof value.text === "string")return value.text;
 if(typeof value.selectedOptionIndex === "number"){
  const options=Array.isArray(question.options)?question.options:[];
  const option=options.find((raw,i)=>(record(raw).optionIndex ?? i)===value.selectedOptionIndex);
  return typeof record(option).content === "string"?String(record(option).content):`Lựa chọn ${value.selectedOptionIndex+1}`;
 }
 const blanks=record(value.blankAnswers);if(Object.keys(blanks).length)return Object.values(blanks).map(String).join("; ");
 // Câu nối lưu optionIndex: đổi ra nhãn lựa chọn.
 const matched=Object.values(matchingAnswers(value));if(matched.length)return matched.map(index=>optionLabel(question.options,index) || `Lựa chọn ${index+1}`).join("; ");
 if(Array.isArray(value.selectedOptionIndexes)){const options=Array.isArray(question.options)?question.options:[];return value.selectedOptionIndexes.map(index=>{const option=options.find((raw,i)=>(record(raw).optionIndex ?? i)===index);return String(record(option).content || `Lựa chọn ${Number(index)+1}`);}).join("; ");}
 return "Chưa có đáp án hiển thị";
}
export function resultDraft(question:Record<string,unknown>,id:string):{answers:Record<string,string>;selected:Record<string,string>}{
 let value:Record<string,unknown>={};try{value=record(typeof question.answerJson === "string"?JSON.parse(question.answerJson):question.answerJson);}catch{return {answers:{},selected:{}};}
 const answers:Record<string,string>={};const selected:Record<string,string>={};
 if(typeof value.text === "string")answers[id]=value.text;
 if(typeof value.selectedOptionIndex === "number"){
  const options=Array.isArray(question.options)?question.options:[];const i=options.findIndex((v,i)=>(record(v).optionIndex ?? i)===value.selectedOptionIndex);if(i>=0)selected[id]=String(i);
 }
 for(const [field,parts,indexKey] of [["blankAnswers",question.blanks,"blankIndex"],["matchingAnswers",question.matchingPairs,"pairIndex"]] as const){
  if(Array.isArray(parts))parts.forEach((raw,i)=>{const text=record(value[field])[String(record(raw)[indexKey] ?? i)];if(typeof text === "string" || typeof text === "number")answers[id+":"+i]=String(text);});
 }
 if(Array.isArray(value.selectedOptionIndexes)){
  const options=Array.isArray(question.options)?question.options:[];selected[id]=JSON.stringify(options.flatMap((v,i)=>value.selectedOptionIndexes instanceof Array && value.selectedOptionIndexes.includes(record(v).optionIndex ?? i)?[i]:[]));
 }
 if(value.audio || value.files || value.chunkOrder)answers[id]=JSON.stringify(value);
 return {answers,selected};
}
export default function LessonAnswerReview({question}:{question:Record<string,unknown>}){
 let audio="";try{audio=fileUrl(String(record(record(JSON.parse(String(question.answerJson || "{}"))).audio).fileId || "")) || "";}catch{}
 const graded=question.earnedPoints !== null && question.earnedPoints !== undefined;
 const explanation=typeof question.explanation === "string"?question.explanation.replace(/<[^>]*>/g," "):"";
 const feedback=typeof question.graderComment === "string"?question.graderComment:"";
 return <div className="lesson-answer-review"><span className="lesson-review-icon" aria-hidden="true">◷</span><div><strong>{graded?`Điểm: ${question.earnedPoints} / ${question.maxPoints ?? "—"}`:"Chờ giáo viên chấm"}</strong><p><b>Đáp án của bạn:</b> {answerText(question)}</p>{audio && <audio controls src={audio}/>}{explanation && <p><b>Giải thích:</b> {explanation}</p>}{feedback && <p><b>Nhận xét:</b> {feedback}</p>}</div></div>;
}
