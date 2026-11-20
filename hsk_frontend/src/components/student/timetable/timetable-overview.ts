import dayjs from "dayjs";
import type { TimetableClass } from "./timetable-source";
import type { TimetableSession } from "./timetable-data";

const days: Record<string,string> = {MONDAY:"T2",TUESDAY:"T3",WEDNESDAY:"T4",THURSDAY:"T5",FRIDAY:"T6",SATURDAY:"T7",SUNDAY:"CN"};
export function classSchedule(course?: TimetableClass): string {
 const patterns=course?.schedulePatterns ?? [];
 if(patterns.length)return patterns.map(p=>`${days[p.dayOfWeek.toUpperCase()] ?? p.dayOfWeek} | ${p.startTime.slice(0,5)} - ${p.endTime.slice(0,5)}`).join(" · ");
 const slots=[...new Set((course?.sessions ?? []).filter(s=>s.status!=="CANCELLED" && s.startAt && s.endAt).map(s=>{
  const start=dayjs(s.startAt),end=dayjs(s.endAt);
  return start.isValid() && end.isValid()?`${["CN","T2","T3","T4","T5","T6","T7"][start.day()]} | ${start.format("HH:mm")} - ${end.format("HH:mm")}`:"";
 }).filter(Boolean))];
 return slots.join(" · ") || "Chưa xếp lịch";
}
// One class owns every hero metric. The ALL list may span classes; never average
// class percentages or combine the first teacher with another class's schedule.
export function timetableOverview(classes: TimetableClass[], classId: string) {
 const course=classId === "ALL"?classes[0]:classes.find(c=>c.id===classId);
 const sessions=(course?.sessions ?? []).filter(s=>s.status!=="CANCELLED");
 const dates=sessions.map(s=>s.endAt || s.startAt).filter((date):date is string=>!!date && dayjs(date).isValid()).sort((a,b)=>dayjs(a).valueOf()-dayjs(b).valueOf());
 const total=course?.totalSessions ?? sessions.length;
 const done=course?.completedSessions ?? sessions.filter(s=>["DONE","COMPLETED"].includes(s.status ?? "")).length;
 const records=sessions.filter(s=>s.myAttendanceStatus);
 const attendance=course?.myAttendanceSummary;
 const attendanceRate=attendance?attendance.attendanceRate:records.length?Math.round(records.filter(s=>["PRESENT","LATE"].includes(s.myAttendanceStatus!)).length/records.length*1000)/10:null;
 return {course,total,done,percent:total?Math.round(done/total*1000)/10:null,start:course?.startDate || sessions.map(s=>s.startAt).filter((d):d is string=>!!d && dayjs(d).isValid()).sort()[0],end:dates.at(-1),schedule:classSchedule(course),attendanceRate,progress:course?.personalProgress ?? null,averageScore:course?.averageScore ?? null,diligence:course?.homeworkDiligence ?? null};
}
export function visibleTimetableSessions(sessions:TimetableSession[],month:string,wholeCourse:boolean,classId="ALL") {
 return sessions.filter(s=>(classId==="ALL" || s.classId===classId) && (wholeCourse || (!!s.date && dayjs(s.date).format("YYYY-MM")===month))).sort((a,b)=>(a.date+a.startTime).localeCompare(b.date+b.startTime));
}
