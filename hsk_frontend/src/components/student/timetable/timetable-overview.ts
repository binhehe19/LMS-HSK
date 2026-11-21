import dayjs from "dayjs";
import type { TimetableClass } from "./timetable-source";
import type { TimetableSession } from "./timetable-data";

const days: Record<string,string> = {MONDAY:"T2",TUESDAY:"T3",WEDNESDAY:"T4",THURSDAY:"T5",FRIDAY:"T6",SATURDAY:"T7",SUNDAY:"CN"};
export function classSchedule(course?: TimetableClass, compact = false): string {
 const patterns=course?.schedulePatterns ?? [];
 const slots=patterns.length ? patterns.map(pattern=>({
  day:days[pattern.dayOfWeek.toUpperCase()] ?? pattern.dayOfWeek,
  start:pattern.startTime.slice(0,5),
  end:pattern.endTime.slice(0,5),
 })) : (course?.sessions ?? []).flatMap(session=>{
  if(session.status==="CANCELLED" || !session.startAt || !session.endAt)return [];
  const start=dayjs(session.startAt),end=dayjs(session.endAt);
  if(!start.isValid() || !end.isValid())return [];
  return [{day:["CN","T2","T3","T4","T5","T6","T7"][start.day()],start:start.format("HH:mm"),end:end.format("HH:mm")}];
 });
 if(!slots.length)return compact ? "" : "Chưa xếp lịch";
 if(!compact){
  const labels=slots.map(slot=>`${slot.day} | ${slot.start} - ${slot.end}`);
  return (patterns.length ? labels : [...new Set(labels)]).join(" · ");
 }
 const daysByTime=new Map<string, Set<string>>();
 for(const slot of slots){
  const time=`${slot.start}–${slot.end}`;
  const weekdays=daysByTime.get(time) ?? new Set<string>();
  weekdays.add(slot.day);
  daysByTime.set(time,weekdays);
 }
 return Array.from(daysByTime,([time,weekdays])=>`${[...weekdays].join(", ")} · ${time}`).join(" / ");
}
// One class owns every hero metric. The ALL list may span classes; never average
// class percentages or combine the first teacher with another class's schedule.
export function timetableOverview(classes: TimetableClass[], classId: string) {
 const course=classes.find(c=>c.id===classId);
 const sessions=(course?.sessions ?? []).filter(s=>s.status!=="CANCELLED");
 const dates=sessions.map(s=>s.endAt || s.startAt).filter((date):date is string=>!!date && dayjs(date).isValid()).sort((a,b)=>dayjs(a).valueOf()-dayjs(b).valueOf());
 const total=course?.totalSessions ?? sessions.length;
 const done=course?.completedSessions ?? sessions.filter(s=>["DONE","COMPLETED"].includes(s.status ?? "")).length;
 const records=sessions.filter(s=>s.myAttendanceStatus);
 const attendance=course?.myAttendanceSummary;
 const attendanceRate=attendance?attendance.attendanceRate:records.length?Math.round(records.filter(s=>["PRESENT","LATE"].includes(s.myAttendanceStatus!)).length/records.length*1000)/10:null;
 return {course,total,done,percent:total?Math.round(done/total*1000)/10:null,start:course?.startDate || sessions.map(s=>s.startAt).filter((d):d is string=>!!d && dayjs(d).isValid()).sort()[0],end:dates.at(-1),schedule:classSchedule(course),attendanceRate,progress:course?.personalProgress ?? null,averageScore:course?.averageScore ?? null,diligence:course?.homeworkDiligence ?? null};
}
export function visibleTimetableSessions(sessions:TimetableSession[],month:string,wholeCourse:boolean,classId="ALL",classes:TimetableClass[]=[]) {
 const closedClasses=new Set(classes.filter(course=>course.lifecycleStatus==="RECRUITMENT_CLOSED").map(course=>course.id));
 return sessions.filter(s=>(classId==="ALL" || s.classId===classId)
  && (!closedClasses.has(s.classId) || (s.sessionNo>=1 && s.sessionNo<=2))
  && (wholeCourse || (!!s.date && dayjs(s.date).format("YYYY-MM")===month))).sort((a,b)=>(a.date+a.startTime).localeCompare(b.date+b.startTime));
}
