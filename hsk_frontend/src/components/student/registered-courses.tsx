"use client";
import { useState, useCallback } from "react";
import dayjs from "dayjs";
import { studentApi, type StudentClass, type StudentSession } from "@/lib/api/student-client";
import { useStudentData, useStudentRequest, DataStatus } from "./student-data";
import { courseStats, safeMeetingUrl } from "./student-model";
import { fileUrl } from "@/lib/api/storage-client";
import NativeModal from "./native-modal";

function SessionContent({ course, session }: { course: StudentClass; session: StudentSession }) {
 const request = useCallback(() => studentApi.resources(course.syllabusId!, session.sessionNo!), [course.syllabusId, session.sessionNo]);
 const resources = useStudentRequest(request, !!course.syllabusId && session.sessionNo != null);
 if (!course.syllabusId || session.sessionNo == null) return <p>Buổi học chưa có liên kết giáo trình.</p>;
 const groups: Record<string, string> = { slide: "Slide", material: "Tài liệu", grammar: "Ngữ pháp", vocabulary: "Từ vựng", quiz: "Quick Test", grammarQuiz: "Bài tập ngữ pháp", vocabularyQuiz: "Bài tập từ vựng" };
 return <><DataStatus state={resources} />{resources.data && Object.entries(groups).map(([key,label]) => {
  const group = resources.data?.[key] as { freeResources?: { learningResourceId?: string; resourceContent?: { title?: string; fileName?: string; fileId?: string } }[] } | undefined;
  return <div key={key} className="border rounded-3 p-3 mb-2"><h4 className="h6">{label}</h4>{group?.freeResources?.length ? group.freeResources.map((item,index) => <p key={item.learningResourceId || index}>{item.resourceContent?.title || item.resourceContent?.fileName || `Nội dung ${index + 1}`}{fileUrl(item.resourceContent?.fileId) && <a className="ms-2" href={fileUrl(item.resourceContent?.fileId)!} target="_blank" rel="noopener noreferrer">Mở tài liệu</a>}</p>) : <p className="text-muted mb-0">Chưa có nội dung.</p>}</div>;
 })}</>;
}
function ClassDetail({ course }: { course: StudentClass }) {
 const [session, setSession] = useState<StudentSession | null>(null);
 const request = useCallback(() => studentApi.progress(course.id), [course.id]);
 const progress = useStudentRequest(request);
 const percent = progress.data?.personalProgress;
 return <>
  {course.detailError && <p role="alert" className="text-danger">{course.detailError}</p>}
  <h3 className="h6">Tiến độ bài tập</h3><DataStatus state={progress} />
  {progress.data && <p>Tiến độ cá nhân: {percent == null ? "Chưa có dữ liệu" : `${Math.round(percent)}%`} · Điểm trung bình: {progress.data.averageScore == null ? "Chưa có dữ liệu" : `${Math.round(progress.data.averageScore)}%`}</p>}
  {(course.sessions ?? []).map(item => {
   const url = safeMeetingUrl(item.meetingLink || course.meetingLink);
   const detail = progress.data?.sessions.find(row => row.sessionId === item.id);
   return <article key={item.id} className="border rounded-3 p-3 mb-3">
    <h3 className="h6">Buổi {item.sessionNo ?? "—"}: {item.topic || "Chưa có chủ đề"}</h3>
    <p>{item.startAt ? dayjs(item.startAt).format("DD/MM/YYYY HH:mm") : "Chưa xếp lịch"} · {item.status || "—"}</p>
    {item.content && <p style={{ whiteSpace: "pre-wrap" }}>{item.content}</p>}
    <p className="small">Ngữ pháp: {detail?.grammar?.percent == null ? "—" : `${Math.round(detail.grammar.percent)}%`} · Từ vựng: {detail?.vocabulary?.percent == null ? "—" : `${Math.round(detail.vocabulary.percent)}%`} · Quick Test: {detail?.quickTest?.percent == null ? "—" : `${Math.round(detail.quickTest.percent)}%`}</p>
    {url && <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-danger btn-sm me-2">Vào lớp</a>}
    <button className="btn btn-outline-danger btn-sm" onClick={() => setSession(session?.id === item.id ? null : item)}>Nội dung và tài liệu</button>
    {session?.id === item.id && <div className="mt-3"><SessionContent key={item.id} course={course} session={item} /></div>}
   </article>;
  })}
  {!course.detailError && !course.sessions?.length && <p>Chưa có buổi học.</p>}
 </>;
}
export default function RegisteredCourses() {
 const { classes } = useStudentData();
 const [selected, setSelected] = useState<StudentClass | null>(null);
 return <section className="hb-course__section">
  <h2 className="h5 mb-3">Lớp học đã đăng ký</h2><DataStatus state={classes} empty={classes.data?.length === 0} />
  <button className="btn btn-outline-danger btn-sm mb-3" onClick={classes.reload}>Tải lại</button>
  <div className="row g-3">{classes.data?.map(course => {
   const stats = courseStats(course);
   return <div className="col-md-6" key={course.id}><div className="premium-card border h-100">
    <h3 className="h6">{course.code || course.syllabusName || "Lớp học"}</h3><p>{course.educationLevelCode || course.syllabusName}</p>
    {course.detailError ? <p role="alert" className="text-danger">{course.detailError}</p> : <><p>{stats.completed}/{stats.total} buổi hoàn thành</p><div className="progress mb-3"><div className="progress-bar bg-danger" style={{ width: `${stats.percent}%` }} /></div></>}
    <button type="button" className="btn btn-danger btn-sm" onClick={() => setSelected(course)}>Chi tiết lớp học</button>
   </div></div>;
  })}</div>
  <NativeModal show={!!selected} onHide={() => setSelected(null)} title={selected?.code || "Chi tiết lớp học"}>{selected && <ClassDetail key={selected.id} course={selected} />}</NativeModal>
 </section>;
}
