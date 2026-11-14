// Read-only, memory-only cache. Writes always go to the server.
interface Entry {data?:unknown;updatedAt:number;promise?:Promise<unknown>;}
export class TimetableReadCache {
 private entries=new Map<string,Entry>();
 private listeners=new Map<string,Set<()=>void>>();
 peek<T>(key:string):T|null{return (this.entries.get(key)?.data as T | undefined) ?? null;}
 fresh(key:string,ttl:number){const e=this.entries.get(key);return !!e && e.updatedAt>0 && Date.now()-e.updatedAt<ttl;}
 subscribe(key:string,fn:()=>void){const set=this.listeners.get(key) ?? new Set();set.add(fn);this.listeners.set(key,set);return ()=>{set.delete(fn);if(!set.size)this.listeners.delete(key);};}
 invalidate(key?:string){for(const k of key?[key]:this.entries.keys()){const e=this.entries.get(k);if(e)this.entries.set(k,{data:e.data,updatedAt:0});for(const fn of this.listeners.get(k) ?? [])fn();}}
 clear(){this.entries.clear();}
 read<T>(key:string,load:()=>Promise<T>,ttl:number):Promise<T>{
  const old=this.entries.get(key);
  if(this.fresh(key,ttl))return Promise.resolve(old!.data as T);
  if(old?.promise)return old.promise as Promise<T>;
  const entry:Entry={data:old?.data,updatedAt:0};this.entries.set(key,entry);
  entry.promise=Promise.resolve().then(load).then(data=>{
   // An invalidation during a request means a server write may have happened.
   // Never publish the older response; join/start the current generation.
   if(this.entries.get(key)!==entry){if(!this.entries.has(key))throw Error("Phiên dữ liệu đã đóng.");return this.read(key,load,ttl);}
   entry.data=data;entry.updatedAt=Date.now();entry.promise=undefined;return data;
  },error=>{if(this.entries.get(key)!==entry){if(!this.entries.has(key))throw Error("Phiên dữ liệu đã đóng.");return this.read(key,load,ttl);}entry.promise=undefined;throw error;});
  return entry.promise as Promise<T>;
 }
}
export const timetableReadCache=new TimetableReadCache();
