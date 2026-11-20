"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import type { TimetableModule } from "./timetable-data";
import { LESSON_ACTIVITIES } from "./lesson-navigation";
import { activityResources } from "./lesson-source";
import "./lesson-sidebar-menu.css";

const vocabularyTabs = [
 { key: "vocabulary", label: "Từ vựng", icon: "book-open" },
 { key: "flashcards", label: "Flashcard", icon: "layer-group" },
 { key: "handwriting", label: "Luyện viết", icon: "pen-to-square" },
] as const;

function skillPercent(modules: TimetableModule[], key: typeof LESSON_ACTIVITIES[number]["key"]) {
 const items = activityResources(modules, key);
 return items.length && items.every(item => item.progress !== null)
  ? Math.round(items.reduce((sum, item) => sum + (item.progress ?? 0), 0) / items.length)
  : null;
}

export default function LessonSidebarMenu({ modules, tab, onSelect }: { modules: TimetableModule[]; tab: string; onSelect: (tab: string) => void }) {
 const [games, setGames] = useState(tab.startsWith("game-"));
 const selected = (key: string) => tab === key ? "page" as const : undefined;
 const skills = LESSON_ACTIVITIES.slice(1).map(item => ({ ...item, progress: skillPercent(modules, item.key) }));
 const completed = skills.filter(item => item.progress === 100).length;
 const hasProgress = skills.some(item => item.progress !== null);

 return <>
  <section className="lesson-sidebar-card lesson-material-menu" aria-label="Tài liệu học tập">
   <h2 className="lesson-sidebar-heading"><img src="/assets/hocba/tkb-mod-tailieu.svg" alt="" />Tài liệu học tập</h2>
   <button type="button" className="lesson-sidebar-row" aria-current={selected("slides")} onClick={() => onSelect("slides")}>
    <i className="fa-solid fa-file-lines" aria-hidden="true" />
    <span>Slides</span>
   </button>
   <button type="button" className="lesson-sidebar-row" onClick={() => onSelect("slides")}>
    <i className="fa-solid fa-circle-play" aria-hidden="true" />
    <span>Xem lại buổi học</span>
   </button>
  </section>
  <section className="lesson-sidebar-card" aria-label="Ngữ pháp &amp; Từ vựng">
   <h2 className="lesson-sidebar-heading"><img src="/assets/hocba/tkb-mod-nguphap.svg" alt="" />Ngữ pháp &amp; Từ vựng</h2>
   <button type="button" className="lesson-sidebar-row" aria-current={selected("grammar")} onClick={() => onSelect("grammar")}>
    <i className="fa-solid fa-diagram-project" aria-hidden="true" />
    <span>Ngữ pháp</span>
   </button>
   {vocabularyTabs.map(item => <button type="button" key={item.key} className="lesson-sidebar-row" aria-current={selected(item.key)} onClick={() => onSelect(item.key)}>
    <i className={`fa-solid fa-${item.icon}`} aria-hidden="true" />
    <span>{item.label}</span>
   </button>)}
   <button type="button" className="lesson-sidebar-row lesson-sidebar-row--wide" aria-expanded={games} onClick={() => setGames(!games)}>
    <i className="fa-solid fa-gamepad" aria-hidden="true" />
    <span>Game</span>
    <i className={`fa-solid fa-chevron-${games ? "up" : "down"}`} aria-hidden="true" />
   </button>
   {games && <div className="lesson-sidebar-children">
    <button type="button" className="lesson-sidebar-row" aria-current={selected("game-match")} onClick={() => onSelect("game-match")}>Game Thẻ Bài</button>
    <button type="button" className="lesson-sidebar-row" aria-current={selected("game-blast")} onClick={() => onSelect("game-blast")}>Game Học Bá Blast</button>
   </div>}
  </section>
  <section className="lesson-sidebar-card lesson-practice-menu" aria-label="Luyện tập">
   <h2 className="lesson-sidebar-heading">
    <img src="/assets/hocba/tkb-luyenbai.svg" alt="" />Luyện tập
    {hasProgress && <span className="lesson-sidebar-count">{completed}/{skills.length}</span>}
   </h2>
   {skills.map(item => <button type="button" key={item.key} className="lesson-sidebar-row" aria-current={selected(item.key)} onClick={() => onSelect(item.key)}>
    <img src={`/assets/hocba/tkb-mod-${item.icon}.svg`} alt="" />
    <span>{item.shortLabel} <small lang="zh">{item.chinese}</small></span>
    {item.progress !== null && <span className="lesson-sidebar-count">{item.progress}%</span>}
   </button>)}
  </section>
  <section className="lesson-sidebar-card" aria-label="Nhận xét của giáo viên">
   <h2 className="lesson-sidebar-heading">
    <i className="fa-solid fa-comment-dots" aria-hidden="true" />Nhận xét của giáo viên
   </h2>
   <button type="button" className="lesson-sidebar-row lesson-sidebar-row--wide" aria-current={selected("comments")} onClick={() => onSelect("comments")}>
    <span>Xem nhận xét</span>
    <i className="fa-solid fa-chevron-right" aria-hidden="true" />
   </button>
  </section>
 </>;
}
