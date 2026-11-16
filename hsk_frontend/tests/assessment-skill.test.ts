import {it,expect} from "vitest";
import {assessmentSkill} from "@/components/student/timetable/assessment-skill";
import {activityResources,unclassifiedAssessments} from "@/components/student/timetable/lesson-source";
import {publishedModules} from "@/components/student/timetable/timetable-source";
it("prioritizes JSON skill and supports legacy types",()=>{
 expect(assessmentSkill({subType:"PRACTICE_READING",content:{layout:{meta:{skill:" listening "}}}})).toBe("LISTENING");
 expect(assessmentSkill({subType:"PRACTICE_WRITING"})).toBe("WRITING");
 expect(assessmentSkill({subType:"QUIZ"})).toBe("QUIZ");
});
it("carries topic title and order from the published session resources",()=>{
 const modules=publishedModules({vocabulary:{freeResources:[{id:"v1",resourceType:"VOCABULARY",topicId:"t1",topicTitle:"Gia đình",topicOrder:1,resourceContent:null},{id:"v2",resourceType:"VOCABULARY",resourceContent:null}]}});
 expect(modules.map(m=>[m.id,m.topicTitle,m.topicOrder])).toEqual([["v1","Gia đình",1],["v2",undefined,undefined]]);
});
it("routes withheld questions using safe metadata without changing assessment type",()=>{
 const modules=publishedModules({quiz:{freeResources:[{id:"a",subType:"QUIZ",skill:"LISTENING",resourceContent:null},{id:"b",subType:"PRACTICE_READING",resourceContent:null},{id:"c",subType:"QUIZ",resourceContent:null}]}});
 expect(activityResources(modules,"listening").map(m=>m.id)).toEqual(["a"]);
 expect(activityResources(modules,"reading").map(m=>m.id)).toEqual(["b"]);
 expect(activityResources(modules,"writing")).toEqual([]);
 expect(modules[0].subType).toBe("QUIZ");
 expect(unclassifiedAssessments(modules.map(m=>({...m,resourceType:"ASSESSMENT"}))).map(m=>m.id)).toEqual(["c"]);
});
