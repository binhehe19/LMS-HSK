import {it,expect} from "vitest";
import {assessmentSkill} from "@/components/student/timetable/assessment-skill";
import {activityResources,unclassifiedAssessments} from "@/components/student/timetable/lesson-source";
import {publishedModules} from "@/components/student/timetable/timetable-source";
it("prioritizes JSON skill and supports legacy types",()=>{
 expect(assessmentSkill({assessmentType:"READING",content:{layout:{meta:{skill:" listening "}}}})).toBe("LISTENING");
 expect(assessmentSkill({assessmentType:"WRITING"})).toBe("WRITING");
 expect(assessmentSkill({assessmentType:"QUIZ"})).toBe("QUIZ");
});
it("routes withheld questions using safe metadata without changing assessment type",()=>{
 const modules=publishedModules({quiz:{freeResources:[{id:"a",assessmentType:"QUIZ",skill:"LISTENING",resourceContent:null},{id:"b",assessmentType:"READING",resourceContent:null},{id:"c",assessmentType:"QUIZ",resourceContent:null}]}});
 expect(activityResources(modules,"listening").map(m=>m.id)).toEqual(["a"]);
 expect(activityResources(modules,"reading").map(m=>m.id)).toEqual(["b"]);
 expect(activityResources(modules,"writing")).toEqual([]);
 expect(modules[0].assessmentType).toBe("QUIZ");
 expect(unclassifiedAssessments(modules.map(m=>({...m,resourceType:"ASSESSMENT"}))).map(m=>m.id)).toEqual(["c"]);
});
