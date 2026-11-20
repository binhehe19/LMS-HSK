/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import "./lesson-workspace.css";
import { LESSON_ACTIVITIES, lessonHref } from "./lesson-navigation";
import type { TimetableSession } from "./timetable-data";
const groups = [
 { title: "Ngữ pháp & Từ vựng", cards: [
  {key:"grammar",label:"Ngữ pháp",chinese:"",icon:"nguphap"},
  {key:"vocabulary",label:"Từ vựng",chinese:"",icon:"doc"},
  {key:"flashcards",label:"Flashcard",chinese:"",icon:"flashcard"},
  {key:"handwriting",label:"Luyện viết",chinese:"",icon:"viet"},
 ] },
 { title: "Luyện tập", cards: LESSON_ACTIVITIES.slice(1) },
] as const;
export default function LessonActivityCards({session}:{session:TimetableSession}) {
 const context={scheduleId:session.scheduleItemId || session.id,sessionId:session.id,classId:session.classId};
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
