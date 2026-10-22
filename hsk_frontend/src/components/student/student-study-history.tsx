"use client";
import { useState, useCallback } from "react";
import StudentShell from "./dashboard/student-shell";
import { useStudentData, DataStatus, useStudentRequest, type HistoryEntry } from "./student-data";
import { studentApi } from "@/lib/api/student-client";
import NativeModal from "./native-modal";
const labels: Record<string, string> = { READING: "Đọc", LISTENING: "Nghe", WRITING: "Viết", SPEAKING: "Nói", QUIZ: "Bài tập" };
function AttemptResult({ item }: { item: HistoryEntry }) {
 const request = useCallback(() => studentApi.result(item.attemptId), [item.attemptId]);
 const result = useStudentRequest(request, item.status !== "IN_PROGRESS");
 if (item.status === "IN_PROGRESS") return <p>Bài đang làm dở. Màn làm bài tương ứng chưa được chuyển sang frontend này.</p>;
 return <><DataStatus state={result} />{result.data && <><p>Trạng thái chấm: {String(result.data.gradingStatus ?? item.gradingStatus ?? "Chưa có dữ liệu")}</p><p>Điểm: {String(result.data.earnedPoints ?? item.earnedPoints ?? "—")} / {String(result.data.totalPoints ?? item.totalPoints ?? "—")}</p></>}</>;
}
function StudyHistoryContent() {
 const { history, dictionary } = useStudentData();
 const [selected, setSelected] = useState<HistoryEntry | null>(null);
 const items = history.data?.items ?? [];
 const done = items.filter(item => item.status !== "IN_PROGRESS").length;
 return <>
  <h1 className="student-page-heading">Lịch sử ôn luyện</h1>
  <div className="premium-card mb-4"><h2 className="h6">Các nội dung đã và đang học của bạn</h2><p className="mb-0">Đang làm: {items.length - done} · Đã kết thúc: {done}</p><p className="small text-muted mt-2 mb-0">Lịch sử tự luyện từ API hiện có; chưa bao gồm mọi module học trong lớp.</p></div>
  <DataStatus state={history} />
  {history.data?.warnings.map(warning => <p role="alert" className="text-danger" key={warning}>{warning}</p>)}
  {Object.entries(labels).map(([type, label]) => {
   const entries = items.filter(item => item.moduleType === type);
   if (!entries.length) return null;
   return <section key={type} className="mb-4"><h2 className="h6">{label} · {entries.length} lượt làm</h2>
    {entries.map(item => <button type="button" key={item.attemptId} className="premium-card d-block w-100 text-start mb-3" onClick={() => setSelected(item)}>
     <h3 className="h6">{item.test.title || "Bài tự luyện"}</h3>
     <span className={`badge ${item.status === "IN_PROGRESS" ? "bg-warning" : "bg-success"}`}>{item.status === "IN_PROGRESS" ? "Đang làm" : "Đã kết thúc"}</span>
     <span className="text-muted small ms-3">{item.updatedAt ? new Date(item.updatedAt).toLocaleString("vi-VN") : ""}</span>
     <p className="mb-0 mt-2">Điểm: {item.earnedPoints ?? "—"} / {item.totalPoints ?? "—"}</p>
    </button>)}
   </section>;
  })}
  {!history.loading && !history.error && !items.length && <p>Chưa có lịch sử tự luyện.</p>}
  <section><h2 className="h6">Lịch sử học từ vựng</h2><DataStatus state={dictionary} empty={dictionary.data?.length === 0} />
   {dictionary.data?.map(item => <div key={`${item.lessonId}-${item.review}`} className="premium-card mb-3"><h3 className="h6">Bài từ vựng {item.lessonId}</h3><p>{item.session.completed ? "Đã hoàn thành" : "Đang học"} · {item.session.known?.length ?? 0}/{item.session.ids?.length ?? 0} từ đã biết</p><small>{item.session.completedAt || item.session.startedAt ? new Date(item.session.completedAt || item.session.startedAt!).toLocaleString("vi-VN") : ""}</small></div>)}
  </section>
  <NativeModal show={!!selected} onHide={() => setSelected(null)} title={selected?.test.title || "Chi tiết lượt làm"}>{selected && <AttemptResult key={selected.attemptId} item={selected} />}</NativeModal>
 </>;
}
export default function StudentStudyHistory() { return <StudentShell profileHeader><StudyHistoryContent /></StudentShell>; }
