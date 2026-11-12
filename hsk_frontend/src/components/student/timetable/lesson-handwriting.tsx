"use client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type HanziWriter from "hanzi-writer";
import { loadHanziChar } from "@/lib/dictionary/hanzi-writer-loader";
import type { Word } from "./lesson-panels";
import "./lesson-handwriting.css";

type Command={kind:"idle"|"demo"|"write"|"reset";sequence:number};
type Filter="all"|"new"|"learned";
function CharacterPad({character,index,command,hideHint,onReady,onComplete}:{character:string;index:number;command:Command;hideHint:boolean;onReady:(index:number,ready:boolean)=>void;onComplete:(index:number)=>void}){
 const target=useRef<HTMLDivElement>(null);const writer=useRef<HanziWriter|null>(null);
 const [status,setStatus]=useState<"loading"|"ready"|"error">("loading");
 const ready=useEffectEvent(onReady);const complete=useEffectEvent(onComplete);
 useEffect(()=>{let disposed=false;const element=target.current;if(!element)return;
  Promise.all([import("hanzi-writer"),loadHanziChar(character)]).then(([{default:Writer},data])=>{
   if(disposed)return;if(!data){setStatus("error");ready(index,false);return;}
   writer.current=Writer.create(element,character,{width:240,height:240,padding:15,showCharacter:false,showOutline:true,strokeColor:"#252525",outlineColor:"#ddd",highlightColor:"#ef2634",drawingColor:"#333",strokeAnimationSpeed:1,delayBetweenStrokes:160,showHintAfterMisses:3,charDataLoader:(_char,onLoad)=>onLoad(data)});
   setStatus("ready");ready(index,true);
  }).catch(()=>{if(!disposed){setStatus("error");ready(index,false);}});
  return ()=>{disposed=true;writer.current?.cancelQuiz();writer.current=null;element.replaceChildren();};
 },[character,index]);
 useEffect(()=>{if(status !== "ready" || !writer.current)return;void (hideHint?writer.current.hideOutline():writer.current.showOutline());},[hideHint,status]);
 useEffect(()=>{const current=writer.current;if(status !== "ready" || !current)return;let cancelled=false;current.cancelQuiz();
  if(command.kind === "write")void current.quiz({onComplete:()=>{if(!cancelled)complete(index);}});
  else if(command.kind === "demo")void current.animateCharacter();
  else void current.hideCharacter();
  return ()=>{cancelled=true;current.cancelQuiz();};
 },[command,status,index]);
 return <div className="lh-character"><span>Ký tự {index+1}: {character}</span><div className="lh-grid" aria-label={`Ô luyện viết ${character}`}><div ref={target}/>{status === "loading" && <p role="status">Đang tải nét chữ…</p>}{status === "error" && <p role="status">Chưa có dữ liệu nét chữ</p>}</div></div>;
}
function WordPractice({word,count,learned,onComplete}:{word:Word;count:number;learned:boolean;onComplete:()=>void}){
 const characters=Array.from(word.word).filter(character=>/\p{Script=Han}/u.test(character));
 const [success,setSuccess]=useState(false);const [hideHint,setHideHint]=useState(false);const [demo,setDemo]=useState(false);const [writing,setWriting]=useState(false);const [command,setCommand]=useState<Command>({kind:"idle",sequence:0});const [ready,setReady]=useState<Record<number,boolean>>({});
 const completed=useRef(new Set<number>());const roundDone=useRef(false);
 const canPractice=characters.length>0 && characters.every((_,i)=>ready[i]);
 const issue=(kind:Command["kind"])=>setCommand(previous=>({kind,sequence:previous.sequence+1}));
 const begin=()=>{setSuccess(false);completed.current.clear();roundDone.current=false;setWriting(true);issue("write");};
 const reset=()=>{setSuccess(false);completed.current.clear();roundDone.current=false;setWriting(false);issue("reset");};
 const finish=(i:number)=>{completed.current.add(i);if(completed.current.size===characters.length&&!roundDone.current){roundDone.current=true;setWriting(false);setSuccess(true);onComplete();}};
 return <div className="lh-practice-card"><aside className="lh-word-panel"><small>CHỮ ĐANG LUYỆN</small><strong className="lh-word">{word.word}</strong><div className="lh-word-meta"><span>{word.pinyin}</span>{word.pos && <small>{word.pos}</small>}</div><p className="lh-meaning"><b>Nghĩa:</b> {word.meaning || "Chưa có dữ liệu"}</p>{word.examples[0] && <div className="lh-example"><b>▶ Ví dụ:</b> {word.examples[0].cn}</div>}<div className="lh-tips"><h3>ⓘ Hướng dẫn</h3><p>Xem mẫu để xem hướng dẫn nét từng nét một</p><p>Luyện viết nhiều lần để nhớ nét ký tự</p><p>Click “Thẻ sau” để tiếp tục luyện viết chữ khác</p></div></aside>
 <section className="lh-workspace"><div className="lh-workspace-heading"><span>Số lần luyện viết đúng <strong>{count}</strong></span><span className={learned?"is-learned":""}>{learned?"Đã học":"Chưa luyện"}</span></div><div className="lh-characters">{characters.length?characters.map((character,i)=><CharacterPad key={`${character}-${i}`} character={character} index={i} command={command} hideHint={hideHint} onReady={(index,loaded)=>setReady(previous=>({...previous,[index]:loaded}))} onComplete={finish}/>):<div className="lh-no-characters" role="status">Chưa có ký tự tiếng Trung để luyện viết.</div>}</div>
 <div className="lh-controls"><div className="lh-switches"><label><input type="checkbox" role="switch" checked={demo} disabled={!canPractice} onChange={event=>{setDemo(event.target.checked);setSuccess(false);setWriting(false);issue(event.target.checked?"demo":"reset");}}/><span>Xem mẫu</span></label><label><input type="checkbox" role="switch" checked={hideHint} onChange={event=>setHideHint(event.target.checked)}/><span>Ẩn nét gợi ý</span></label></div><div className="lh-actions"><button type="button" className="lh-start" disabled={!canPractice || writing} onClick={begin}><i className="fa-regular fa-pen-to-square" aria-hidden="true"/> {writing?"Đang luyện…":"Bắt đầu viết ngay"}</button><button type="button" disabled={!canPractice} onClick={reset}><i className="fa-solid fa-rotate-left" aria-hidden="true"/> Viết lại</button></div><div className="lh-announcement" role="status" aria-live="polite">{success?"Đã hoàn thành lượt viết!":writing?"Viết lần lượt theo đúng thứ tự nét trong từng ô.":""}</div></div></section></div>;
}
export default function LessonHandwriting({words}:{words:Word[]}){
 const [counts,setCounts]=useState<Record<string,number>>({});const [filter,setFilter]=useState<Filter>("all");const [activeId,setActiveId]=useState(words[0]?.id || "");
 const learned=(word:Word)=>word.learned || (counts[word.id] || 0)>0;const learnedCount=words.filter(learned).length;
 const visible=words.filter(word=>filter === "all" || (filter === "learned"?learned(word):!learned(word)));
 const index=Math.max(0,visible.findIndex(word=>word.id===activeId));const word=visible[index];const percent=words.length?Math.round(learnedCount/words.length*100):0;
 const chooseFilter=(next:Filter)=>{setFilter(next);setActiveId("");};
 return <div className="lesson-handwriting"><div className="lh-breadcrumb">• Tài liệu học tập <span>/</span> Từ vựng <span>/</span> <strong>Luyện viết</strong></div><div className="lh-heading"><h2>Flashcard - Luyện viết</h2><div className="lh-progress"><div>Tiến độ luyện viết <strong>{learnedCount}/{words.length}</strong> <b>{percent}%</b></div><progress aria-label="Tiến độ luyện viết" value={percent} max={100}/></div></div><div className="lh-filters">{([{key:"all",label:"Tất cả",count:words.length},{key:"new",label:"Chưa luyện",count:words.length-learnedCount},{key:"learned",label:"Đã học",count:learnedCount}] as const).map(item=><button key={item.key} type="button" className={filter===item.key?"is-active":""} aria-pressed={filter===item.key} onClick={()=>chooseFilter(item.key)}>{item.label} ({item.count})</button>)}</div>
 {word?<><WordPractice key={word.id} word={word} count={counts[word.id] || 0} learned={learned(word)} onComplete={()=>setCounts(previous=>({...previous,[word.id]:(previous[word.id] || 0)+1}))}/><nav className="lh-bottom-nav" aria-label="Chọn thẻ luyện viết"><button type="button" disabled={index===0} onClick={()=>setActiveId(visible[index-1].id)}>‹ Thẻ trước</button><div><strong>{index+1} / {visible.length}</strong><progress aria-label="Vị trí thẻ" value={index+1} max={visible.length}/></div><button type="button" disabled={index===visible.length-1} onClick={()=>setActiveId(visible[index+1].id)}>Thẻ sau ›</button></nav></>:<div className="lh-empty" role="status"><h3>{words.length?"Không có thẻ trong bộ lọc này":"Chưa có dữ liệu"}</h3><p>{words.length?"Chọn bộ lọc khác để tiếp tục luyện viết.":"Từ vựng của buổi học chưa được gắn vào giáo trình."}</p></div>}
 {words.length>0 && learnedCount===words.length && <div className="lh-completed" role="status">🎉 Bạn đã hoàn thành toàn bộ nội dung trong study-set này.</div>}
 </div>;
}
