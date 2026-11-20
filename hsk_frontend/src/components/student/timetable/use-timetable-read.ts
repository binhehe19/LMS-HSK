"use client";
import {useCallback,useEffect,useState} from "react";
import {timetableReadCache as cache} from "./timetable-read-cache";
export function useTimetableRead<T>(key:string|null,load:()=>Promise<T>,ttl:number){
 const [state,setState]=useState<{key:string|null;data:T|null;loading:boolean;error:string|null}>(()=>({key,data:key?cache.peek<T>(key):null,loading:!!key && !cache.peek<T>(key),error:null}));
 useEffect(()=>{
  if(!key)return;let active=true;let generation=0;let pending=false;
  const refresh=()=>{const current=++generation;const existing=cache.peek<T>(key);setState({key,data:existing,loading:existing===null,error:null});
   void cache.read(key,load,ttl).then(data=>{if(active && current===generation)setState({key,data,loading:false,error:null});},error=>{if(active && current===generation)setState({key,data:cache.peek<T>(key),loading:false,error:error instanceof Error?error.message:"Không tải được dữ liệu."});});};
  const onVisible=()=>{if(pending && document.visibilityState!=="hidden"){pending=false;refresh();}};
  const unsubscribe=cache.subscribe(key,()=>{pending=true;onVisible();});
  refresh();document.addEventListener("visibilitychange",onVisible);
  return ()=>{active=false;unsubscribe();document.removeEventListener("visibilitychange",onVisible);};
 },[key,load,ttl]);
 const reload=useCallback(()=>{if(key)cache.invalidate(key);},[key]);
 if(state.key!==key){const data=key?cache.peek<T>(key):null;return {data,loading:!!key && data===null,error:null,reload};}
 return {...state,reload};
}
// Mounted by the authenticated student provider so invalidation also happens
// while the timetable itself is not mounted (e.g. after submitting a lesson).
export function useTimetableCacheEvents(userId:string|undefined){
 useEffect(()=>{
  if(!userId){cache.clear();return;}
  const channel=typeof BroadcastChannel!=="undefined"?new BroadcastChannel("hsk-timetable-invalidation"):null;
  const owner=encodeURIComponent(userId);
  const invalidateProgress=()=>cache.invalidate(key=>key.startsWith(`${owner}:student:timetable:`) || key.startsWith(`${owner}:student:session:`));
  const changed=()=>{invalidateProgress();channel?.postMessage({type:"invalidate",userId});};
  if(channel)channel.onmessage=event=>{if(event.data?.type==="invalidate" && event.data?.userId===userId)invalidateProgress();};
  window.addEventListener("hsk:lesson-submitted",changed);window.addEventListener("hsk:vocabulary-updated",changed);
  return ()=>{cache.clear();channel?.close();window.removeEventListener("hsk:lesson-submitted",changed);window.removeEventListener("hsk:vocabulary-updated",changed);};
 },[userId]);
}
