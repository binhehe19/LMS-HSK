"use client";
import {useCallback,useEffect} from "react";
import {useParams,useSearchParams,useRouter} from "next/navigation";
import StudentShell from "../dashboard/student-shell";
import {useStudentIdentity,useStudentRequest} from "../student-data";
import {safeTimetableReturn} from "./lesson-navigation";
import {loadSessionResult} from "./session-result-source";
import SessionResultView from "./session-result-view";
export default function SessionResultPage(){const {user}=useStudentIdentity();return <ResultContent key={user?.id ?? "anonymous"}/>;}
function ResultContent(){
 const {attemptId}=useParams<{attemptId:string}>(),params=useSearchParams(),router=useRouter(),identity=useStudentIdentity();
 const classId=params.get("classId") || "",sessionId=params.get("sessionId") || "",syllabusId=params.get("syllabusId") || "",scheduleId=params.get("scheduleId") || "",sessionNo=Number(params.get("sessionNo"));
 const admin=identity.user?.roles.includes("ROLE_ADMIN") ?? false;
 const request=useStudentRequest(useCallback(()=>loadSessionResult(attemptId,classId && sessionId?{classId,sessionId,syllabusId,scheduleId,sessionNo}:null,admin),[attemptId,classId,sessionId,syllabusId,scheduleId,sessionNo,admin]),!!identity.user);
 const reload=request.reload;
 useEffect(()=>{const intervals=request.data?.sections.map(s=>s.data.nextPollMs).filter((n):n is number=>typeof n==="number" && n>0) ?? [];if(!intervals.length)return;const timer=setTimeout(reload,Math.min(30000,Math.max(1000,Math.min(...intervals))));return ()=>clearTimeout(timer);},[request.data,reload]);
 const back=()=>router.push(safeTimetableReturn(params.get("returnUrl")));
 return <StudentShell fullWidth>{request.loading?<div className="session-result-page" role="status">Đang tải kết quả bài làm…</div>:request.error?<div className="session-result-page" role="alert"><p>{request.error}</p><button type="button" onClick={request.reload}>Thử lại</button><button type="button" onClick={back}>Quay lại</button></div>:request.data?<SessionResultView data={request.data} onBack={back}/>:null}</StudentShell>;
}
