"use client";
/* eslint-disable @next/next/no-img-element */
import {studentApi} from "@/lib/api/student-client";
import { useState } from "react";
import { Modal } from "antd";
import type { Word } from "./lesson-panels";
function speak(text:string,url?:string|null){if(url){void new Audio(url).play().catch(()=>{});return;}if("speechSynthesis" in window){const utterance=new SpeechSynthesisUtterance(text);utterance.lang="zh-CN";speechSynthesis.speak(utterance);}}
export default function LessonVocabulary({words,view}:{words:Word[];view:"vocabulary"|"flashcards"}){
 const [topic,setTopic]=useState("");const topics=[...new Set(words.map(item=>item.topic).filter((item):item is string=>!!item))];
 const [filter,setFilter]=useState("all");const [active,setActive]=useState("");const [flipped,setFlipped]=useState(false);const [detail,setDetail]=useState<Word|null>(null);const [marked,setMarked]=useState<Record<string,boolean>>({});
 const [saving,setSaving]=useState(false);const [saveError,setSaveError]=useState("");
 const learned=(word:Word)=>marked[word.id] ?? word.learned;const learnedCount=words.filter(learned).length;const filtered=words.filter(word=>(!topic || word.topic===topic) && (filter === "all" || (filter === "learned"?learned(word):!learned(word))));const index=Math.max(0,filtered.findIndex(word=>word.id===active));const word=filtered[index];const flash=view === "flashcards";const prefix=flash?"fcm":"vlm";const title=flash?"Flashcard":"Từ vựng";const progressKnown=words.some(word=>word.progressKnown) || Object.keys(marked).length>0;const percent=words.length?Math.round(learnedCount/words.length*100):0;
 const mark=async(word:Word)=>{if(saving)return;if(!word.resourceId){setSaveError("Từ vựng chưa có mã học liệu để lưu tiến độ.");return;}setSaving(true);setSaveError("");const next=!learned(word);const updated={...marked,[word.id]:next};const known=words.filter(w=>w.resourceId===word.resourceId).every(w=>updated[w.id] ?? w.learned);try{const result=await studentApi.saveVocabularyState(word.resourceId,known);if(result.learningResourceId!==word.resourceId || (result.comprehensionLevel==="KNOWN")!==known)throw Error("Máy chủ chưa xác nhận lưu tiến độ.");setMarked(updated);window.dispatchEvent(new Event("hsk:vocabulary-updated"));}catch(error){setSaveError(error instanceof Error?error.message:"Chưa lưu được tiến độ.");}finally{setSaving(false);}};
 const change=(id:string)=>{setActive(id);setFlipped(false);};
 const statusFilters=<div className={`${prefix}__tabs`} role="group" aria-label="Trạng thái học">
  {[{key:"all",label:"Tất cả",count:words.length},{key:"new",label:"Chưa thuộc",count:words.length-learnedCount},{key:"learned",label:"Đã thuộc",count:learnedCount}].map(item=>
   <button type="button" key={item.key} className={`${prefix}__tab ${filter===item.key?"is-active":""}`} aria-pressed={filter===item.key} onClick={()=>{setFilter(item.key);change("");}}>
    {item.label} ({item.count})
   </button>)}
 </div>;
 const topicFilters=topics.length>0 && <div className={`${prefix}__tabs`} role="group" aria-label="Chủ đề">
  {["",...topics].map(item=><button type="button" key={item||"all-topics"} className={`${prefix}__tab ${topic===item?"is-active":""}`} aria-pressed={topic===item} onClick={()=>{setTopic(item);change("");}}>{item||"Tất cả chủ đề"}</button>)}
 </div>;
 return <div className={prefix}>
  <div className={`${prefix}__header`}>
   <div className={`${prefix}__head-left`}>
    {flash && <div className="fcm__breadcrumb">● Tài liệu học tập <span>/</span> Từ vựng <span>/</span> {title}</div>}
    <h2 className={`${prefix}__title`}>{title}</h2>
    {flash && statusFilters}
   </div>
   <div className={`${prefix}__progress`}>
    <div className={`${prefix}__progress-row`}>
     <span>{flash ? "Tiến độ flashcard" : "Đã thuộc"}</span>
     <strong>{progressKnown ? `${learnedCount}/${words.length}` : "—"}</strong>
     <b>{progressKnown ? `${percent}%` : ""}</b>
    </div>
    <div className={`${prefix}__progress-track`}><span style={{width:`${progressKnown?percent:0}%`}}/></div>
   </div>
  </div>
  {flash ? topicFilters : <div className="vlm__filters">{statusFilters}{topicFilters}</div>}
 {saveError && <p role="alert" className="lesson-vocabulary-error">{saveError}</p>}{words.length>0 && learnedCount===words.length && <div className="lesson-vocabulary-complete" role="status">{flash ? "✓ Bạn đã hoàn thành toàn bộ flashcard." : "✓ Bạn đã thuộc toàn bộ từ vựng của buổi."}</div>}
 {!filtered.length?<div className="hsk-lesson-empty" role="status"><h3>{words.length ? (flash ? "Không có thẻ trong bộ lọc này" : "Không có từ trong bộ lọc này") : "Chưa có dữ liệu"}</h3><p>{words.length?"Chọn bộ lọc khác để xem từ vựng.":"Buổi học chưa được gắn từ vựng."}</p></div>:flash?<><div className="fcm__stage"><div key={word.id} className={`fcm__card ${flipped?"is-flipped":""}`} role="button" tabIndex={0} aria-label="Lật thẻ từ vựng" aria-pressed={flipped} onClick={()=>setFlipped(!flipped)} onKeyDown={event=>{if(event.key === "Enter" || event.key === " "){event.preventDefault();setFlipped(!flipped);}}}><div className="fcm__card-inner"><div className="fcm__face fcm__face--front"><span className="fcm__badge">MẶT TRƯỚC</span>{word.image && <img className="lesson-flash-image" src={word.image} alt={word.word}/>}<strong className="fcm__hanzi">{word.word}</strong><button type="button" className="fcm__speaker" aria-label="Nghe phát âm của từ vựng" onClick={event=>{event.stopPropagation();speak(word.word,word.audio);}}><img src="/assets/hocba/fc-speaker.svg" alt=""/></button><span className="fcm__pinyin">/{word.pinyin || "Chưa có phiên âm"}/</span>{word.pos && <span className="fcm__pos">{word.pos}</span>}<span className="fcm__flip-hint">NHẤN ĐỂ LẬT</span></div><div className="fcm__face fcm__face--back"><span className="fcm__badge">MẶT SAU</span><div className="fcm__back-body"><p className="fcm__def">{word.meaning || "Chưa có dữ liệu nghĩa"}</p>{word.examples.map((example,i)=><div key={i}><span className="fcm__example-chip">Ví dụ</span><p className="fcm__example">{example.cn}<button type="button" className="fcm__speaker" aria-label="Nghe câu ví dụ" onClick={event=>{event.stopPropagation();speak(example.cn);}}><img src="/assets/hocba/fc-speaker.svg" alt=""/></button></p><p className="fcm__example-pinyin">/{example.pinyin}/</p><p className="fcm__example-meaning">{example.vi}</p></div>)}</div></div></div></div><div className="fcm__actions"><button type="button" className={`fcm__mastered ${learned(word)?"is-done":""}`} disabled={saving} onClick={()=>void mark(word)}>{saving?"Đang lưu…":learned(word)?"Đã thuộc":"Đánh dấu đã thuộc"}</button></div></div><div className="fcm__nav"><button type="button" className="fcm__nav-btn" disabled={index===0} onClick={()=>change(filtered[index-1].id)}>‹ Thẻ trước</button><div className="fcm__nav-center"><strong>{index+1} / {filtered.length}</strong><div className="fcm__nav-track"><span style={{width:`${(index+1)/filtered.length*100}%`}}/></div></div><button type="button" className="fcm__nav-btn" disabled={index===filtered.length-1} onClick={()=>change(filtered[index+1].id)}>Thẻ sau ›</button></div><section className="fcm__table" aria-label="Danh sách thẻ">
 <h3 className="fcm__table-head">Danh sách thẻ <span>{filtered.length} thẻ</span></h3>
 {filtered.map((item,i)=>{
  const example=item.examples[0];
  return <div className={`fcm__table-row ${item.id===word.id?"is-active":""}`} key={item.id}>
   <button type="button" className="lesson-flash-row" aria-current={item.id===word.id ? "true" : undefined} onClick={()=>change(item.id)}>
    <span className="fcm__td-index" aria-hidden="true">{i+1}</span>
    <span className="fcm__td-term">
     <strong lang="zh">{item.word}</strong>
     {item.pinyin && <small>{item.pinyin}</small>}
    </span>
    <span className="fcm__td-def">
     <strong>{item.meaning || "Chưa có nghĩa"}</strong>
     {example && <span className="lesson-flash-example">
      <span lang="zh">{example.cn}</span>
      {example.pinyin && <small>{example.pinyin}</small>}
      {example.vi && <small>{example.vi}</small>}
     </span>}
    </span>
   </button>
   <button type="button" className="fcm__td-audio-btn" aria-label={`Nghe ${item.word}`} onClick={()=>speak(item.word,item.audio)}><img src="/assets/hocba/fc-speaker.svg" alt=""/></button>
  </div>;
 })}
</section></>:<div className="vlm__cards">
  {filtered.map(item=><article className="vlm__card" key={item.id}>
   <div className="vlm__card-head">
    <div className="vlm__term">
     <div className="vlm__word-row">
      <h3 className="vlm__hanzi" lang="zh">{item.word}</h3>
      <button type="button" className="vlm__speaker" aria-label={`Nghe ${item.word}`} onClick={()=>speak(item.word,item.audio)}><img src="/assets/hocba/fc-speaker.svg" alt=""/></button>
     </div>
     {(item.pinyin || item.pos) && <div className="vlm__meta">
      {item.pinyin && <span>{item.pinyin}</span>}
      {item.pos && <span className="vlm__pos">{item.pos}</span>}
     </div>}
     <p className="vlm__meaning">{item.meaning || "Chưa có dữ liệu nghĩa"}</p>
    </div>
    <div className="vlm__actions">
     <span className={`vlm__mark ${learned(item)?"is-done":""}`}>{learned(item) ? "Đã thuộc" : item.progressKnown ? "Chưa thuộc" : "Chưa có tiến độ"}</span>
     <button type="button" className="vlm__detail" aria-label={`Chi tiết ${item.word}`} onClick={()=>setDetail(item)}>Chi tiết <i className="fa-solid fa-chevron-right" aria-hidden="true" /></button>
    </div>
    {item.image && <img key={item.image} className="vlm__thumb" src={item.image} alt="" loading="lazy" onError={event=>{event.currentTarget.hidden=true;}} />}
   </div>
   <VocabularyExamples examples={item.examples} />
  </article>)}
 </div>}
 {detail && <Modal open centered footer={null} title={<span lang="zh">{detail.word}</span>} onCancel={()=>setDetail(null)}>
  <div className="vlm vlm--detail">
   {(detail.pinyin || detail.pos) && <div className="vlm__meta">{detail.pinyin && <span>{detail.pinyin}</span>}{detail.pos && <span className="vlm__pos">{detail.pos}</span>}</div>}
   <p className="vlm__meaning">{detail.meaning || "Chưa có dữ liệu nghĩa"}</p>
   <VocabularyExamples examples={detail.examples} />
  </div>
 </Modal>}
 </div>;
}

function VocabularyExamples({ examples }: { examples: Word["examples"] }) {
 if (!examples.length) return null;
 return <div className="vlm__examples">
  <h4>Ví dụ</h4>
  {examples.map((example,index)=><div className="vlm__example" key={index}>
   <div>
    <p lang="zh">{example.cn}</p>
    {example.pinyin && <p className="vlm__example-pinyin">{example.pinyin}</p>}
    {example.vi && <p>{example.vi}</p>}
   </div>
   <button type="button" className="vlm__speaker" aria-label="Nghe câu ví dụ" onClick={()=>speak(example.cn)}><img src="/assets/hocba/fc-speaker.svg" alt=""/></button>
  </div>)}
 </div>;
}
