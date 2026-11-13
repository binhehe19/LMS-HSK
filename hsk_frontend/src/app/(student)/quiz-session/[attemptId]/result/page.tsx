import {Suspense} from "react";
import SessionResultPage from "@/components/student/timetable/session-result-page";
export default function Page(){return <Suspense fallback={<p>Đang tải kết quả…</p>}><SessionResultPage/></Suspense>;}
