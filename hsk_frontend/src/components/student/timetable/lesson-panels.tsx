"use client";
import type { TimetableModule } from "./timetable-data";
import { safeResourceUrl } from "./lesson-source";
import { plainText } from "./timetable-source";
import LessonVocabulary from "./lesson-vocabulary";
import "./production-vocabulary.css";
import LessonHandwriting from "./lesson-handwriting";

export type VocabularyView = "vocabulary" | "flashcards" | "handwriting";
export type Word = { learned:boolean; progressKnown:boolean; id:string; word:string; pinyin:string; meaning:string; pos:string; image:string|null; audio:string|null; examples:{cn:string;pinyin:string;vi:string}[] };
const object=(value:unknown):Record<string,unknown>=>value && typeof value === "object" && !Array.isArray(value)?value as Record<string,unknown>:{};
const str=(value:unknown)=>typeof value === "string"?plainText(value):"";
export function vocabularyWords(resources:TimetableModule[]):Word[]{
 return resources.filter(item=>item.resourceType === "VOCABULARY").flatMap(resource=>{
  const root=object(resource.content);const values=Array.isArray(root.words)?root.words:Array.isArray(root.items)?root.items:[root];
  return values.flatMap((value,index)=>{const item=object(value);const word=str(item.word);if(!word)return [];return [{progressKnown:resource.progress !== null,learned:resource.progress !== null && resource.progress>=100,id:resource.id+":"+index,word,pinyin:str(item.pinyin),meaning:str(item.commonMeaning),pos:str(item.partOfSpeech),image:safeResourceUrl(str(item.imageUrl)),audio:safeResourceUrl(str(item.ukAudioUrl)),examples:(Array.isArray(item.examples)?item.examples:[]).map(value=>{const e=object(value);return {cn:str(e.en),pinyin:str(e.pinyin),vi:str(e.vi)};})}];});
 });
}
export function VocabularyPanel({resources,view}:{resources:TimetableModule[];view:VocabularyView}){
 const words=vocabularyWords(resources);return view === "handwriting"?<LessonHandwriting words={words}/>:<LessonVocabulary words={words} view={view}/>;
}
export { ExercisePanel } from "./lesson-exercise-panel";
