"use client";
/* eslint-disable @next/next/no-img-element */
import {fileUrl} from "@/lib/api/storage-client";
import {safeResourceUrl} from "./lesson-source";
import ResultAudio from "./result-audio";
import {resultRecord as obj,resultTotals,type SessionResultData} from "./session-result-source";
import "./session-result.css";
const text=(v:unknown)=>typeof v==="string"?v.replace(/<br\s*\/?\s*>/gi,"\n").replace(/<[^>]*>/g," ").replace(/&nbsp;/g," "):"";
const num=(v:unknown)=>typeof v==="number"?v:null;
function answer(value:unknown){try{return obj(typeof value==="string"?JSON.parse(value):value);}catch{return {};}}
const rows=(v:unknown)=>Array.isArray(v)?v.map(obj):[];
function mediaUrl(v:unknown){const m=obj(v);return safeResourceUrl(typeof m.url==="string"?m.url:undefined) || fileUrl(typeof m.fileId==="string"?m.fileId:undefined);}
function QuestionResult({row,index}:{row:Record<string,unknown>;index:number}){
 const q=obj(row.question),a=answer(row.answerJson),options=rows(q.options),pairs=rows(q.matchingPairs),blanks=rows(q.blanks);
 const earned=num(row.earnedPoints),max=num(row.maxPoints),graded=earned!==null;
 const selected=Array.isArray(a.selectedOptionIndexes)?a.selectedOptionIndexes:[a.selectedOptionIndex];
 const part=(i:number)=>{const p=rows(row.parts).find(p=>p.index===i);return typeof p?.correct==="boolean"?p.correct:null;};
 const explanation=text(q.explanation),feedback=text(row.graderComment);
 const audio=mediaUrl(a.audio),files=rows(a.files);
 const chunks=rows(q.sentenceChunks),order=Array.isArray(a.chunkOrder)?a.chunkOrder:[];
 const prose=typeof a.text==="string"?a.text:order.map(i=>text(chunks[Number(i)]?.content)).join(" ");
 return <article className="session-result-question"><div className="session-result-question-head"><p>{text(q.questionText || q.sentenceTemplate) || `Câu ${index+1}`}</p><span className={`session-result-points ${graded?(max!==null && earned>=max?"is-full":"is-partial"):"is-pending"}`}>{graded?`Điểm: ${earned}/${max ?? "—"}`:"Chờ chấm"}</span></div>
 {rows(q.media).map((m,i)=>{const url=mediaUrl(m);return url?String(m.kind).toLowerCase()==="audio"?<ResultAudio key={i} url={url}/>:String(m.kind).toLowerCase()==="image"?<img className="session-result-image" src={url} alt="Hình minh họa câu hỏi" key={i}/>:null:null;})}
 <p className="session-result-muted">Các đáp án:</p>
 {options.length>0 && options.map((o,i)=>{const chosen=selected.includes(o.optionIndex ?? i),known=typeof o.correct==="boolean" && graded,correct=known && o.correct===true;
 return <div key={i} className={`session-result-option ${correct?"is-correct":chosen && known?"is-wrong":""}`}><span>{correct?"✓ ":chosen && known?"✕ ":""}{text(o.content)}</span>{chosen && <em>(Đáp án của bạn)</em>}</div>;})}
 {pairs.length>0 && <><p className="session-result-muted">Đáp án đúng:</p>{pairs.map((p,i)=><div className={`session-result-pair ${graded && typeof p.answer==="string"?"is-correct":""}`} key={i}><span>{text(p.prompt)}</span><span>›</span><span>{graded?text(p.answer)||"Chưa có dữ liệu":"Chưa công bố"}</span></div>)}<p className="session-result-muted">Bạn đã nối:</p>{pairs.map((p,i)=>{const correct=part(Number(p.pairIndex ?? i));return <div className={`session-result-pair ${correct===true?"is-correct":correct===false?"is-wrong":""}`} key={i}><span>{text(p.prompt)}</span><span>›</span><span>{String(obj(a.matchingAnswers)[String(p.pairIndex ?? i)] ?? "Chưa trả lời")}</span></div>;})}</>}
 {blanks.length>0 && blanks.map((blank,i)=>{const correct=part(Number(blank.blankIndex ?? i));return <div key={i}><div className={`session-result-option ${correct===true?"is-correct":correct===false?"is-wrong":""}`}>Bài làm của bạn: {String(obj(a.blankAnswers)[String(blank.blankIndex ?? i)] ?? "Chưa trả lời")}</div>{graded && <div className="session-result-option is-correct">Đáp án đúng: {text(blank.correctAnswer) || "Chưa có dữ liệu"}</div>}</div>;})}
 {!options.length && !pairs.length && !blanks.length && !audio && !files.length && <><div className="session-result-option">Bài làm của bạn: {prose || "Chưa có dữ liệu câu trả lời"}</div>{graded && q.correctSentence!=null && <div className="session-result-option is-correct">Đáp án đúng: {text(q.correctSentence)}</div>}</>}
 {audio && <><p className="session-result-muted">Câu trả lời của bạn:</p><ResultAudio url={audio}/></>}
 {files.map((f,i)=>{const url=mediaUrl(f);return url?<a className="session-result-option" href={url} target="_blank" rel="noreferrer" key={i}>{text(f.fileName)||`Tệp đã nộp ${i+1}`}</a>:<p key={i}>Chưa có liên kết tệp đã nộp.</p>;})}
 {(explanation || pairs.some(p=>p.explanation) || blanks.some(p=>p.explanation)) && <details className="session-result-explanation"><summary>ⓘ Giải thích đáp án</summary>{explanation && <p>{explanation}</p>}{[...pairs,...blanks].filter(p=>p.explanation).map((p,i)=><p key={i}>{text(p.explanation)}</p>)}</details>}
 {feedback && <p className="session-result-feedback"><strong>Nhận xét của giáo viên:</strong> {feedback}</p>}
 </article>;
}
export default function SessionResultView({data,onBack}:{data:SessionResultData;onBack:()=>void}){
 const totals=resultTotals(data.sections);const labels:Record<string,string>={LISTENING:"Phần nghe",READING:"Phần đọc",WRITING:"Phần viết",SPEAKING:"Phần nói",PRONUNCIATION:"Phần nói"};
 return <main className="session-result-page"><header><button type="button" className="session-result-back-icon" aria-label="Quay lại thời khóa biểu" onClick={onBack}>‹</button><strong>{data.title}</strong><p className="session-result-muted">Đã chấm {totals.graded} bài{totals.graded<data.sections.length?` · ${data.sections.length-totals.graded} bài đang chờ chấm`:""}</p></header>
 {data.warnings.length>0 && <div className="session-result-warning" role="alert">{data.warnings.map((w,i)=><p key={i}>{w}</p>)}</div>}
 <section className="session-result-overview"><div className="session-result-stat-grid"><div className="session-result-stat"><i className="fa-regular fa-rectangle-list" aria-hidden="true"/><strong>{totals.count}</strong><span>Số câu hỏi đã làm</span></div><div className="session-result-stat is-score"><i className="fa-regular fa-star" aria-hidden="true"/><strong>{totals.scored?`${totals.earned}/${totals.total}`:"—"}</strong><span>Số điểm đạt được</span></div></div>{totals.graded===data.sections.length && totals.total>0?<span className="session-result-badge">{totals.earned/totals.total>=.8?"♧ Tốt!":"Đã có kết quả chấm bài"}</span>:<span className="session-result-badge is-pending">{data.sections.length?"Đang chờ chấm bài":"Chưa có bài nộp"}</span>}</section>
 {data.sections.map(section=>{const questions=rows(section.data.questions).sort((a,b)=>Number(a.displayOrder ?? 0)-Number(b.displayOrder ?? 0));const layout=obj(section.data.layout),meta=obj(layout.meta);const audio=mediaUrl(meta.audio) || safeResourceUrl(typeof meta.audioUrl==="string"?meta.audioUrl:undefined) || fileUrl(typeof meta.audioFileId==="string"?meta.audioFileId:undefined);return <section className="session-result-section" key={section.id}><div className="session-result-section-head"><span className="session-result-skill">{labels[section.skill] || "Bài tập"}</span><strong>{section.title}</strong><span className={`session-result-section-score ${num(section.data.earnedPoints)===null?"is-pending":Number(section.data.earnedPoints)/Number(section.data.totalPoints)>=.8?"":"is-low"}`}>{num(section.data.earnedPoints) ?? "—"}/{num(section.data.totalPoints) ?? "—"} điểm</span></div>{(audio || typeof meta.readingPassage==="string") && <div className="session-result-paper"><p className="session-result-muted">Ngữ liệu bài</p>{audio && <ResultAudio url={audio}/ >}{typeof meta.readingPassage==="string" && <p>{text(meta.readingPassage)}</p>}</div>}<div className="session-result-paper"><h2>♧ Chi tiết câu hỏi</h2>{questions.length?questions.map((q,i)=><QuestionResult row={q} index={i} key={String(q.questionId || i)}/>):<p>Chưa có dữ liệu câu hỏi.</p>}</div></section>;})}
 <button type="button" className="session-result-back" onClick={onBack}>‹　Quay lại</button></main>;
}
