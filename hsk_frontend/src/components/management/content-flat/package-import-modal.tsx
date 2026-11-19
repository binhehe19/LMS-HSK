"use client";

import { Alert, Checkbox, Input, Modal, Select, Tabs } from "antd";
import { useRef, useState } from "react";
import { CatalogPagination } from "./catalog-pagination";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { listGrammarLibrary } from "@/lib/api/lms-grammar-client";
import { importPackageResources, listManagedPackages, packageLinks, packageResourceTitle, packageTitle, type PackageResourceSource } from "@/lib/api/package-management-client";
import { DEFAULT_CATALOG_PAGE_SIZE } from "@/lib/content/catalog-page-sizes";

export function PackageImportModal({ packageId, type, sessionNo, demo, hasLock, onClose, onAdded }: {
  packageId: string; type: string; sessionNo: number; demo: boolean; hasLock?: () => boolean; onClose: () => void; onAdded: () => void;
}) {
  const supportsLibrary = type === "GRAMMAR";
  const [source, setSource] = useState(supportsLibrary ? "library" : "package");
  const fromLibrary = source === "library";
  const [keyword, setKeyword] = useState("");
  const [pagination, setPagination] = useState({ page: 1, size: DEFAULT_CATALOG_PAGE_SIZE });
  const packages = useKeyedFetch(fromLibrary ? null : `import-packages:${type}`, () => listManagedPackages(type));
  const [sourceId, setSourceId] = useState<string>();
  const resources = useKeyedFetch(!fromLibrary && sourceId ? `import-resources:${sourceId}` : null, () => packageLinks(sourceId!));
  const library = useKeyedFetch(fromLibrary ? JSON.stringify([keyword, pagination]) : null,
    () => listGrammarLibrary({ ...pagination, keyword, publishedOnly: true }));
  const [selected, setSelected] = useState<Map<string, PackageResourceSource>>(new Map());
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const libraryPage = library.state.kind === "ok" ? library.state.data : null;
  const rows: PackageResourceSource[] = fromLibrary
    ? libraryPage?.items.filter(item => item.content).map(item => ({
        id: item.id, learningResourceId: item.id, resourceType: "GRAMMAR", subType: "ZH", resourceContent: item.content, resourceTitle: item.point.title,
      })) ?? []
    : resources.state.kind === "ok" ? resources.state.data : [];
  const state = fromLibrary ? library.state : resources.state;
  const hasSource = fromLibrary || !!sourceId;
  const submit = async () => {
    if (!selected.size || lock.current || hasLock?.() === false) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await importPackageResources(packageId, [...selected.values()], sessionNo, demo);
      onAdded();
      if (result.failed.length) {
        const failed = new Set(result.failed.map(r => r.id));
        setSelected(new Map([...selected].filter(([id]) => failed.has(id))));
        setError(`Đã nhập ${result.added} mục. ${result.failed.map(r => r.message).join("; ")}`);
      } else onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể nhập học liệu."); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Modal open title={`Sao chép học liệu vào Buổi ${sessionNo}`} width={850} onCancel={() => !busy && onClose()} onOk={() => void submit()} confirmLoading={busy} okText={`Sao chép ${selected.size} mục`} okButtonProps={{ disabled: !selected.size || state.kind !== "ok" || busy }}>
    {supportsLibrary && <Tabs activeKey={source} onChange={key => { setSource(key); setSelected(new Map()); setError(""); }} items={[
      { key: "library", label: "Từ kho ngữ pháp", disabled: busy },
      { key: "package", label: "Học phần khác", disabled: busy },
    ]} />}
    <p>Các mục được chọn sẽ được sao chép riêng vào buổi hiện tại.</p>
    {fromLibrary
      ? <Input.Search aria-label="Tìm trong kho ngữ pháp" placeholder="Tìm trong kho ngữ pháp" defaultValue={keyword} allowClear disabled={busy}
          onSearch={value => { setKeyword(value.trim()); setPagination({ page: 1, size: pagination.size }); }} />
      : <>
          <FetchStateNotice state={packages.state} waitingText="Chưa kết nối API học phần." onRetry={packages.reload} />
          <Select aria-label="Học phần nguồn" showSearch optionFilterProp="label" style={{ width: "100%" }} value={sourceId} disabled={busy} loading={packages.state.kind === "loading"} placeholder="Chọn học phần nguồn" options={packages.state.kind === "ok" ? packages.state.data.filter(p => p.id !== packageId).map(p => ({ value: p.id, label: `${packageTitle(p)} — ${p.syllabusId ? "Đã gắn giáo trình" : "Chưa gắn giáo trình"}` })) : []} onChange={id => { setSourceId(id); setSelected(new Map()); setError(""); }} />
        </>}
    {error && <Alert type="error" message={error} className="mt-3" />}
    {hasSource && state.kind === "loading" && <p role="status">Đang tải học liệu…</p>}
    {hasSource && <FetchStateNotice<unknown> state={state} waitingText="Chưa kết nối API học liệu." onRetry={fromLibrary ? library.reload : resources.reload} />}
    {state.kind === "ok" && !rows.length && <p>{fromLibrary ? "Không tìm thấy điểm ngữ pháp đã xuất bản." : "Học phần chưa có học liệu."}</p>}
    <div style={{ maxHeight: 450, overflowY: "auto" }}>
      {rows.map(row => <div className="border-bottom py-2" key={row.id}>
        <Checkbox disabled={busy} checked={selected.has(row.id)} onChange={e => setSelected(prev => { const next = new Map(prev); if (e.target.checked) next.set(row.id, row); else next.delete(row.id); return next; })}>
          {row.sessionNo ? `Buổi ${row.sessionNo}: ` : ""}{packageResourceTitle(row)}
        </Checkbox>
        <details><summary>Xem nội dung</summary><pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(row.resourceContent, null, 2)}</pre></details>
      </div>)}
    </div>
    {libraryPage && !busy && <CatalogPagination {...pagination} total={libraryPage.total_elements} showQuickJumper={false}
      onChange={(page, size) => setPagination({ page, size })} />}
  </Modal>;
}
