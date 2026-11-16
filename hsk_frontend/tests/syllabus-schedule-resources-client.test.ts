import {beforeEach,expect,it,vi} from "vitest";
const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}));
vi.mock("@/lib/api/lms-client",()=>({lmsClient:api}));
vi.mock("@/lib/api/write-gate",()=>({assertWriteEnabled:vi.fn()}));
import {attachLibraryItemsToSchedule,createScheduleTopic,listScheduleResources} from "@/lib/api/syllabus-schedule-resources-client";
beforeEach(()=>vi.resetAllMocks());
it("does not let a new empty package hide the existing HSK draft, across pages",async()=>{
 api.get.mockImplementation(async(url:string)=>{
  if(url.includes("/content-packages?"))return url.includes("page=0")?{items:[{id:"empty",draftVersionId:"empty-draft"}],total_pages:2}:{items:[{id:"existing",draftVersionId:"hsk-draft",publishedVersionId:"old-published"}],total_pages:2};
  if(url.includes("empty-draft"))return [];
  if(url.includes("hsk-draft"))return [{id:"reading-link",sessionNo:1,resourceType:"ASSESSMENT",subType:"QUIZ",resourceContent:{title:"test",layout:{meta:{skill:"READING"}},questions:[{questionId:"q1"}]}}];
  throw Error("Unexpected endpoint: "+url);
 });
 const rows=await listScheduleResources("GT2","ASSESSMENT",1);
 expect(rows).toHaveLength(1);
 expect(rows[0]).toMatchObject({id:"reading-link",publication:"DRAFT",contentPackageVersionId:"hsk-draft",resourceContent:{layout:{meta:{skill:"READING"}}}});
 expect(api.get.mock.calls.every(([url])=>url.includes("syllabusId=GT2")||url.endsWith("sessionNo=1"))).toBe(true);
 expect(api.get.mock.calls.some(([url])=>url.includes("old-published"))).toBe(false);
});
const emptyPackageApi=(versions:{id:string;status?:string}[])=>{
 api.get.mockImplementation(async(url:string)=>{
  if(url.includes("/content-packages?"))return {items:[],total_pages:1};
  if(url.endsWith("/syllabuses/GT2/versions"))return versions;
  if(url.endsWith("/content-packages/new"))return {id:"new",draftVersionId:"draft"};
  throw Error("Unexpected endpoint: "+url);
 });
 api.post.mockImplementation(async(url:string)=>url==="/content-packages"?{id:"new",draftVersionId:"draft"}:{id:"topic",sessionNo:1,title:"T",topicOrder:0});
};
it("creates the syllabus package with the syllabus' real published version, never a made-up one",async()=>{
 emptyPackageApi([{id:"v-draft",status:"DRAFT"},{id:"v-published",status:"PUBLISHED"}]);
 await createScheduleTopic("GT2","ASSESSMENT",1,"T",false);
 const create=api.post.mock.calls.find(([url])=>url==="/content-packages");
 expect(create?.[1]).toMatchObject({type:"ASSESSMENT",syllabusId:"GT2",syllabusVersionId:"v-published"});
 expect(JSON.stringify(create?.[1])).not.toContain("-v1");
});
it("falls back to the first version when none is published, and refuses to create a package for a syllabus without versions",async()=>{
 emptyPackageApi([{id:"v-first",status:"DRAFT"}]);
 await createScheduleTopic("GT2","ASSESSMENT",1,"T",false);
 expect(api.post.mock.calls.find(([url])=>url==="/content-packages")?.[1]).toMatchObject({syllabusVersionId:"v-first"});
 api.post.mockClear();
 emptyPackageApi([]);
 await expect(createScheduleTopic("GT2","ASSESSMENT",1,"T",false)).rejects.toThrow("chưa có phiên bản");
 expect(api.post.mock.calls.some(([url])=>url==="/content-packages")).toBe(false);
});
const attachApi=(source:Record<string,unknown>)=>{
 api.get.mockImplementation(async(url:string)=>{
  if(url==="/learning-resources/picked")return {id:"picked",type:"VOCABULARY",content:{word:"你"},...source};
  if(url.startsWith("/content-packages?"))return {items:[{id:"pkg",draftVersionId:"d"}],total_pages:1};
  if(url==="/content-packages/pkg")return {id:"pkg",draftVersionId:"d"};
  if(url.endsWith("/versions/d/resources?sessionNo=1"))return [];
  throw Error("Unexpected GET "+url);
 });
 api.post.mockImplementation(async(url:string)=>url==="/learning-resources"?{id:"copy",publishedVersionId:"v1"}:{});
};
it("copies a picked item with the ORIGINAL as its source: a copy of a Kho item that is itself a copy points on to the dictionary",async()=>{
 attachApi({sourceResourceId:"dictionary-word"});
 const result=await attachLibraryItemsToSchedule("GT2","VOCABULARY",1,[{id:"picked",label:"你"}],false);
 expect(result).toEqual({added:1,failed:[]});
 expect(api.post.mock.calls.find(([url])=>url==="/learning-resources")?.[1]).toMatchObject({type:"VOCABULARY",inLibrary:false,sourceResourceId:"dictionary-word"});
});
it("an item without a source of its own (grammar, quiz, material written in the Kho package) is the source itself",async()=>{
 attachApi({sourceResourceId:null});
 await attachLibraryItemsToSchedule("GT2","VOCABULARY",1,[{id:"picked",label:"你"}],false);
 expect(api.post.mock.calls.find(([url])=>url==="/learning-resources")?.[1]).toMatchObject({inLibrary:false,sourceResourceId:"picked"});
 attachApi({});
 api.post.mockClear();
 await attachLibraryItemsToSchedule("GT2","VOCABULARY",1,[{id:"picked",label:"你"}],false);
 expect(api.post.mock.calls.find(([url])=>url==="/learning-resources")?.[1]).toMatchObject({sourceResourceId:"picked"});
});
it("reads published packages when no draft exists and skips packages without a version",async()=>{
 api.get.mockImplementation(async(url:string)=>url.includes("/content-packages?")?{items:[{id:"no-version"},{id:"live",publishedVersionId:"published"}],total_pages:1}:[{id:"listen",sessionNo:2}]);
 expect(await listScheduleResources("GT2","ASSESSMENT",2)).toEqual([{id:"listen",sessionNo:2,contentPackageVersionId:"published",publication:"PUBLISHED"}]);
 expect(api.get).toHaveBeenCalledTimes(2);
});
