"use client";

import { Alert, Select } from "antd";
import { useRef, useState } from "react";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { attachOrCopyPackage, listManagedPackages, packageTitle } from "@/lib/api/package-management-client";

const editors: Record<string, string> = { VOCABULARY: "/vocab-set/manage", ASSESSMENT: "/quiz/manage", GRAMMAR: "/grammar/manage", SLIDE: "/learning-path/lesson-materials/manage", MATERIAL: "/learning-path/lesson-materials/manage" };

export function SyllabusPackages({ syllabusId, canWrite, demo, onChanged }: { syllabusId: string; canWrite: boolean; demo: boolean; onChanged: () => void }) {
  const packages = useKeyedFetch(`syllabus-packages:${syllabusId}`, () => listManagedPackages());
  const [selected, setSelected] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const items = packages.state.kind === "ok" ? packages.state.data : [];
  const add = async () => {
    if (!selected || lock.current || !canWrite) return;
    lock.current = true; setBusy(true); setError("");
    try { await attachOrCopyPackage(selected, syllabusId, demo); setSelected(undefined); packages.reload(); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể gắn package."); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section className="border rounded p-3 mb-3" aria-label="Học phần của giáo trình">
    <h6>Học phần của giáo trình</h6><p className="small text-muted">Mở học phần để quản lý học liệu theo buổi và chủ đề. Học phần đã gắn giáo trình sẽ được sao chép; ưu tiên phiên bản đã xuất bản nếu có.</p>
    {packages.state.kind === "loading" && <p role="status">Đang tải học phần…</p>}
    {packages.state.kind === "error" && <Alert type="error" message="Không tải được học phần" action={<button onClick={packages.reload}>Thử lại</button>} />}
    {error && <Alert type="error" message={error} />}
    <ul>{items.filter(p => p.syllabusId === syllabusId).map(p => <li key={p.id}>{packageTitle(p)} ({p.type}) {editors[p.type] && <a href={`${editors[p.type]}?packageId=${encodeURIComponent(p.id)}`}>Mở học phần</a>}</li>)}</ul>
    {canWrite && <div className="d-flex gap-2">
      <Select aria-label="Học phần để gắn" showSearch optionFilterProp="label" style={{ flex: 1 }} disabled={busy} value={selected} placeholder="Chọn học phần" options={items.map(p => ({ value: p.id, label: `${packageTitle(p)} (${p.type}) — ${p.syllabusId ? "Tạo bản sao" : "Gắn trực tiếp"}` }))} onChange={setSelected} />
      <button className="btn btn-primary" disabled={!selected || busy} onClick={() => void add()}>{busy ? "Đang xử lý…" : "Gắn học phần"}</button>
    </div>}
  </section>;
}
