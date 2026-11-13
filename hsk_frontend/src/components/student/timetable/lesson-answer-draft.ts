"use client";
import { useEffect, useState } from "react";
type Draft = { answers: Record<string,string>; selected: Record<string,string>; confirmed:Record<string,string> };
const empty = (): Draft => ({answers:{},selected:{},confirmed:{}});
const strings = (value:unknown):Record<string,string> => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([,v])=>typeof v === "string")) : {};
export function useLessonAnswerDraft(key:string) {
 const [state,setState]=useState<{key:string;draft:Draft}>({key:"",draft:empty()});
 const [stored,setStored]=useState(true);
 useEffect(()=>{let active=true;Promise.resolve().then(()=>{
  let draft=empty();try{const raw=localStorage.getItem(key);if(raw){const saved=JSON.parse(raw);draft={answers:strings(saved.answers),selected:strings(saved.selected),confirmed:strings(saved.confirmed)};}}catch{/* A damaged or unavailable browser draft must not block the exercise. */}
  if(active)setState({key,draft});
 });return ()=>{active=false;};},[key]);
 const draft=state.key === key?state.draft:empty();
 const update=(next:Draft)=>{setState({key,draft:next});try{localStorage.setItem(key,JSON.stringify(next));setStored(true);}catch{setStored(false);}};
 const unconfirm=(id:string)=>Object.fromEntries(Object.entries(draft.confirmed).filter(([key])=>key!==id && !id.startsWith(key+":")));
 return {...draft,stored,clear:()=>update(empty()),ready:state.key===key,setAnswer:(id:string,value:string)=>update({...draft,answers:{...draft.answers,[id]:value},confirmed:unconfirm(id)}),select:(id:string,value:string)=>update({...draft,selected:{...draft.selected,[id]:value},confirmed:unconfirm(id)}),confirm:(id:string,answered:boolean)=>update({...draft,confirmed:{...draft.confirmed,[id]:answered?"yes":""}})};
}
export function selectedChoices(value:string|undefined):number[]{
 try{const parsed=JSON.parse(value || "[]");return Array.isArray(parsed)?parsed.filter((i):i is number=>Number.isInteger(i) && i>=0):Number.isInteger(parsed) && parsed>=0?[parsed]:[];}catch{return [];}
}
export function hasQuestionAnswer(id:string,question:Record<string,unknown>,answers:Record<string,string>,selected:Record<string,string>):boolean {
 if(question.questionType === "MULTIPLE_CHOICE" || question.questionType === "MULTIPLE_SELECT")return selectedChoices(selected[id]).length>0;
 if(["AUDIO_RESPONSE","FILE_UPLOAD","SENTENCE_BUILDER"].includes(String(question.questionType))){
  try{const value=JSON.parse(answers[id] || "{}");if(question.questionType === "AUDIO_RESPONSE")return typeof value.audio?.fileId === "string" && Boolean(value.audio.fileId);
   if(question.questionType === "FILE_UPLOAD")return Array.isArray(value.files) && value.files.length>0 && value.files.every((f:Record<string,unknown>)=>typeof f.fileId === "string" && Boolean(f.fileId));
   return Array.isArray(value.chunkOrder) && value.chunkOrder.length>0;
  }catch{return false;}
 }
 const fields=question.questionType === "MATCHING"?question.matchingPairs:question.questionType === "FILL_IN_BLANK"?question.blanks:null;
 if(Array.isArray(fields) && fields.length)return fields.every((_,i)=>Boolean(answers[id+":"+i]?.trim()));
 return Boolean(answers[id]?.trim());
}
