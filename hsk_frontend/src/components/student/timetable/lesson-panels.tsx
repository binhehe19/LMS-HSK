"use client";
import { useCallback, useRef, useState } from "react";
import type { TimetableModule, TimetableSession } from "./timetable-data";
import { safeResourceUrl } from "./lesson-source";
import { LessonRecorder, QuestionFields } from "./lesson-question-fields";
import { readLessonAssessments, startLessonAssessment } from "./lesson-assessment-source";
import { useStudentRequest } from "../student-data";
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
export function LessonAudio({url}:{url?:string}){const audio=useRef<HTMLAudioElement>(null);const [playing,setPlaying]=useState(false);const [time,setTime]=useState(0);const [duration,setDuration]=useState(0);const [speed,setSpeed]=useState(1);const source=safeResourceUrl(url);const stamp=(n:number)=>`${Math.floor(n/60).toString().padStart(2,"0")}:${Math.floor(n%60).toString().padStart(2,"0")}`;
 return <div className="hsk-audio-player">{source && <audio ref={audio} src={source} onLoadedMetadata={()=>setDuration(Number.isFinite(audio.current?.duration)?audio.current!.duration:0)} onTimeUpdate={()=>setTime(audio.current?.currentTime || 0)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)}/>}<button type="button" disabled={!source} aria-label={playing?"Tạm dừng":"Phát âm thanh"} onClick={()=>{if(playing)audio.current?.pause();else void audio.current?.play().catch(()=>{});}}>{playing?"Ⅱ":"▶"}</button><span>{stamp(time)}</span><input type="range" aria-label="Vị trí âm thanh" min={0} max={duration || 1} step="0.1" value={time} disabled={!source} onChange={e=>{if(audio.current)audio.current.currentTime=Number(e.target.value);}}/><span>{stamp(duration)}</span><button type="button" disabled={!source} aria-label="Nghe lại" onClick={()=>{if(audio.current)audio.current.currentTime=0;}}>↻</button><button type="button" disabled={!source} onClick={()=>{const next=speed===2?0.75:speed+0.25;setSpeed(next);if(audio.current)audio.current.playbackRate=next;}}>{speed}x</button></div>;
}
export function ExercisePanel({resources,skill,session,isAdmin}:{session?:TimetableSession;isAdmin:boolean;resources:TimetableModule[];skill:"listening"|"reading"|"writing"|"speaking"}){
 const [index,setIndex]=useState(0);const [answers,setAnswers]=useState<Record<string,string>>({});const [selected,setSelected]=useState<Record<string,string>>({});
 const live=useStudentRequest(useCallback(()=>readLessonAssessments(resources),[resources]));const [started,setStarted]=useState<TimetableModule|null>(null);const [starting,setStarting]=useState(false);const [startError,setStartError]=useState("");
 const displayResources=started?[started]:(live.data?.resources || resources);
 const start=async()=>{if(!session||!resources[0]||isAdmin)return;setStarting(true);setStartError("");try{setStarted(await startLessonAssessment(resources[0],session));}catch(error){setStartError(error instanceof Error?error.message:"Không tải được bài tập");}finally{setStarting(false);}};
 const questions=displayResources.flatMap(resource=>{const content=object(resource.content);return (Array.isArray(content.questions)?content.questions:[]).map((value,i)=>({resource,question:object(value),id:resource.id+":"+i}));});const current=questions[index];const q=current?.question || {};const prompt=typeof q.questionText === "string"?q.questionText.replace(/<br\s*\/?\s*>/gi,"\n").replace(/<[^>]*>/g," "):"";const type=str(q.questionType);const options=Array.isArray(q.options)?q.options:[];
 const names={listening:"Nghe",reading:"Đọc",writing:"Viết",speaking:"Nói"};
 return <div className={`hsk-exercise is-${skill}`}><div className="hsk-lesson-breadcrumb">● Luyện bài / {names[skill]}</div><div className="hsk-exercise-frame"><header><h2>{current?.resource.title || resources[0]?.title || `Phần ${names[skill]}`}</h2></header><section className="hsk-exercise-question"><div className="hsk-question-meta"><span>Câu {questions.length?index+1:0}/{questions.length}</span><span>{type === "MULTIPLE_CHOICE"?"Trắc nghiệm":type === "FILL_IN_BLANK"?"Điền từ":skill === "speaking"?"Ghi âm":"Bài tập"}</span></div>
 {!current?<div className="hsk-lesson-empty"><h3>{live.loading?"Đang tải bài tập…":"Chưa có dữ liệu"}</h3><p>{resources.length?"Bài tập đã được gắn nhưng chưa có nội dung đề được cấp cho trang này.":"Buổi học chưa được gắn bài tập này."}</p>{!isAdmin && resources.some(item=>item.resourceId && item.packageVersionId) && <button type="button" className="lesson-start-attempt" disabled={starting || live.loading} onClick={()=>void start()}>{starting?"Đang tải…":"Bắt đầu bài tập"}</button>}{(startError || live.data?.warnings.length) && <p role="alert">{startError || live.data?.warnings.join(" · ")}</p>}</div>:<>{type !== "FILL_IN_BLANK" && <p className="hsk-exercise-prompt">{prompt}</p>}{(skill === "listening" || skill === "speaking") && <LessonAudio url={str(object((Array.isArray(q.media)?q.media:[]).find(item=>str(object(item).kind) === "audio")).url)}/>}
 {!!options.length && type !== "MATCHING" && type !== "FILL_IN_BLANK" && <div className="hsk-answer-options">{options.map((value,i)=>{const option=object(value);return <button type="button" key={i} className={selected[current.id]===String(i)?"is-selected":""} onClick={()=>setSelected({...selected,[current.id]:String(i)})}><span>{String.fromCharCode(65+i)}</span>{str(option.content)}</button>;})}</div>}
 {((!options.length || type === "MATCHING" || type === "FILL_IN_BLANK") && skill !== "speaking") && <QuestionFields question={q} id={current.id} answers={answers} onChange={(key,value)=>setAnswers(previous=>({...previous,[key]:value}))}/>}
 {skill === "speaking" && <LessonRecorder key={current.id}/>}
 <p className="hsk-local-answer-note">Câu trả lời chỉ giữ trên trang; chưa nộp bài hoặc lưu tiến độ.</p></>}
 <div className="hsk-exercise-nav"><button type="button" disabled={!current || index===0} onClick={()=>setIndex(index-1)}>‹ Câu trước</button><button type="button" disabled={!current || index===questions.length-1} onClick={()=>setIndex(index+1)}>Câu sau ›</button></div></section><footer className="hsk-question-map">{questions.map((item,i)=><button type="button" key={item.id} aria-label={`Câu ${i+1}`} aria-current={index===i?"step":undefined} className={index===i?"is-active":""} onClick={()=>setIndex(i)}>{i+1}</button>)}</footer></div></div>;
}
