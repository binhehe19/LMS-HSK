"use client";

import { Alert, Checkbox, Modal, Select } from "antd";
import { useRef, useState } from "react";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { importPackageResources, listManagedPackages, packageLinks, packageTitle, type PackageLink } from "@/lib/api/package-management-client";

export function PackageImportModal({ packageId, type, sessionNo, demo, hasLock, onClose, onAdded }: {
  packageId: string; type: string; sessionNo: number; demo: boolean; hasLock?: () => boolean; onClose: () => void; onAdded: () => void;
}) {
  const packages = useKeyedFetch(`import-packages:${type}`, () => listManagedPackages(type));
  const [sourceId, setSourceId] = useState<string>();
  const resources = useKeyedFetch(sourceId ? `import-resources:${sourceId}` : null, () => packageLinks(sourceId!));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const rows = resources.state.kind === "ok" ? resources.state.data : [];
  const label = (r: PackageLink) => r.resourceTitle || (r.resourceContent && typeof r.resourceContent === "object" ? String((r.resourceContent as Record<string, unknown>).title || (r.resourceContent as Record<string, unknown>).word || r.learningResourceId) : r.learningResourceId);
  const submit = async () => {
    if (lock.current || hasLock?.() === false) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await importPackageResources(packageId, rows.filter(r => selected.has(r.id)), sessionNo, demo);
      onAdded();
      if (result.failed.length) {
        setSelected(new Set(result.failed.map(r => r.id)));
        setError(`Đã nhập ${result.added} mục. ${result.failed.map(r => r.message).join("; ")}`);
      } else onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể nhập học liệu."); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Modal open title={`Nhập từ Kho / package khác — Buổi ${sessionNo}`} width={850} onCancel={() => !busy && onClose()} onOk={() => void submit()} confirmLoading={busy} okText={`Sao chép ${selected.size} mục`} okButtonProps={{ disabled: !selected.size || resources.state.kind !== "ok" || busy }}>
    <p>Chọn package để tham khảo nội dung. Các mục được chọn sẽ thành resource riêng trong buổi hiện tại.</p>
    {packages.state.kind === "error" && <Alert type="error" message="Không tải được package" action={<button onClick={packages.reload}>Thử lại</button>} />}
    <Select aria-label="Package nguồn" showSearch optionFilterProp="label" style={{ width: "100%" }} value={sourceId} disabled={busy} loading={packages.state.kind === "loading"} placeholder="Chọn package nguồn" options={packages.state.kind === "ok" ? packages.state.data.filter(p => p.id !== packageId).map(p => ({ value: p.id, label: `${packageTitle(p)} — ${p.syllabusId ? "Đã gắn giáo trình" : "Kho tự do"}` })) : []} onChange={id => { setSourceId(id); setSelected(new Set()); setError(""); }} />
    {error && <Alert type="error" message={error} className="mt-3" />}
    {resources.state.kind === "loading" && <p role="status">Đang tải học liệu…</p>}
    {resources.state.kind === "error" && <Alert type="error" message="Không tải được học liệu" action={<button onClick={resources.reload}>Thử lại</button>} />}
    {resources.state.kind === "ok" && !rows.length && <p>Package chưa có học liệu.</p>}
    <div style={{ maxHeight: 450, overflowY: "auto" }}>
      {rows.map(row => <div className="border-bottom py-2" key={row.id}>
        <Checkbox disabled={busy} checked={selected.has(row.id)} onChange={e => setSelected(prev => { const next = new Set(prev); if (e.target.checked) next.add(row.id); else next.delete(row.id); return next; })}>Buổi {row.sessionNo}: {label(row)}</Checkbox>
        <details><summary>Xem nội dung</summary><pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(row.resourceContent, null, 2)}</pre></details>
      </div>)}
    </div>
  </Modal>;
}
