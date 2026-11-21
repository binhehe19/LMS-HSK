/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import "./lesson-workspace.css";
import { LESSON_ACTIVITIES, lessonHref } from "./lesson-navigation";
import { lessonAvailability } from "./lesson-source";
import type { TimetableModule, TimetableSession } from "./timetable-data";
const vocabularyCards = [
 {key:"vocabulary",label:"Từ vựng",chinese:"",icon:"doc"},
 {key:"flashcards",label:"Flashcard",chinese:"",icon:"flashcard"},
 {key:"handwriting",label:"Luyện viết",chinese:"",icon:"viet"},
] as const;
const grammarCard = {key:"grammar",label:"Ngữ pháp",chinese:"",icon:"nguphap"} as const;
/** Thẻ hoạt động của buổi trong popup thời khóa biểu: chỉ hiện mục buổi học có nội dung (cùng quy tắc với thanh bên màn buổi học). */
export default function LessonActivityCards({session,modules,loading=false}:{session:TimetableSession;modules:TimetableModule[];loading?:boolean}) {
 if(loading)return null;
 const context={scheduleId:session.scheduleItemId || session.id,sessionId:session.id,classId:session.classId};
 const available=lessonAvailability(modules);
 const groups=[
  { title: "Ngữ pháp & Từ vựng", cards: [...(available.grammar?[grammarCard]:[]),...(available.vocabulary?vocabularyCards:[])] },
  { title: "Luyện tập", cards: LESSON_ACTIVITIES.slice(1).filter(activity=>available.skills.some(key=>key === activity.key)) },
 ].filter(group=>group.cards.length > 0);
 if(!groups.length)return <p className="tkb-session-empty" role="status">Buổi học chưa được gắn ngữ pháp, từ vựng hay bài tập luyện tập.</p>;
 return <div className="tkb-activity-groups">{groups.map(group=>(
 <section key={group.title} aria-label={group.title}>
 <h3 className="tkb-session-section-title">{group.title}</h3>
 <div className="tkb-activity-cards">{group.cards.map(activity=>{
 const href=lessonHref(context,activity.key);
 const label=activity.chinese?`${activity.label}: ${activity.chinese}`:activity.label;
 return (
  <Link key={activity.key} href={href} className="tkb-module-card" aria-label={label}>
   <div className="tkb-module-card__top">
    <span className="tkb-module-card__icon">{activity.icon === "flashcard"?<i className="fa-solid fa-graduation-cap" aria-hidden="true"/>:<img src={`/assets/hocba/tkb-mod-${activity.icon}.svg`} alt=""/>}</span>
    <span className="tkb-module-card__title">{label}</span>
    <i className="fa-solid fa-chevron-right tkb-module-card__arrow" aria-hidden="true" />
   </div>
  </Link>
 );
 })}</div>
 </section>
 ))}</div>;
}
