"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useMemo } from "react";
import { useStudentIdentity, useStudentRequest } from "../student-data";
import { loadLesson, activityResources, additionalResources, grammarResources } from "./lesson-source";
import LessonSlides from "./lesson-slides";
import LessonGames from "./lesson-games";
import LessonSidebarMenu from "./lesson-sidebar-menu";
import LessonResourceContent from "./lesson-resource-content";
import { ExercisePanel, VocabularyPanel, type VocabularyView, vocabularyWords } from "./lesson-panels";
import { usePathname, useRouter, useSearchParams, useParams } from "next/navigation";
import { lessonActivity, safeTimetableReturn } from "./lesson-navigation";
import StudentShell from "../dashboard/student-shell";
import { StudentContentState, StudentFetchError } from "../student-content-state";
import "./production-lesson.css";
import "./lesson-workspace.css";
import "./lesson-tabs.css";

export default function LessonWorkspace() {
 const query=useSearchParams();const pathname=usePathname();const router=useRouter();const route=useParams<{scheduleId:string}>();
 const syllabusId=query.get("syllabusId") || "";const classId=query.get("classId") || "";const sessionId=query.get("sessionId") || "";const sessionNumber=Number(query.get("sessionNo"));
 const identity=useStudentIdentity();
 const isAdmin=!!identity.user?.roles.includes("ROLE_ADMIN") && (!classId || !sessionId || sessionId.startsWith("syllabus:"));
 const context=useMemo(()=>({scheduleId:route.scheduleId,syllabusId,classId,sessionId,sessionNo:sessionNumber}),[route.scheduleId,syllabusId,classId,sessionId,sessionNumber]);
 const source=useStudentRequest(useCallback(()=>loadLesson(context,isAdmin),[context,isAdmin]));
 const reloadSource=source.reload;
 useEffect(()=>{window.addEventListener("hsk:lesson-submitted",reloadSource);return ()=>window.removeEventListener("hsk:lesson-submitted",reloadSource);},[reloadSource]);
 const modules=useMemo(()=>source.data?.modules ?? [],[source.data]);const extra=useMemo(()=>additionalResources(modules),[modules]);
 // Legacy unclassified links open an available skill tab.
 const rawTab=query.get("tab");const tab=rawTab === "practice"?(["reading","listening","writing","speaking"] as const).find(key=>activityResources(modules,key).length > 0) || "reading":rawTab;const vocabularyView:VocabularyView|null=tab === "vocabulary" || tab === "flashcards" || tab === "handwriting"?tab:null;const comments=tab === "comments";const activity=lessonActivity(tab || query.get("moduleType"));
 const title=source.data?.session.title || query.get("sessionTitle") || "Buổi học";const className=source.data?.session.courseName || query.get("className") || "Khóa học";const sessionNo=source.data?.session.sessionNo || query.get("sessionNo");
 const grammar=tab==="grammar";
 const resourceTab=grammar || tab==="resource";
 const contentIcon=grammar?"nguphap":comments?"tailieu":activity.icon;
 const activeResources=grammar ? grammarResources(modules) : tab === "resource" ? extra.filter(item=>item.id === query.get("moduleId")) : activityResources(modules,activity.key);
 const returnUrl=safeTimetableReturn(query.get("returnUrl"),classId);
 const switchTab=(key:string,resourceId?:string)=>{const next=new URLSearchParams(query.toString());next.set("tab",key);next.delete("moduleId");next.delete("lessonMaterialId");if(resourceId)next.set("moduleId",resourceId);next.delete("moduleType");router.push(pathname+"?"+next,{scroll:false});};
 const emptyTitle=grammar ? "Ngữ pháp" : tab === "resource" ? activeResources[0]?.resourceType === "VOCABULARY" ? "Từ vựng" : activeResources[0]?.resourceType === "GRAMMAR" ? "Ngữ pháp" : activeResources[0]?.title || "Nội dung học tập" : comments?"Nhận xét của giáo viên":activity.key === "slides"?title:`${sessionNo?`Bài ${sessionNo} – `:""}${activity.chinese}`;
 if (tab === "game-match" || tab === "game-blast") {
  if (source.loading || source.error) {
   return <StudentShell layout="wide">{source.loading
    ? <StudentContentState kind="loading" className="hsk-lesson-empty">Đang tải dữ liệu…</StudentContentState>
    : <StudentFetchError title="Không tải được dữ liệu buổi học" description={source.error ?? ""} className="hsk-lesson-empty" onRetry={source.reload} />}
   </StudentShell>;
  }
  return <StudentShell layout="bleed" spacing="game"><LessonGames key={tab + route.scheduleId} words={vocabularyWords(modules)} mode={tab === "game-match" ? "match" : "blast"} onBack={() => switchTab("flashcards")} /></StudentShell>;
 }
 return <StudentShell layout="bleed" spacing="lesson"><div className="hsk-lesson-workspace">
  <header className="ochp-header">
   <div className="ochp-header__inner">
    <div className="ochp-header__left">
     <div className="ochp-header__row">
      <h1>{sessionNo ? `Buổi ${sessionNo}` : title}</h1>
      <span className="ochp-header__pill">{className}</span>
     </div>
     <Link href={returnUrl} className="ochp-header__back"><i className="fa-solid fa-arrow-left" aria-hidden="true" /> Quay lại</Link>
    </div>
    <div className="hsk-lesson-progress">
     <span>Tiến độ luyện bài</span><strong>{source.data?.session.homeworkProgress == null ? "—" : `${source.data.session.homeworkProgress}%`}</strong>
     <div><span style={{ display:"block", height:"100%", background:"white", borderRadius:10, width:`${source.data?.session.homeworkProgress ?? 0}%` }} /></div>
     <small>{source.data?.session.homeworkProgress == null ? "Chưa có dữ liệu" : "Tiến độ luyện bài của bạn"}</small>
    </div>
   </div>
  </header>
  <div className="ochp-page-container hsk-lesson-layout"><section className="module-content-panel hsk-lesson-content" aria-label={vocabularyView === "vocabulary" ? "Từ vựng" : grammar ? "Ngữ pháp" : tab === "resource" ? "Nội dung bổ sung" : comments?"Nhận xét của giáo viên":activity.label}>
   {!vocabularyView && (resourceTab || comments) && <><div className={`hsk-lesson-breadcrumb ${activity.key === "slides"?"is-material":""}`}><img src={`/assets/hocba/tkb-mod-${contentIcon}.svg`} alt="" />{resourceTab ? "NỘI DUNG HỌC TẬP" : comments?"Nhận xét của giáo viên":activity.key === "slides"?"TÀI LIỆU HỌC TẬP - SLIDES":""}</div>
   <h2>{emptyTitle}</h2></>}
   {source.loading ? <StudentContentState kind="loading" className="hsk-lesson-empty"><h3>Đang tải dữ liệu buổi học…</h3></StudentContentState> : source.error ? <StudentFetchError title="Không tải được dữ liệu buổi học" description={source.error} className="hsk-lesson-empty" onRetry={source.reload} mobileRetryClassName="btn btn-outline-danger" mobileContent={<><h3>Không tải được dữ liệu</h3><p>{source.error}</p></>} />  : vocabularyView ? <VocabularyPanel key={vocabularyView+route.scheduleId} resources={modules} view={vocabularyView}/> : !comments && !vocabularyView && !resourceTab && activity.key !== "slides" ? <ExercisePanel key={activity.key+route.scheduleId} resources={activeResources} skill={activity.key} session={source.data?.session} isAdmin={isAdmin}/> : !comments && !resourceTab && activity.key === "slides" ? <LessonSlides resources={activeResources}/> : !comments && activeResources.length ? <div>{activeResources.map(item=><LessonResourceContent key={item.id} resource={item} isAdmin={isAdmin} />)}</div> : <>
   <StudentContentState kind="empty" className={`hsk-lesson-empty ${activity.key === "slides" && !comments && !resourceTab?"is-slide":""}`}><img src={`/assets/hocba/tkb-mod-${contentIcon}.svg`} alt="" /><h3>Chưa có dữ liệu</h3><p>{comments?"Chưa có nhận xét cho buổi học này.":activity.key === "slides" && !resourceTab?"Slide và tài liệu của buổi học sẽ được hiển thị tại đây.":"Nội dung sẽ được hiển thị khi được gắn vào buổi học."}</p></StudentContentState>
   </>}
   {!!source.data?.warnings.length && <details className="hsk-lesson-warnings"><summary>Một phần tài nguyên chưa tải được</summary>{source.data.warnings.map((warning,index)=><p key={index}>{warning}</p>)}<button type="button" onClick={source.reload}>Tải lại</button></details>}

  </section>
  <aside className="ochp-sidebar" aria-label="Nội dung buổi học"><LessonSidebarMenu modules={modules} tab={tab || activity.key} onSelect={switchTab}/>
   <div className="ochp-side-card ochp-side-card--mentor"><div className="ochp-side-card__head"><img src="/assets/hocba/tkb-help.svg" className="ochp-side-card__icon" alt="" /><h5>Gợi ý từ Mentor!</h5></div><p className="ochp-side-card__desc">Bạn có thể luyện bài tập nhiều lần. Tuy nhiên, để đảm bảo tiến độ khóa học tại Học Bá, việc chấm điểm &amp; phản hồi chi tiết từ Mentor sẽ được thực hiện cho lần nộp bài đầu tiên.</p><button type="button" className="ochp-side-card__cta" disabled title="Chưa có dữ liệu liên hệ Mentor">Nhắn Mentor ngay!</button></div>
   <div className="ochp-side-card ochp-side-card--ai"><div className="ochp-side-card__head"><img src="/assets/hocba/tkb-ai.svg" className="ochp-side-card__icon ochp-side-card__icon--ai" alt="" /><h5>Bên bạn mọi lúc!</h5></div><p className="ochp-side-card__desc">Khám phá ngay trợ lý AI độc quyền của Học Bá</p><button type="button" className="ochp-side-card__cta" disabled title="Chưa kết nối trợ lý AI">Khám phá ngay!</button></div>
  </aside></div>
 </div></StudentShell>;
}
