"use client";
interface Props {
 month: string; course: string; courses: { id:string; label:string }[]; isAdmin:boolean;
 wholeCourse:boolean; view:"calendar"|"list";
 onToday:()=>void; onMonth:(amount:number)=>void; onCourse:(id:string)=>void;
 onScope:()=>void; onView:(view:"calendar"|"list")=>void;
}
const Icon=({name}:{name:string})=><i aria-hidden="true" className={`fa-solid fa-${name}`} />;
export default function TimetableToolbar(p:Props) {
 return <div className="tkb-navbar" role="group" aria-label="Điều khiển thời khóa biểu">
  <div className="tkb-navbar__left"><span className="tkb-navbar__month">{p.wholeCourse?"Toàn bộ khóa học":`Tháng ${p.month}`}</span>
   <button type="button" className="tkb-navbar__today" onClick={p.onToday}><span className="tkb-navbar__today-dot" />Buổi học hôm nay</button>
   <div className="tkb-navbar__arrows"><button type="button" aria-label="Tháng trước" onClick={()=>p.onMonth(-1)}><Icon name="chevron-left" /></button><button type="button" aria-label="Tháng sau" onClick={()=>p.onMonth(1)}><Icon name="chevron-right" /></button></div>
  </div>
  <div className="tkb-navbar__switch"><div className="tkb-navbar__course-filter"><Icon name="filter" /><select className="tkb-navbar__course-select" aria-label={"Lọc theo lớp học"} value={p.course} onChange={e=>p.onCourse(e.target.value)}><option value="ALL">🌐 Tất cả lớp</option>{p.courses.map(c=><option value={c.id} key={c.id}>{c.label}</option>)}</select></div>
   <button type="button" className="tkb-navbar__scope" aria-pressed={p.wholeCourse} onClick={p.onScope}>{p.wholeCourse?"Xem theo tháng":"Xem toàn bộ khóa học"}</button>
   <button type="button" aria-label="Dạng thẻ" aria-pressed={p.view==="calendar"} className={`tkb-navbar__view ${p.view==="calendar"?"active":""}`} onClick={()=>p.onView("calendar")}><Icon name="calendar" /></button>
   <button type="button" aria-label="Dạng danh sách" aria-pressed={p.view==="list"} className={`tkb-navbar__view ${p.view==="list"?"active":""}`} onClick={()=>p.onView("list")}><Icon name="list-ul" /></button>
  </div>
 </div>;
}
