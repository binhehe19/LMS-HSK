import {it,expect} from "vitest";
import {nextStudyActivity,sessionStudySummary} from "@/components/student/timetable/session-study-summary";
import type {TimetableModule,TimetableAttempt} from "@/components/student/timetable/timetable-data";
const exercise:TimetableModule={id:"link",resourceId:"quiz",resourceType:"ASSESSMENT",kind:"practice",title:"Đọc",icon:"doc",description:"",progress:100};
const attempt:TimetableAttempt={attemptId:"done",moduleId:"link",title:"Đọc",status:"SUBMITTED",gradingStatus:"GRADED",earnedPoints:0,totalPoints:20};
it("uses actual completion even with a zero score and retains submitted results during retry",()=>{const result=sessionStudySummary([exercise],[{...attempt,attemptId:"retry",status:"IN_PROGRESS"},attempt]);expect(result.progress).toBe(100);expect(result.score).toEqual({earned:0,total:20});expect(result.submitted.map(a=>a.attemptId)).toEqual(["done"]);});
it("does not fabricate progress when history is unavailable",()=>{expect(sessionStudySummary([{...exercise,progress:null}],[]).progress).toBeNull();});
it("counts one latest submitted result per exercise",()=>{const result=sessionStudySummary([exercise],[{...attempt,submittedAt:"2026-11-14T10:00:00"},{...attempt,attemptId:"old",earnedPoints:20,submittedAt:"2026-11-13T10:00:00"}]);expect(result.score).toEqual({earned:0,total:20});});

it("continues an attached incomplete skill rather than always opening listening",()=>{expect(nextStudyActivity([{...exercise,skill:"READING"},{...exercise,id:"write",resourceId:"write",skill:"WRITING",progress:0}])).toBe("writing");expect(nextStudyActivity([{...exercise,skill:"READING"}])).toBe("reading");expect(nextStudyActivity([])).toBe("slides");});
it("does not show a numeric result while grading is pending",()=>{const result=sessionStudySummary([exercise],[{...attempt,gradingStatus:"MANUAL_GRADING",earnedPoints:null,totalPoints:null}]);expect(result.pending).toBe(true);expect(result.score).toBeNull();expect(result.progress).toBe(100);});
