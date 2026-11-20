"use client";

import { Alert, Checkbox, Input, Modal, Select, Tabs } from "antd";
import { useRef, useState } from "react";
import { CatalogPagination } from "./catalog-pagination";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { searchPublishedVocabularies } from "@/lib/api/lms-dictionary-client";
import { listGrammarLibrary } from "@/lib/api/lms-grammar-client";
import { importPackageResources, listManagedPackages, packageLinks, packageResourceTitle, packageTitle, type PackageResourceSource } from "@/lib/api/package-management-client";
import { DEFAULT_CATALOG_PAGE_SIZE } from "@/lib/content/catalog-page-sizes";
import { primaryPinyin } from "@/lib/dictionary/vocabulary-model";
import type { VocabularyZhContent } from "@/types/vocabulary-zh-content";

type PickerRow = PackageResourceSource & { pinyin?: string; meaningVi?: string; sourceLabel?: string };
const scrollArea = { maxHeight: "min(360px, 45vh)", overflowY: "auto" } as const;

function pickerLabel(row: PickerRow) {
  return [packageResourceTitle(row), row.meaningVi?.trim()].filter(Boolean).join(" · ");
}

export function PackageImportModal({ packageId, type, sessionNo, demo, hasLock, write, onClose, onAdded }: {
  packageId: string; type: string; sessionNo: number; demo: boolean; hasLock?: () => boolean; write?: <T>(action: () => Promise<T>) => Promise<T>; onClose: () => void; onAdded: () => void;
}) {
  const dictionary = type === "VOCABULARY";
  const supportsLibrary = dictionary || type === "GRAMMAR";
  const libraryLabel = dictionary ? "Từ điển" : "Từ kho ngữ pháp";
  const searchLabel = dictionary ? "Tìm Hán tự, Pinyin hoặc bộ thủ" : "Tìm trong kho ngữ pháp";
  const [source, setSource] = useState(supportsLibrary ? "library" : "package");
  const fromLibrary = source === "library";
  const [keyword, setKeyword] = useState("");
  const [pagination, setPagination] = useState({ page: 1, size: DEFAULT_CATALOG_PAGE_SIZE });
  const packages = useKeyedFetch(fromLibrary ? null : `import-packages:${type}`, () => listManagedPackages(type));
  const [sourceId, setSourceId] = useState<string>();
  const resources = useKeyedFetch(!fromLibrary && sourceId ? `import-resources:${sourceId}` : null, () => packageLinks(sourceId!));
  const library = useKeyedFetch(fromLibrary ? JSON.stringify([type, keyword, pagination]) : null, async () => {
    if (dictionary) {
      const result = await searchPublishedVocabularies({ keySearch: keyword, page: pagination.page - 1, size: pagination.size });
      const rows: PickerRow[] = result.items.map(word => {
        const pinyin = primaryPinyin(word);
        return {
          id: word.id, learningResourceId: word.id, resourceType: type, subType: "ZH",
          resourceContent: null, resourceTitle: word.hanzi, fromDictionary: true, sourceLabel: libraryLabel,
          pinyin: pinyin?.pinyin, meaningVi: pinyin?.meanings?.find(item => item.meaning?.trim())?.meaning,
        };
      });
      return { rows, total: result.totalElements };
    }
    const result = await listGrammarLibrary({ ...pagination, keyword, publishedOnly: true });
    const rows: PickerRow[] = result.items.filter(item => item.content).map(item => ({
      id: item.id, learningResourceId: item.id, resourceType: type, subType: "ZH",
      resourceContent: item.content, resourceTitle: item.point.title, sourceLabel: "Kho ngữ pháp",
    }));
    return { rows, total: result.total_elements };
  });
  const [selected, setSelected] = useState<Map<string, PickerRow>>(new Map());
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const libraryPage = library.state.kind === "ok" ? library.state.data : null;
  const packageLabel = packages.state.kind === "ok"
    ? packages.state.data.find(item => item.id === sourceId)
    : undefined;
  const rows: PickerRow[] = fromLibrary
    ? libraryPage?.rows ?? []
    : resources.state.kind === "ok" ? resources.state.data.map(row => {
        const content = row.resourceType === "VOCABULARY" ? row.resourceContent as VocabularyZhContent | null : null;
        const readings = content?.pinyins;
        const pinyin = readings?.find(item => item.isPrimary) ?? readings?.[0];
        return {
          ...row, sourceLabel: packageLabel ? packageTitle(packageLabel) : "Học phần khác",
          pinyin: pinyin?.pinyin, meaningVi: pinyin?.meanings?.find(item => item.meaningVi?.trim())?.meaningVi,
        };
      }) : [];
  const state = fromLibrary ? library.state : resources.state;
  const hasSource = fromLibrary || !!sourceId;
  const selectRow = (row: PickerRow, checked: boolean) => setSelected(previous => {
    const next = new Map(previous);
    if (checked) next.set(row.id, row);
    else next.delete(row.id);
    return next;
  });
  const submit = async () => {
    if (!selected.size || lock.current || hasLock?.() === false) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const action = () => importPackageResources(packageId, [...selected.values()], sessionNo, demo);
      const result = await (write ? write(action) : action());
      if (result.added) onAdded();
      if (result.failed.length) {
        const failed = new Set(result.failed.map(r => r.id));
        setSelected(new Map([...selected].filter(([id]) => failed.has(id))));
        setError(`Đã sao chép ${result.added} mục. ${result.failed.map(r => {
          const row = selected.get(r.id);
          return row ? `${packageResourceTitle(row)}: ${r.message}` : r.message;
        }).join(" ")}`);
      } else onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể nhập học liệu."); }
    finally { lock.current = false; setBusy(false); }
  };
  const picker = <>
    {fromLibrary
      ? <Input.Search aria-label={searchLabel} placeholder={searchLabel} defaultValue={keyword} allowClear disabled={busy}
          onSearch={value => { setKeyword(value.trim()); setPagination({ page: 1, size: pagination.size }); }} />
      : <>
          <FetchStateNotice state={packages.state} waitingText="Chưa kết nối API học phần." onRetry={packages.reload} />
          <Select aria-label="Học phần nguồn" showSearch optionFilterProp="label" style={{ width: "100%" }} value={sourceId} disabled={busy} loading={packages.state.kind === "loading"} placeholder="Chọn học phần nguồn" options={packages.state.kind === "ok" ? packages.state.data.filter(p => p.id !== packageId).map(p => ({ value: p.id, label: `${packageTitle(p)} — ${p.syllabusId ? "Đã gắn giáo trình" : "Chưa gắn giáo trình"}` })) : []} onChange={setSourceId} />
        </>}
    {hasSource && state.kind === "loading" && <p className="text-muted mt-3" role="status">Đang tải học liệu…</p>}
    {hasSource && <FetchStateNotice<unknown> state={state} className="mt-2" waitingText="Chưa kết nối API học liệu." onRetry={fromLibrary ? library.reload : resources.reload} />}
    {state.kind === "ok" && !rows.length && <p className="text-muted mt-3">{fromLibrary
      ? (dictionary ? "Không tìm thấy từ phù hợp." : "Không tìm thấy điểm ngữ pháp đã xuất bản.")
      : "Học phần chưa có học liệu."}</p>}
    <div style={scrollArea}>
      {rows.map(row => <div className="border-bottom py-2 text-break" key={row.id}>
        <Checkbox disabled={busy} checked={selected.has(row.id)} onChange={e => selectRow(row, e.target.checked)}>
          {row.sessionNo ? `Buổi ${row.sessionNo}: ` : ""}{pickerLabel(row)}
          {row.pinyin && <small className="d-block text-muted">{row.pinyin}</small>}
        </Checkbox>
        {!row.fromDictionary && <details><summary>Xem nội dung</summary><pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(row.resourceContent, null, 2)}</pre></details>}
      </div>)}
    </div>
    {libraryPage && !busy && <CatalogPagination {...pagination} total={libraryPage.total} showQuickJumper={false} className="px-0"
      onChange={(page, size) => setPagination({ page, size })} />}
  </>;

  return <Modal open title={`Sao chép học liệu vào Buổi ${sessionNo}`} width={980} onCancel={() => !busy && onClose()} onOk={() => void submit()} confirmLoading={busy}
    okText={selected.size ? `Sao chép ${selected.size} mục` : "Sao chép"} okButtonProps={{ disabled: !selected.size || busy }}>
    <p className="text-muted">Học liệu được sao chép vào buổi này và có thể chỉnh sửa riêng.</p>
    {error && <Alert type="error" message={error} className="mb-3" />}
    <div className="row g-3">
      <div className="col-12 col-md-6">{supportsLibrary
        ? <Tabs activeKey={source} onChange={setSource} items={[
            { key: "library", label: libraryLabel, disabled: busy, children: fromLibrary ? picker : null },
            { key: "package", label: "Học phần khác", disabled: busy, children: fromLibrary ? null : picker },
          ]} />
        : picker}</div>
      <div className="col-12 col-md-6">
        <section className="h-100 rounded-3 border bg-light p-3 text-break" aria-label="Học liệu đã chọn">
          <h3 className="d-flex align-items-center justify-content-between fs-6 fw-bold mb-2">
            Đã chọn <span className="badge bg-white text-primary">{selected.size}</span>
          </h3>
          {selected.size ? <ul className="list-unstyled mb-0" style={scrollArea}>
            {[...selected.values()].map(row => <li className="d-flex align-items-center justify-content-between gap-2 border-top py-2" key={row.id}>
              <div>
                <strong>{pickerLabel(row)}</strong>
                <small className="d-block text-muted">{[row.pinyin, row.sourceLabel].filter(Boolean).join(" · ")}</small>
              </div>
              <button type="button" className="btn btn-sm btn-light flex-shrink-0" disabled={busy} aria-label={`Bỏ chọn ${packageResourceTitle(row)}`} onClick={() => selectRow(row, false)}>
                <i className="isax isax-close-circle" aria-hidden="true" />
              </button>
            </li>)}
          </ul> : <p className="text-muted mb-0">Chưa chọn học liệu nào.</p>}
        </section>
      </div>
    </div>
  </Modal>;
}
