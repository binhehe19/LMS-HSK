/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import type { TimetableModule } from "./timetable-data";
import { plainText } from "./timetable-source";
import { safeResourceUrl } from "./lesson-source";
const names:Record<string,string>={word:"Từ vựng",pinyin:"Phiên âm",partOfSpeech:"Từ loại",commonMeaning:"Nghĩa thông dụng",meaning:"Nghĩa",definition:"Định nghĩa",generalDefinition:"Định nghĩa chung",structure:"Cấu trúc",explanation:"Giải thích",category:"Phân loại",content:"Nội dung",body:"Nội dung",text:"Nội dung",title:"Tiêu đề",description:"Mô tả",examples:"Ví dụ",example:"Ví dụ",en:"Câu ví dụ",zh:"Tiếng Trung",vi:"Tiếng Việt",translation:"Bản dịch",meaningVi:"Nghĩa tiếng Việt",sentence:"Câu",notes:"Ghi chú",items:"Nội dung",entries:"Danh sách",words:"Từ vựng",questions:"Câu hỏi",prompt:"Đề bài",stem:"Câu hỏi",options:"Lựa chọn",label:"Nhãn",value:"Nội dung",audioUrl:"Tệp âm thanh",imageUrl:"Hình ảnh"};
function Fields({value,depth=0}:{value:unknown;depth?:number}):ReactNode {
 if(value == null || depth>7)return null;
 if(typeof value === "string" || typeof value === "number")return <p>{plainText(String(value))}</p>;
 if(Array.isArray(value))return <div className="hsk-live-list">{value.map((item,index)=><div key={index}><Fields value={item} depth={depth+1} /></div>)}</div>;
 if(typeof value !== "object")return null;
 const fields=Object.entries(value).filter(([key,item])=>key in names && (depth > 0 || key !== "title") && item != null && item !== "");
 return fields.length?<dl className="hsk-live-fields">{fields.map(([key,item])=><div key={key}><dt>{names[key]}</dt><dd>{key === "audioUrl" && typeof item === "string" && safeResourceUrl(item)?<audio controls src={safeResourceUrl(item)!} />:key === "imageUrl" && typeof item === "string" && safeResourceUrl(item)?<img src={safeResourceUrl(item)!} alt="Hình ảnh học liệu" />:<Fields value={item} depth={depth+1} />}</dd></div>)}</dl>:<p>Học liệu đã được gắn nhưng chưa có nội dung hiển thị phù hợp.</p>;
}
export default function LessonResourceContent({resource,isAdmin}:{resource:TimetableModule;isAdmin:boolean}) {
 const url=safeResourceUrl(resource.url);const pathname=url?.split("?")[0].toLowerCase() || "";const pdf=pathname.endsWith(".pdf");const image=/\.(png|jpe?g|webp|gif|svg)$/.test(pathname);const audio=/\.(mp3|wav|ogg|m4a)$/.test(pathname);const video=/\.(mp4|webm)$/.test(pathname);
 return <article className="hsk-live-resource"><h3>{resource.title}</h3>{resource.publication === "DRAFT" && <p className="hsk-draft-label">Bản nháp · Chỉ admin xem được</p>}{url && <div className="hsk-live-resource-actions"><a href={url} target="_blank" rel="noopener noreferrer">Mở tài liệu gốc ↗</a></div>}{pdf && <iframe src={url!} title={resource.title} className="hsk-live-document" referrerPolicy="no-referrer" />}{image && <img className="hsk-live-image" src={url!} alt={resource.title} />}{audio && <audio controls src={url!} />}{video && <video controls src={url!} />}
 {resource.content != null ? <Fields value={resource.content} />:resource.description?<p>{resource.description}</p>:resource.resourceType === "ASSESSMENT"?<p>Bài tập đã được gắn. Nội dung đề được backend giữ kín cho đến khi bắt đầu bài làm.</p>:!url?<p>Học liệu chưa có đường dẫn hoặc nội dung.</p>:null}
 {isAdmin && resource.resourceType === "ASSESSMENT" && <p className="text-muted small">Bạn đang xem nội dung quản trị; chưa tạo bài làm học viên.</p>}
 </article>;
}
