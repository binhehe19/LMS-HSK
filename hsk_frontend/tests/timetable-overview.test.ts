import {describe,it,expect} from "vitest";
import {timetableOverview,classSchedule,visibleTimetableSessions} from "@/components/student/timetable/timetable-overview";
import {classSession} from "@/components/student/timetable/timetable-source";
import type {TimetableClass} from "@/components/student/timetable/timetable-source";
const courses:TimetableClass[]=[{id:"a",code:"GT1",startDate:"2026-09-01",teacher:{fullName:"Cô A"},totalSessions:20,completedSessions:3,personalProgress:10,averageScore:21,homeworkDiligence:9,schedulePatterns:[{dayOfWeek:"MONDAY",startTime:"08:00:00",endTime:"10:00:00"}],myAttendanceSummary:{totalRecorded:4,attendanceRate:75},sessions:[{id:"a1",classId:"a",startAt:"2026-11-01T08:00:00",endAt:"2026-11-01T10:00:00",status:"DONE"}]},{id:"b",code:"GT2",teacher:{fullName:"Thầy B"},totalSessions:8,completedSessions:2,personalProgress:60,averageScore:80,homeworkDiligence:50,myAttendanceSummary:{totalRecorded:2,attendanceRate:100},sessions:[]}];
describe("learner timetable overview",()=>{
 it("does not mix metrics from multiple enrolled classes in ALL",()=>{const result=timetableOverview(courses,"ALL");expect(result.course?.id).toBe("a");expect(result.total).toBe(20);expect(result.done).toBe(3);expect(result.percent).toBe(15);expect(result.progress).toBe(10);expect(result.attendanceRate).toBe(75);expect(result.schedule).toBe("T2 | 08:00 - 10:00");expect(result.start).toBe("2026-09-01");});
 it("selects all hero fields from the requested class including classes with no sessions",()=>{const result=timetableOverview(courses,"b");expect(result.course?.teacher?.fullName).toBe("Thầy B");expect(result.progress).toBe(60);expect(result.averageScore).toBe(80);expect(result.diligence).toBe(50);expect(result.attendanceRate).toBe(100);expect(result.total).toBe(8);expect(result.schedule).toBe("Chưa xếp lịch");});
 it("does not fall back to another class for an unauthorized or stale class query",()=>{const result=timetableOverview(courses,"not-mine");expect(result.course).toBeUndefined();expect(result.progress).toBeNull();expect(result.attendanceRate).toBeNull();});
 it("counts LATE attendance and excludes cancelled sessions without declaring past dates completed",()=>{const result=timetableOverview([{id:"c",sessions:[{id:"1",classId:"c",myAttendanceStatus:"LATE",status:"DONE"},{id:"2",classId:"c",myAttendanceStatus:"ABSENT",status:"UPCOMING",startAt:"2020-01-01"},{id:"3",classId:"c",status:"CANCELLED",myAttendanceStatus:"PRESENT"}]}],"c");expect(result.attendanceRate).toBe(50);expect(result.done).toBe(1);expect(result.total).toBe(2);});
 it("derives schedule only from this class when recurring patterns are unavailable",()=>{expect(classSchedule(courses[0])).toContain("08:00 - 10:00");expect(classSchedule({id:"c",sessions:[{id:"s",classId:"c",startAt:"2026-11-02T18:00:00",endAt:"2026-11-02T19:30:00"}]})).toBe("T2 | 18:00 - 19:30");});
 it("groups mobile weekdays with the same hours and keeps different time slots separate",()=>{
  const course: TimetableClass={id:"a",schedulePatterns:[
   {dayOfWeek:"MONDAY",startTime:"20:00:00",endTime:"21:15:00"},
   {dayOfWeek:"WEDNESDAY",startTime:"20:00:00",endTime:"21:15:00"},
   {dayOfWeek:"FRIDAY",startTime:"18:00:00",endTime:"19:15:00"},
  ]};
  expect(classSchedule(course,true)).toBe("T2, T4 · 20:00–21:15 / T6 · 18:00–19:15");
  expect(classSchedule(courses[1],true)).toBe("");
 });
 it("switches month/all scope without showing undated entries in every month",()=>{const course={id:"c"};const rows=[classSession(course,{id:"nov",classId:"c",startAt:"2026-11-01T08:00:00"}),classSession(course,{id:"dec",classId:"c",startAt:"2026-12-01T08:00:00"}),classSession(course,{id:"undated",classId:"c"})];expect(visibleTimetableSessions(rows,"2026-11",false).map(s=>s.id)).toEqual(["nov"]);expect(visibleTimetableSessions(rows,"2026-12",false).map(s=>s.id)).toEqual(["dec"]);expect(visibleTimetableSessions(rows,"2026-11",true)).toHaveLength(3);});
});

it("keeps the chosen class in both month and whole-course scopes",()=>{
 const rows=[classSession({id:"a"},{id:"a-nov",classId:"a",startAt:"2026-11-01T08:00:00"}),classSession({id:"a"},{id:"a-dec",classId:"a",startAt:"2026-12-01T08:00:00"}),classSession({id:"b"},{id:"b-nov",classId:"b",startAt:"2026-11-01T08:00:00"})];
 expect(visibleTimetableSessions(rows,"2026-11",false,"a").map(s=>s.id)).toEqual(["a-nov"]);
 expect(visibleTimetableSessions(rows,"2026-11",true,"a").map(s=>s.id)).toEqual(["a-nov","a-dec"]);
 expect(visibleTimetableSessions(rows,"2026-11",false,"b").map(s=>s.id)).toEqual(["b-nov"]);
 expect(visibleTimetableSessions(rows,"2026-12",false,"a").map(s=>s.id)).toEqual(["a-dec"]);
 expect(visibleTimetableSessions(rows,"2026-11",true,"ALL")).toHaveLength(3);
});

it("limits recruitment-closed classes to session numbers 1 and 2 even in a mixed class list",()=>{
 const closed={id:"closed",lifecycleStatus:"RECRUITMENT_CLOSED"};
 const started={id:"started",lifecycleStatus:"IN_PROGRESS"};
 const rows=[3,1,2].flatMap(sessionNo=>[closed,started].map(course=>classSession(course,{
  id:`${course.id}-${sessionNo}`,classId:course.id,sessionNo,startAt:`2026-11-0${sessionNo}T08:00:00`,
 })));
 expect(visibleTimetableSessions(rows,"2026-11",true,"closed",[closed,started]).map(s=>s.sessionNo)).toEqual([1,2]);
 expect(visibleTimetableSessions(rows,"2026-11",true,"started",[closed,started])).toHaveLength(3);
 expect(visibleTimetableSessions(rows,"2026-11",false,"ALL",[closed,started])).toHaveLength(5);
});
