"use client";
import { useState, useCallback } from "react";
import { fetchNotifications, markNotificationRead } from "@/lib/api/notification-client";
import { useStudentRequest, DataStatus } from "./student-data";
import NativeModal from "./native-modal";
const load = () => fetchNotifications({ page: 0, size: 20 });
export default function StudentNotifications() {
 const [open, setOpen] = useState(false);
 const [page, setPage] = useState(0);
 const [error, setError] = useState("");
 const notifications = useStudentRequest(load);
 const pageRequest = useStudentRequest(useCallbackPage(page), open);
 const data = open ? pageRequest : notifications;
 return <>
  <button onClick={() => { setOpen(true); pageRequest.reload(); }} aria-label="Thông báo"><i aria-hidden="true" className="fa-solid fa-bell" />{(notifications.data?.unreadCount ?? 0) > 0 && <span className="notification-dot" />}</button>
  <NativeModal title="Thông báo" show={open} onHide={() => setOpen(false)}>
   <DataStatus state={data} empty={data.data?.items.length === 0} />
   {error && <p role="alert" className="text-danger">{error}</p>}
   {data.data?.items.map(item => <article key={item.id} className="border rounded-3 p-3 mb-3">
    <h3 className="h6">{item.title}</h3><p>{item.message}</p>
    <small>{new Date(item.createdAt).toLocaleString("vi-VN")}</small>
    {!item.read && <button className="btn btn-outline-danger btn-sm ms-3" onClick={async () => {
     try { await markNotificationRead(item.id); setError(""); notifications.reload(); pageRequest.reload(); }
     catch (e) { setError(e instanceof Error ? e.message : "Không đánh dấu đọc được."); }
    }}>Đánh dấu đã đọc</button>}
   </article>)}
   <div className="d-flex gap-3 align-items-center"><button disabled={page === 0} className="btn btn-light" onClick={() => setPage(page - 1)}>Trước</button><span>Trang {page + 1}</span><button disabled={page + 1 >= (data.data?.totalPages ?? 0)} className="btn btn-light" onClick={() => setPage(page + 1)}>Sau</button></div>
  </NativeModal>
 </>;
}
function useCallbackPage(page: number) { return useCallback(() => fetchNotifications({ page, size: 20 }), [page]); }
