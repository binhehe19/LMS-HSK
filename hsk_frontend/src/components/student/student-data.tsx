"use client";
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { studentApi, type StudentClass, type LearningOrbit, type PracticeHistory, type DictionarySession } from "@/lib/api/student-client";
import { useAppSelector } from "@/redux/hooks";

export interface Remote<T> { data: T | null; loading: boolean; error: string | null; reload?: () => void }
const initial = <T,>(): Remote<T> => ({ data: null, loading: true, error: null });
export function useStudentRequest<T>(request: () => Promise<T>, enabled = true): Remote<T> & { reload: () => void } {
 const [state, setState] = useState<Remote<T>>(initial);
 const [revision, setRevision] = useState(0);
 useEffect(() => {
  if (!enabled) return;
  let active = true;
  Promise.resolve().then(() => { if (active) setState(initial()); }).then(request)
   .then(data => { if (active) setState({ data, loading: false, error: null }); })
   .catch((error: unknown) => { if (active) setState({ data: null, loading: false, error: error instanceof Error ? error.message : "Không tải được dữ liệu." }); });
  return () => { active = false; };
 }, [request, enabled, revision]);
 return { ...state, reload: useCallback(() => setRevision(value => value + 1), []) };
}
export interface HistoryEntry extends PracticeHistory { moduleType: string }
async function loadClasses() {
 const classes = await studentApi.classes();
 const details = await Promise.allSettled(classes.map(item => studentApi.classDetail(item.id)));
 return classes.map((item, index) => {
  const result = details[index];
  return result.status === "fulfilled" ? result.value : { ...item, detailError: result.reason instanceof Error ? result.reason.message : "Không tải được buổi học." };
 });
}
async function loadHistory() {
 const requests = ["READING", "LISTENING", "WRITING", "SPEAKING", "QUIZ"].map(type => studentApi.history(type).then(items => items.map(item => ({ ...item, moduleType: type }))));
 const results = await Promise.allSettled(requests);
 const items: HistoryEntry[] = [];
 const warnings: string[] = [];
 results.forEach((result, index) => {
  if (result.status === "fulfilled") items.push(...result.value);
  else warnings.push(`Không tải được lịch sử ${["Đọc", "Nghe", "Viết", "Nói", "Bài tập"][index]}. ${result.reason instanceof Error ? result.reason.message : ""}`);
 });
 return { items: items.sort((a,b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")), warnings };
}
const loadDictionary = async () => {
 // recentSessions(false) already includes completed sessions; do not count them twice.
 return studentApi.dictionarySessions(false);
};
interface StudentData {
 classes: Remote<StudentClass[]>; orbit: Remote<LearningOrbit>;
 history: Remote<{ items: HistoryEntry[]; warnings: string[] }>; dictionary: Remote<DictionarySession[]>;
}
const Context = createContext<StudentData | null>(null);
export function StudentDataProvider({ children }: { children: ReactNode }) {
 const path = usePathname();
 const dashboard = path.endsWith("student-dashboard");
 const historyPage = path.endsWith("student-quiz");
 const classes = useStudentRequest(loadClasses, dashboard || path.endsWith("student-courses"));
 const orbit = useStudentRequest(studentApi.orbit, dashboard);
 const history = useStudentRequest(loadHistory, dashboard || historyPage);
 const dictionary = useStudentRequest(loadDictionary, dashboard || historyPage);
 return <Context.Provider value={{ classes, orbit, history, dictionary }}>{children}</Context.Provider>;
}
export function useStudentData() {
 const data = useContext(Context);
 if (!data) throw new Error("StudentDataProvider is required");
 return data;
}
export function useStudentIdentity() {
 const user = useAppSelector(state => state.auth.user);
 return { name: user?.fullName || user?.email || "Học viên", avatarUrl: user?.avatarUrl || "/assets/figma-home/0e447.png", user };
}
export function DataStatus({ state, empty = false }: { state: Remote<unknown>; empty?: boolean }) {
 if (state.loading) return <p role="status" className="text-muted">Đang tải dữ liệu…</p>;
 if (state.error) return <div role="alert" className="text-danger mb-3">{state.error}{state.reload && <button className="btn btn-outline-danger btn-sm ms-2" onClick={state.reload}>Thử lại</button>}</div>;
 if (empty) return <p className="text-muted">Chưa có dữ liệu.</p>;
 return null;
}
