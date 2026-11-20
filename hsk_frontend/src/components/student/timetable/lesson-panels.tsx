"use client";
import type { TimetableModule } from "./timetable-data";
import { safeResourceUrl } from "./lesson-source";
import { plainText } from "./timetable-source";
import LessonVocabulary from "./lesson-vocabulary";
import "./production-vocabulary.css";
import LessonHandwriting from "./lesson-handwriting";

export type VocabularyView = "vocabulary" | "flashcards" | "handwriting";
export type Word = { topic?:string; learned:boolean; progressKnown:boolean; id:string; resourceId?:string; word:string; pinyin:string; meaning:string; pos:string; image:string|null; audio:string|null; examples:{cn:string;pinyin:string;vi:string}[] };
const object=(value:unknown):Record<string,unknown>=>value && typeof value === "object" && !Array.isArray(value)?value as Record<string,unknown>:{};
const str=(value:unknown)=>typeof value === "string"?plainText(value):"";
export function vocabularyWords(resources:TimetableModule[]):Word[]{
 return resources.filter(item=>item.resourceType === "VOCABULARY").flatMap(resource=>{
  const root=object(resource.content);const values=Array.isArray(root.words)?root.words:Array.isArray(root.items)?root.items:[root];
  // Nội dung từ vựng ZH: chữ Hán ở `word`, phiên âm/nghĩa/ví dụ nằm trong pinyins[].meanings[]; lấy phiên âm chính (hoặc đầu tiên).
  return values.flatMap((value,index)=>{const item=object(value);const word=str(item.word);if(!word)return [];
   const pinyins=(Array.isArray(item.pinyins)?item.pinyins:[]).map(object);const primary=pinyins.find(p=>p.isPrimary === true)??pinyins[0]??{};
   const meanings=(Array.isArray(primary.meanings)?primary.meanings:[]).map(object);
   const meaning=meanings.map(m=>str(m.meaningVi)||str(m.meaningEn)).find(Boolean)??"";
   const examples=meanings.flatMap(m=>(Array.isArray(m.examples)?m.examples:[]).map(object)).map(e=>({cn:str(e.zh),pinyin:str(e.pinyin),vi:str(e.vi)})).filter(e=>e.cn);
   return [{topic:resource.topicTitle,progressKnown:resource.progress !== null,learned:resource.progress !== null && resource.progress>=100,id:resource.id+":"+index,resourceId:resource.resourceId,word,pinyin:str(primary.pinyin),meaning,pos:str(primary.wordTypes),image:safeResourceUrl(str(item.imageUrl)),audio:safeResourceUrl(str(primary.audioUrl)),examples}];});
 });
}
export function VocabularyPanel({resources,view}:{resources:TimetableModule[];view:VocabularyView}){
 const words=vocabularyWords(resources);return view === "handwriting"?<LessonHandwriting words={words}/>:<LessonVocabulary words={words} view={view}/>;
}
export { ExercisePanel } from "./lesson-exercise-panel";
