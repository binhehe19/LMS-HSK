/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import "./lesson-workspace.css";
import { activityResources } from "./lesson-source";
import { LESSON_ACTIVITIES, lessonHref } from "./lesson-navigation";
import type { TimetableSession, TimetableModule } from "./timetable-data";
const cards=[LESSON_ACTIVITIES[0],LESSON_ACTIVITIES[1],LESSON_ACTIVITIES[2],{key:"handwriting",label:"Flashcard - Luyện viết",chinese:"",icon:"viet"},LESSON_ACTIVITIES[3],LESSON_ACTIVITIES[4],{key:"flashcards",label:"Flashcard",chinese:"",icon:"flashcard"}] as const;
export default function LessonActivityCards({session,returnUrl,modules=[]}:{session:TimetableSession;returnUrl:string;modules?:TimetableModule[]}) {
 const context={scheduleId:session.scheduleItemId || session.id,sessionId:session.id,title:session.title,sessionNo:session.sessionNo,syllabusId:session.syllabusId,classId:session.classId,className:session.courseName,returnUrl};
 return <div className="tkb-practice__grid tkb-activity-cards">{cards.map(activity=>{
 const vocabulary=activity.key === "handwriting" || activity.key === "flashcards";
 const attached=vocabulary?modules.filter(item=>item.resourceType === "VOCABULARY"):activityResources(modules,activity.key);
 const progress=attached.length && attached.every(item=>item.progress !== null)?Math.round(attached.reduce((sum,item)=>sum+(item.progress || 0),0)/attached.length):null;
 const complete=progress !== null && progress>=100;
 const href=vocabulary?(()=>{const url=lessonHref(context,"slides");const [path,search]=url.split("?");const params=new URLSearchParams(search);params.set("tab",activity.key);params.delete("moduleType");return path+"?"+params;})():lessonHref(context,activity.key);
 const label=activity.key === "slides"?`${activity.label}: ${attached[0]?.title || session.title}`:activity.chinese?`${activity.label}: ${activity.chinese}`:activity.label;
 return <Link key={activity.key} href={href} className={`tkb-module-card ${activity.key === "slides"?"tkb-module-card--material":""}`} aria-label={activity.key === "slides"?"Xem tài liệu học tập - Slides":label}><div className="tkb-module-card__top"><span className="tkb-module-card__icon">{activity.icon === "flashcard"?<i className="fa-solid fa-graduation-cap" aria-hidden="true"/>:<img src={`/assets/hocba/tkb-mod-${activity.icon}.svg`} alt=""/>}</span><span className="tkb-module-card__title">{label}</span></div><div className="tkb-module-card__foot">{activity.key === "slides"?<span className="tkb-slide-label">Slides</span>:<span className={`tkb-module-card__state ${complete?"is-complete":""}`}>{complete?"✓ Hoàn thành":progress !== null?`• Tiến độ ${progress}%`:"• Chưa có dữ liệu"}</span>}<span className={`tkb-module-card__pill tkb-module-card__pill--${activity.key === "slides" || complete?"view":"start"}`}>{activity.key === "slides"?"Xem ngay!":complete?"Luyện lại":"Bắt đầu!"}</span></div></Link>;
 })}</div>;
}
