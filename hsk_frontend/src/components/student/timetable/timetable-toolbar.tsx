"use client";
import { Button, Segmented } from "antd";

interface Props {
 month: string;
 wholeCourse:boolean; wholeCourseOnly?:boolean; view:"calendar"|"list";
 onToday:()=>void; onMonth:(amount:number)=>void;
 onScope:(wholeCourse:boolean)=>void; onView:(view:"calendar"|"list")=>void;
 onReload:()=>void; loading?:boolean;
}
const Icon=({name}:{name:string})=><i aria-hidden="true" className={`fa-solid fa-${name}`} />;
export default function TimetableToolbar(p:Props) {
 return <div className="tkb-navbar" role="group" aria-label="Điều khiển thời khóa biểu">
  <div className="tkb-navbar__left">
   <span className="tkb-navbar__month">{p.wholeCourse?"Toàn bộ khóa học":`Tháng ${p.month}`}</span>
   {!p.wholeCourse && <div className="tkb-toolbar-month-actions" role="group" aria-label="Đổi tháng">
    <Button aria-label="Tháng trước" title="Tháng trước" icon={<Icon name="chevron-left" />} onClick={()=>p.onMonth(-1)} />
    <Button aria-label="Tháng sau" title="Tháng sau" icon={<Icon name="chevron-right" />} onClick={()=>p.onMonth(1)} />
   </div>}
   {!p.wholeCourseOnly && <Button onClick={p.onToday}>Hôm nay</Button>}
  </div>
  <div className="tkb-toolbar-options">
   <Segmented name="timetable-scope" aria-label="Phạm vi lịch" value={p.wholeCourse?"course":"month"} onChange={value=>p.onScope(value==="course")}
    options={p.wholeCourseOnly?[{value:"course",label:"Toàn khóa"}]:[{value:"month",label:"Theo tháng"},{value:"course",label:"Toàn khóa"}]} />
   <Segmented name="timetable-view" className="tkb-toolbar-view" aria-label="Kiểu hiển thị" value={p.view} onChange={p.onView}
    options={[
     {value:"calendar",label:<><Icon name="table-cells-large" /><span className="visually-hidden">Dạng thẻ</span></>,title:"Dạng thẻ"},
     {value:"list",label:<><Icon name="list-ul" /><span className="visually-hidden">Dạng danh sách</span></>,title:"Dạng danh sách"},
    ]} />
   <Button className="tkb-toolbar-reload" aria-label="Tải lại lịch" title="Tải lại lịch" loading={p.loading} icon={<Icon name="arrows-rotate" />} onClick={p.onReload} />
  </div>
 </div>;
}
