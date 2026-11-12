"use client";
import { useEffect, useRef, useState } from "react";
import type { init } from "pptx-preview";
import { getAccessToken } from "@/lib/auth/token-store";
export default function LessonPptx({url}:{url:string}){
 const target=useRef<HTMLDivElement>(null);const viewer=useRef<ReturnType<typeof init>|null>(null);const wrapper=useRef<HTMLDivElement>(null);const [scale,setScale]=useState(1);const [status,setStatus]=useState("Đang tải slide…");const [page,setPage]=useState(0);const [total,setTotal]=useState(0);
 useEffect(()=>{const element=wrapper.current;if(!element)return;const observer=new ResizeObserver(entries=>setScale(entries[0].contentRect.width/960));observer.observe(element);return ()=>observer.disconnect();},[]);
 useEffect(()=>{const element=target.current;if(!element)return;let disposed=false;const controller=new AbortController();
  const load=async()=>{try{
   const resolved=new URL(url,window.location.href);const storageBase=process.env.NEXT_PUBLIC_STORAGE_API_BASE_PATH;const storage=storageBase?new URL(storageBase,window.location.href):null;const trusted=storage && resolved.origin===storage.origin && resolved.pathname.startsWith(storage.pathname.replace(/\/$/,"")+"/file/");const token=trusted?getAccessToken():null;
   const [library,response]=await Promise.all([import("pptx-preview"),fetch(url,{signal:controller.signal,credentials:trusted || resolved.origin===window.location.origin?"include":"omit",headers:token?{Authorization:`Bearer ${token}`}:{}})]);
   if(!response.ok)throw Error("Không tải được tệp slide. Hãy kiểm tra quyền truy cập hoặc thử lại.");const bytes=await response.arrayBuffer();if(disposed)return;const instance=library.init(element,{width:960,height:540,mode:"slide"});viewer.current=instance;await instance.preview(bytes);if(disposed){instance.destroy();return;}setTotal(instance.slideCount);setPage(0);setStatus("");
  }catch(error){if(!disposed)setStatus(error instanceof Error?error.message:"Không đọc được tệp PPTX.");}};
  void load();return ()=>{disposed=true;controller.abort();viewer.current?.destroy();viewer.current=null;element.replaceChildren();};
 },[url]);
 const move=(direction:number)=>{const instance=viewer.current;if(!instance)return;if(direction>0)instance.renderNextSlide();else instance.renderPreSlide();setPage(instance.currentIndex);};
 return <div className="lesson-pptx" ref={wrapper}><div className="lesson-pptx-stage" style={{height:540*scale}}><div className="lesson-pptx-canvas" ref={target} style={{width:960,height:540,transform:`scale(${scale})`}}/>{status && <div className="lesson-pptx-status" role="status">{status}</div>}</div><div className="lesson-pptx-nav"><button type="button" aria-label="Slide trước" disabled={!total || page===0} onClick={()=>move(-1)}>‹</button><span>{total?`${page+1} / ${total}`:"Chưa có slide"}</span><button type="button" aria-label="Slide sau" disabled={!total || page>=total-1} onClick={()=>move(1)}>›</button></div></div>;
}
