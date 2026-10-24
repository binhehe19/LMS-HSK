import {assessmentSkill} from "./assessment-skill";
import type {LessonActivity} from "./lesson-navigation";
import type {TimetableAttempt,TimetableModule} from "./timetable-data";

export function sessionStudySummary(modules:TimetableModule[],attempts:TimetableAttempt[]) {
 const assessments=[...new Map(modules.filter(m=>m.resourceType === "ASSESSMENT" && m.resourceId).map(m=>[m.resourceId!,m])).values()];
 const progress=assessments.length && assessments.every(m=>typeof m.progress === "number")?Math.round(assessments.reduce((sum,m)=>sum+(m.progress ?? 0),0)/assessments.length):null;
 const submitted=attempts.filter(a=>a.status === "SUBMITTED");
 // Histories arrive newest first. A newer in-progress retry must not replace a
 // submitted result, and one exercise contributes its score only once.
 const latest=new Map<string,TimetableAttempt>();
 for(const attempt of submitted){const previous=latest.get(attempt.moduleId);if(!previous || (attempt.submittedAt && previous.submittedAt && attempt.submittedAt>previous.submittedAt))latest.set(attempt.moduleId,attempt);}
 const latestSubmitted=[...latest.values()];
 const graded=latestSubmitted.filter(a=>a.gradingStatus === "GRADED" && typeof a.earnedPoints === "number" && Number.isFinite(a.earnedPoints) && typeof a.totalPoints === "number" && a.totalPoints>0);
 const pending=latestSubmitted.some(a=>a.gradingStatus !== "GRADED");
 const score=graded.length?{earned:graded.reduce((sum,a)=>sum+a.earnedPoints!,0),total:graded.reduce((sum,a)=>sum+a.totalPoints!,0)}:null;
 return {progress,remaining:assessments.filter(m=>(m.progress ?? 0)<100).length,submitted,score,pending};
}

export function nextStudyActivity(modules:TimetableModule[]):LessonActivity {
 const kinds:Record<string,LessonActivity>={LISTENING:"listening",READING:"reading",WRITING:"writing",SPEAKING:"speaking",PRONUNCIATION:"speaking"};
 const exercises=modules.filter(m=>m.resourceId && kinds[assessmentSkill(m)]);
 const next=exercises.find(m=>(m.progress ?? 0)<100) ?? exercises[0];
 return next?kinds[assessmentSkill(next)]:"slides";
}
