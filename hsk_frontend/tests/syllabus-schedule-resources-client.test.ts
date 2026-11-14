import {beforeEach,expect,it,vi} from "vitest";
const api=vi.hoisted(()=>({get:vi.fn()}));
vi.mock("@/lib/api/lms-client",()=>({lmsClient:api}));
vi.mock("@/lib/api/write-gate",()=>({assertWriteEnabled:vi.fn()}));
import {listScheduleResources} from "@/lib/api/syllabus-schedule-resources-client";
beforeEach(()=>vi.resetAllMocks());
it("does not let a new empty package hide the existing HSK draft, across pages",async()=>{
 api.get.mockImplementation(async(url:string)=>{
  if(url.includes("/content-packages?"))return url.includes("page=0")?{items:[{id:"empty",draftVersionId:"empty-draft"}],total_pages:2}:{items:[{id:"existing",draftVersionId:"hsk-draft",publishedVersionId:"old-published"}],total_pages:2};
  if(url.includes("empty-draft"))return [];
  if(url.includes("hsk-draft"))return [{id:"reading-link",sessionNo:1,resourceType:"ASSESSMENT",assessmentType:"QUIZ",resourceContent:{title:"test",layout:{meta:{skill:"READING"}},questions:[{questionId:"q1"}]}}];
  throw Error("Unexpected endpoint: "+url);
 });
 const rows=await listScheduleResources("GT2","ASSESSMENT",1);
 expect(rows).toHaveLength(1);
 expect(rows[0]).toMatchObject({id:"reading-link",publication:"DRAFT",contentPackageVersionId:"hsk-draft",resourceContent:{layout:{meta:{skill:"READING"}}}});
 expect(api.get.mock.calls.every(([url])=>url.includes("syllabusId=GT2")||url.endsWith("sessionNo=1"))).toBe(true);
 expect(api.get.mock.calls.some(([url])=>url.includes("old-published"))).toBe(false);
});
it("reads published packages when no draft exists and skips packages without a version",async()=>{
 api.get.mockImplementation(async(url:string)=>url.includes("/content-packages?")?{items:[{id:"no-version"},{id:"live",publishedVersionId:"published"}],total_pages:1}:[{id:"listen",sessionNo:2}]);
 expect(await listScheduleResources("GT2","ASSESSMENT",2)).toEqual([{id:"listen",sessionNo:2,contentPackageVersionId:"published",publication:"PUBLISHED"}]);
 expect(api.get).toHaveBeenCalledTimes(2);
});
