"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Modal } from "antd";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { nextStudyActivity, sessionStudySummary } from "./session-study-summary";
import {useTimetableRead} from "./use-timetable-read";
import TimetableToolbar from "./timetable-toolbar";
import { timetableOverview, visibleTimetableSessions } from "./timetable-overview";
import LessonActivityCards from "./lesson-activity-cards";
import { lessonHref, type LessonActivity } from "./lesson-navigation";
import StudentShell from "../dashboard/student-shell";
import { StudentContentState, StudentFetchError } from "../student-content-state";
import { useStudentIdentity } from "../student-data";
import { loadTimetable, loadTimetableClasses, loadSessionStudy } from "./timetable-source";
import { getSessionState, sessionProgress, type TimetableSession } from "./timetable-data";
import "./production-timetable.css";
import "./timetable.css";

const asset = (name: string) => `/assets/hocba/tkb-${name}`;
const weekDays = ["Chủ Nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const statusLabel = { today: "Hôm nay", done: "Đã học", upcoming: "Sắp tới", cancelled: "Đã hủy", unscheduled: "Chưa xếp lịch" };
function Icon({ name }: { name: string }) { return <i aria-hidden="true" className={`fa-solid fa-${name}`} />; }
function Ring({ value, size = 58, className = "tkb-hero-ring" }: { value: number | null; size?: number; className?: string }) {
 const percent = Math.min(100, Math.max(0, value ?? 0)); const radius = (size-6)/2; const length = 2*Math.PI*radius;
 return <div className={className} style={{ width: size, height: size }} aria-label={value === null ? "Chưa có dữ liệu" : `${percent}%`}>
  <svg width={size} height={size} aria-hidden="true"><circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="currentColor" opacity=".2" strokeWidth="5" /><circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${percent/100*length} ${length}`} transform={`rotate(-90 ${size/2} ${size/2})`} /></svg><span>{value === null ? "—" : `${percent}%`}</span>
 </div>;
}
function Status({ session }: { session: TimetableSession }) { const state=getSessionState(session); return <span className={`tkb-card__status tkb-card__status--${state}`}><span className="tkb-card__status-dot" />{statusLabel[state]}</span>; }
function Stat({ icon, title, value, score = false, circular = false }: { icon: string; title: string; value: number | null; score?: boolean; circular?: boolean }) {
 return <div className="tkb-glass-card__stat"><div className="tkb-glass-card__stat-head"><span className="tkb-glass-card__stat-icon"><img className="icon-default" src={asset(`stat-${icon}.svg`)} alt="" /><img className="icon-hover" src={asset(`stat-${icon}-red.svg`)} alt="" /></span><span>{title}</span></div><div className="tkb-glass-card__stat-body">{circular ? <div className="tkb-attendance"><Ring value={value} size={52} /><span>{value === null?"Chưa có dữ liệu":value>=100?"Đi học đầy đủ":"Chuyên cần của bạn"}</span></div> : <><div className="tkb-glass-card__stat-row"><span>{value === null ? "Chưa có dữ liệu" : value >= 80 ? "Bạn làm rất tốt!" : "Cố gắng thêm nhé!"}</span><strong>{value ?? "—"}{value !== null && (score ? <em>/100</em> : "%")}</strong></div><div className="tkb-glass-card__stat-bar"><div style={{ width: `${value ?? 0}%` }} /></div></>}</div></div>;
}
export default function StudentTimetable() {
 const {user}=useStudentIdentity();
 return <TimetableContent key={`${user?.id ?? "anonymous"}:${user?.roles.join(",") ?? ""}`} />;
}
function TimetableContent() {
 const router=useRouter(); const pathname=usePathname(); const params=useSearchParams(); const identity=useStudentIdentity();
 const owner=identity.user?`${encodeURIComponent(identity.user.id)}:student`:null;
 const catalog=useTimetableRead(owner?`${owner}:timetable-classes`:null,loadTimetableClasses,300_000);
 const classParam=params.get("classId") ?? params.get("courseId");
 const classId=classParam && (classParam==="ALL" || catalog.data?.some(item=>item.id===classParam)) ? classParam : catalog.data?.[0]?.id || "";
 useEffect(()=>{
  if(classParam || !classId)return;
  const query=new URLSearchParams(params.toString());
  query.delete("courseId");
  query.set("classId",classId);
  window.history.replaceState(null,"",`${pathname}?${query}`);
 },[classParam,classId,params,pathname]);
 const classIds=useMemo(()=>catalog.data?.filter(item=>classId==="ALL" || item.id===classId).map(item=>item.id) ?? [],[catalog.data,classId]);
 const request=useTimetableRead(owner && catalog.data?`${owner}:timetable:${JSON.stringify(classIds)}`:null,useCallback(()=>loadTimetable(classIds),[classIds]),60_000);
 const sessions=useMemo(()=>request.data?.sessions ?? [],[request.data]); const [view,setView]=useState<"calendar"|"list">("calendar"); const [wholeCourse,setWholeCourse]=useState(false);
 const [selected,setSelected]=useState<TimetableSession|null>(null);
 const [notice,setNotice]=useState<{ title: string; text: string }|null>(null);
 const detail=useTimetableRead(owner && selected?`${owner}:session:${selected.classId}:${selected.id}:${selected.syllabusId || ""}:${selected.sessionNo}`:null,useCallback(async()=>selected?loadSessionStudy(selected,false):null,[selected]),30_000);
 const selectedModules=detail.data?.modules ?? selected?.modules ?? [];
 const monthParam=params.get("month"); const month=monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? dayjs(monthParam+"-01") : dayjs().startOf("month");
 const classes=useMemo(()=>request.data?.classes ?? [],[request.data]);
 const timetableError=catalog.error || request.error;
 const timetableLoading=catalog.loading || request.loading;
 const visible=useMemo(()=>visibleTimetableSessions(sessions,month.format("YYYY-MM"),wholeCourse,classId),[sessions,wholeCourse,month,classId]);
 const overview=timetableOverview(classes,classId);
 const first=sessions.find(s=>s.classId===overview.course?.id);
 const progress=overview.progress,averageScore=overview.averageScore,attendanceRate=overview.attendanceRate,diligence=overview.diligence;
 const setQuery=(key: "classId"|"month",value: string|null)=>{
  const query=new URLSearchParams(params.toString());
  if(classParam && !query.has("classId"))query.set("classId",classParam);
  query.delete("courseId");
  if(value)query.set(key,value);else query.delete(key);
  window.history.replaceState(null,"",pathname+(query.size?`?${query}`:""));
 };
 const reloadTimetable=()=>{if(catalog.error || !catalog.data)catalog.reload();else request.reload();};
 const shiftMonth=(amount: number)=>{setWholeCourse(false);setQuery("month",month.add(amount,"month").format("YYYY-MM"));};
 const today=()=>{setWholeCourse(false);setView("calendar");setQuery("month",null);window.setTimeout(()=>document.querySelector(".hsk-timetable .is-today")?.scrollIntoView({block:"center",behavior:"smooth"}),350);};
 const openSession=(session: TimetableSession)=>{
  if(session.access === "locked"){setNotice({title:"Buổi học chưa mở",text:`Buổi học này chưa được mở. Ngày học: ${dayjs(session.date).format("DD/MM/YYYY")}. Quyền truy cập buổi học được xác định từ nguồn dữ liệu.`});return;}
  setSelected(session);
 };
 const openLink=(url: string|undefined,title: string)=>{if(url){try{const target=new URL(url,window.location.origin);if(["https:","http:"].includes(target.protocol)){window.open(target.href,"_blank","noopener,noreferrer");return;}}catch{/* Show an explicit unavailable state below. */}}setNotice({title,text:"Nguồn dữ liệu chưa cung cấp liên kết cho tác vụ này."});};
 const returnUrl=pathname+(params.size?`?${params}`:"");
 const practiceHref=(session:TimetableSession,activity:LessonActivity)=>lessonHref({scheduleId:session.scheduleItemId || session.id,sessionId:session.id,title:session.title,sessionNo:session.sessionNo,syllabusId:session.syllabusId,classId:session.classId,className:session.courseName,returnUrl},activity);
 const openPractice=(activity:LessonActivity=nextStudyActivity(selectedModules))=>{if(selected)router.push(practiceHref(selected,activity));};
 const currentSession=selected && sessions.find(item=>item.id===selected.id && item.classId===selected.classId);
 const knownProgress=currentSession ? currentSession.homeworkProgress : selected?.homeworkProgress;
 const selectedProgress=knownProgress !== undefined ? knownProgress : detail.data?.progress ?? null;
 const sessionAttempts=detail.data?.attempts ?? [];
 const studySummary=sessionStudySummary(selectedModules,sessionAttempts);
 const gradedScore=studySummary.score,pending=studySummary.pending;
 const submittedAttempts=studySummary.submitted;
 const selectedState=selected && getSessionState(selected);
 return <StudentShell layout="bleed" timetableSelection={{classes:catalog.data,selected:classId,onSelect:id=>setQuery("classId",id),error:catalog.error,reload:catalog.reload}}><div className="hsk-timetable student-timetable-page">
  <section className="tkb-hero mb-3">
   <img src={asset("dots.png")} className="tkb-hero__dots tkb-hero__dots--right" alt="" /><img src={asset("dots.png")} className="tkb-hero__dots tkb-hero__dots--left" alt="" />
   <div className="tkb-hero__inner"><div className="row align-items-center g-4"><div className="col-lg-6">
    <div className="tkb-hero__mascot"><span className="tkb-hero__mascot-shadow" /><img className="tkb-hero__mascot-clock" src={asset("clock.png")} alt="" /><img className="tkb-hero__mascot-book" src={asset("book.png")} alt="" /><img className="tkb-hero__mascot-main" src={asset("mascot.png")} alt="Cú Học Bá bên đồng hồ" /></div>
    <h1 className="tkb-hero__title">THỜI KHÓA BIỂU</h1><div className="tkb-hero__greeting">Xin chào {identity.name}</div>
    <div className="tkb-hero__chips"><span className="tkb-hero__chip"><Icon name="id-card" /> Mã lớp: <strong>{overview.course?.code || "—"}</strong></span>{<span className="tkb-hero__chip"><Icon name="chalkboard-user" /> Giáo viên: <strong>{overview.course?.teacher?.fullName || first?.teacher || "Chưa phân công"}</strong></span>}</div>
    <div className="tkb-hero__chips"><span className="tkb-hero__chip"><Icon name="clock" /> Thời gian: <strong>{overview.schedule}</strong></span></div>
   </div><div className="col-lg-6 d-flex justify-content-lg-end"><div className="tkb-glass-card">
    <div className="tkb-glass-card__head"><div className="tkb-glass-card__course"><Icon name="play" /><span>{overview.course?.syllabusName || first?.courseName || "Chưa có khóa học"}</span></div><div className="tkb-glass-card__level">{overview.course?.code}</div></div>
    <div className="tkb-glass-card__standard"><div className="tkb-glass-card__standard-info"><div className="tkb-glass-card__standard-title"><img src={asset("progress-net.svg")} alt="" /> Tiến độ lớp học chuẩn</div><div className="tkb-glass-card__standard-dates"><span>Khai giảng: {overview.start ? dayjs(overview.start).format("DD/MM/YYYY") : "Chưa xếp lịch"}</span><span>Kết thúc: {overview.end ? dayjs(overview.end).format("DD/MM/YYYY") : "Chưa xếp lịch"}</span></div></div><div className="tkb-glass-card__standard-progress"><Ring value={overview.percent} /><div className="tkb-glass-card__standard-count"><div><strong>{overview.done}</strong><span>{` / ${overview.total}`}</span></div><p>{`Còn ${Math.max(0,overview.total-overview.done)} buổi kết thúc`}</p></div></div></div>
    <div className="tkb-glass-card__grid"><Stat icon="personal" title="Tiến độ cá nhân" value={progress} /><Stat icon="score" title="Điểm trung bình bài tập" value={averageScore} score /><Stat icon="attend" title="Chuyên cần tham gia" value={attendanceRate} circular /><Stat icon="hwdone" title="Chuyên cần bài tập về nhà" value={diligence} /></div>
   </div></div></div></div>
  </section>
  <div className="hsk-timetable-body">
   {timetableError && <StudentFetchError title="Không tải được thời khóa biểu" description={timetableError} className="alert alert-danger" onRetry={reloadTimetable} mobileContent={<>Không tải được thời khóa biểu: {timetableError} </>} />}
   {!!request.data?.warnings.length && <div className="alert alert-warning" role="alert"><strong>Một phần dữ liệu chưa tải được:</strong><ul>{request.data.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></div>}
   <TimetableToolbar month={month.format("M/YYYY")} wholeCourse={wholeCourse} view={view} onToday={today} onMonth={shiftMonth} onScope={setWholeCourse} onView={setView} onReload={reloadTimetable} loading={timetableLoading} />
   <div className="tkb-content">{timetableLoading ? <StudentContentState kind="loading" className="tkb-empty">Đang tải lịch lớp học…</StudentContentState> : !timetableError && !visible.length ? <StudentContentState kind="empty" className="tkb-empty"><Icon name="calendar-xmark" /><h2>Chưa có lịch học</h2><p>Không có buổi học trong tháng hoặc lớp đã chọn.</p><button className="tkb-card__cta tkb-card__cta--review" type="button" onClick={today}>Về tháng hiện tại</button></StudentContentState> : <div className={view === "calendar"?"tkb-grid":"tkb-list"}>{visible.map(session=>{const state=getSessionState(session);return <div className="tkb-card-wrap" key={session.id}><article className={`tkb-card is-${state}`}>
    <button type="button" className="tkb-open-session" aria-label={`Chi tiết buổi ${session.sessionNo}: ${session.title}`} onClick={()=>openSession(session)}><div className="tkb-card__head"><div className="tkb-card__head-left"><div className="tkb-card__session-group"><span className="tkb-card__session-pill">Buổi {session.sessionNo}</span><span className="tkb-card__level">{session.classCode}</span>{session.isExam && <span className="tkb-card__status tkb-card__status--exam">Kiểm tra</span>}</div><Status session={session} /></div><div className="tkb-card__head-right"><span className="tkb-card__weekday">{session.date ? weekDays[dayjs(session.date).day()] : "Giáo trình"}</span><span className="tkb-card__date">{session.date ? dayjs(session.date).format("DD/MM") : `#${session.sessionNo}`}</span></div></div><div className="tkb-card__info"><div className="tkb-card__title-row"><Icon name={session.access === "locked"?"lock":"pen-to-square"} /><span title={session.title}>{session.title}</span></div><div className="tkb-card__time-row"><Icon name="hourglass-half" /><span>{session.date ? `${session.startTime} - ${session.endTime}` : "Chưa xếp ngày giờ học"}</span></div></div></button>
    <div className={state === "done" && !session.isExam ? "tkb-card__body tkb-card__body--actions" : "tkb-card__body"}>
     <button type="button" disabled={state === "cancelled" || (session.isExam && state !== "today")} className={`tkb-card__cta tkb-card__cta--${state === "today"?"join":state === "done"?"review":"waiting"}`} onClick={()=>session.isExam?openLink(session.examUrl,"Vào ca thi"):state === "today" && session.meetingUrl?openLink(session.meetingUrl,"Vào lớp ngay"):state === "done" && session.access !== "locked"?router.push(practiceHref(session,"slides")):openSession(session)}><Icon name={state === "today"?"circle-play":state === "done"?"clock-rotate-left":"clock"} /> {state === "unscheduled" ? "Xem nội dung buổi học" : session.isExam ? state === "done" ? "Ca thi đã kết thúc" : state === "today" ? "Vào ca thi" : "Chưa đến giờ thi" : state === "today" ? "Vào lớp ngay!" : state === "done" ? "Xem lại buổi học!" : "Chưa đến giờ học"}</button>
     {state === "done" && !session.isExam && (
      <button type="button" className="tkb-card__cta tkb-card__cta--materials" onClick={()=>openSession(session)}>
       <Icon name="book-open" /> Bài tập &amp; Học liệu
      </button>
     )}
    </div>{sessionProgress(session) !== null && <Ring className="tkb-card__hw-badge" value={sessionProgress(session)!} size={42} />}
   </article></div>;})}</div>}</div>
   <div className="tkb-support"><div className="tkb-support__card tkb-support__card--mentor"><div className="tkb-support__head"><img src={asset("help.svg")} className="tkb-support__icon" alt="" /><h5>Bạn cần hỗ trợ?</h5></div><p className="tkb-support__desc">Kết nối với Mentor để được giải đáp và hỗ trợ trong quá trình học.</p><button type="button" className="tkb-support__cta" onClick={()=>setNotice({title:"Hỗ trợ từ Mentor",text:"Kênh liên hệ Mentor sẽ được nối theo dữ liệu lớp học chính thức. Bản xem trước chưa gửi yêu cầu hỗ trợ."})}>Liên hệ Mentor</button></div><div className="tkb-support__card tkb-support__card--ai"><div className="tkb-support__head"><img src={asset("ai.svg")} className="tkb-support__icon" alt="" /><h5>Trợ lý học tập AI</h5></div><p className="tkb-support__desc">Ôn luyện kiến thức và giải đáp thắc mắc cùng trợ lý học tập.</p><button type="button" className="tkb-support__cta" onClick={()=>setNotice({title:"Trợ lý học tập AI",text:"Giao diện thời khóa biểu đã có điểm mở trợ lý. Dịch vụ AI chưa được kết nối trong bản dựng này."})}>Học cùng AI</button></div></div>
  </div>
  <Modal
   open={!!selected} onCancel={()=>setSelected(null)} footer={null} width={1000} centered
   rootClassName="hsk-timetable-modal" destroyOnClose zIndex={10050}
   styles={{ header: { margin: 0, padding: 0 }, body: { padding: 0 } }}
   title={selected && <div className="tkb-session-modal__header">
    <div className="tkb-session-modal__session">
     <span className="tkb-session-modal__session-no">Buổi {selected.sessionNo}</span>
     <Status session={selected} />
    </div>
    <h2 className="tkb-session-modal__title">{selected.title}</h2>
    <div className="tkb-session-class">
     <strong>{selected.courseName}</strong>
     <div className="tkb-session-modal__meta">
      <span className="tkb-session-modal__meta-item"><Icon name="id-card" />{selected.classCode}</span>
      <span className="tkb-session-modal__meta-item"><Icon name="clock" />
       {selected.date ? dayjs(selected.date).format("DD/MM/YYYY") : "Chưa xếp ngày giờ"}
       {selected.startTime && selected.endTime && <span>{selected.startTime} – {selected.endTime}</span>}
      </span>
      <span className="tkb-session-modal__meta-item"><Icon name="graduation-cap" />{selected.teacher || "Chưa phân công"}</span>
     </div>
    </div>
   </div>}
  >
   {selected && (
    <div className="hsk-session-modal-body" key={selected.id}>
     {detail.loading && <p role="status">Đang tải tài nguyên của buổi học…</p>}
     {detail.error && <div role="alert">{detail.error} <Button size="small" onClick={detail.reload}>Thử lại</Button></div>}
     {detail.data?.warnings.map((warning,index)=><p role="alert" className="text-danger" key={index}>{warning}</p>)}
     <section aria-label="Tiến độ và kết quả">
      <h3 className="tkb-session-section-title">Tiến độ và kết quả</h3>
      <div className="tkb-practice__summary">
       <div className="tkb-practice__summary-half">
        <Ring className="tkb-practice__ring" value={selectedProgress} size={54} />
        <div className="tkb-practice__summary-body">
         <div className="tkb-practice__summary-title">{selectedProgress === null?"Chưa có dữ liệu tiến độ cá nhân":selectedProgress >= 100?"Bạn đã hoàn thành bài ôn luyện!":studySummary.remaining>0?`Còn ${studySummary.remaining} bài tập cần hoàn thành`:`Bạn đã hoàn thành ${selectedProgress}% nội dung buổi học`}</div>
         <Button size="small" disabled={detail.loading || !!detail.error || selected.access !== "full"} onClick={()=>openPractice()}>{selectedProgress !== null && selectedProgress >= 100?"Luyện tập lại":"Tiếp tục ôn luyện"}</Button>
        </div>
       </div>
       <div className="tkb-practice__summary-half">
        <div className="hsk-mentor-score">{gradedScore?`${gradedScore.earned}/${gradedScore.total}`:<Icon name="clipboard" />}</div>
        <div className="tkb-practice__summary-body">
         <div className="tkb-practice__summary-title">{gradedScore?"Đã có kết quả chấm bài":pending?"Đang chờ chấm bài":submittedAttempts.length?"Chưa có kết quả chấm bài":"Chưa có bài nộp"}</div>
         {submittedAttempts.length>0 && <Button size="small" disabled={detail.loading || !!detail.error} onClick={()=>{
          const query=new URLSearchParams({classId:selected.classId,sessionId:selected.id,syllabusId:selected.syllabusId || "",scheduleId:selected.scheduleItemId || selected.id,sessionNo:String(selected.sessionNo),returnUrl});
          router.push(`/quiz-session/${encodeURIComponent(submittedAttempts[0].attemptId)}/result?${query}`);
         }}>{gradedScore?"Xem kết quả":"Xem bài đã nộp"}</Button>}
        </div>
       </div>
       <Link href={practiceHref(selected,"slides")} className="tkb-practice__summary-half tkb-summary-slides" aria-label="Xem tài liệu học tập - Slides">
        <span className="tkb-summary-slides-icon"><img src={asset("mod-tailieu.svg")} alt="" /></span>
        <span className="tkb-practice__summary-body">
         <strong className="tkb-practice__summary-title">Slides</strong>
         <span className="tkb-summary-slides-action">Xem tài liệu <Icon name="arrow-right" /></span>
        </span>
       </Link>
       <Button className="tkb-practice__summary-half tkb-summary-session-action" onClick={()=>{
        if(selectedState==="unscheduled"){
         setNotice({title:"Chưa có lịch lớp",text:"Buổi học này chưa được xếp ngày giờ hoặc chưa có liên kết phòng học."});
        }else if(selectedState==="done"){
         openPractice("slides");
        }else{
         openLink(selected.isExam?selected.examUrl:selected.meetingUrl,selected.isExam?"Vào ca thi":"Vào lớp ngay");
        }
       }}>
        <span className="tkb-summary-action-icon">
         <Icon name={selectedState==="unscheduled"?"calendar":"circle-play"} />
        </span>
        <strong className="tkb-practice__summary-title">{selectedState==="unscheduled"?"Chưa có lịch lớp":selectedState==="done"?"Xem lại buổi học":selected.isExam?"Vào ca thi":"Vào lớp ngay"}</strong>
        <Icon name="chevron-right" />
       </Button>
      </div>
     </section>
     {selected.access === "materials-only" && <div className="tkb-preview-notice" role="status"><Icon name="lock" /> Bạn đang xem trước tài liệu buổi học. Bài tập chưa mở.</div>}
     <LessonActivityCards session={selected} returnUrl={returnUrl} />
    </div>
   )}
  </Modal>
  <Modal open={!!notice} onCancel={()=>setNotice(null)} onOk={()=>setNotice(null)} title={notice?.title} cancelButtonProps={{style:{display:"none"}}} okText="Đã hiểu" zIndex={10090} centered><p>{notice?.text}</p></Modal>
 </div></StudentShell>;
}
