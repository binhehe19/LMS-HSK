"use client";

import { Input, Modal, Select, Table, Tag, type TableColumnsType } from "antd";
import { useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { CatalogPagination } from "@/components/management/content-flat/catalog-pagination";
import { CatalogRowMenu } from "@/components/management/content-flat/catalog-row-menu";
import { CatalogToolbar } from "@/components/management/content-flat/catalog-toolbar";
import styles from "@/components/management/content-flat/content-catalog.module.css";
import { ContentItemModal } from "@/components/management/content-tree/content-item-modal";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { confirmAction } from "@/components/shared/confirm-action";
import { FetchStateNotice, WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import { useWriteGate } from "@/hooks/use-write-gate";
import { deleteGrammarLibraryEntry, getGrammarLibraryDraft, listGrammarLibrary, publishGrammarLibraryDraft, saveGrammarLibraryDraft, type GrammarLibraryEntry } from "@/lib/api/lms-grammar-client";
import { syncPublishedToPackages } from "@/lib/api/library-sync-client";
import { DEFAULT_CATALOG_PAGE_SIZE } from "@/lib/content/catalog-page-sizes";
import { writeErrorMessage } from "@/lib/content/content-tree-validate";
import { HSK_LEVEL_OPTIONS, emptyGrammarPointInput, grammarPointToInput, normalizeGrammarPointInput } from "@/lib/content/grammar-point";
import { GRAMMAR_CONFIG } from "./grammar-config";
import { GrammarPointForm } from "./grammar-point-form";

const LEVELS = HSK_LEVEL_OPTIONS.map(value => ({ value, label: `HSK ${value}` }));

export function GrammarLibraryPageContent() {
  const { enabled: canWrite, demo } = useWriteGate("content");
  const [keyword, setKeyword] = useState("");
  const [level, setLevel] = useState<string>();
  const [pagination, setPagination] = useState({ page: 1, size: DEFAULT_CATALOG_PAGE_SIZE });
  const [editor, setEditor] = useState<{ entry: GrammarLibraryEntry | null } | null>(null);
  const [viewing, setViewing] = useState<GrammarLibraryEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const { page, size } = pagination;
  const list = useKeyedFetch(JSON.stringify([keyword, level, page, size]), () => listGrammarLibrary({ keyword, level, page, size }));
  const rows = list.state.kind === "ok" ? list.state.data.items : [];

  // `?edit=<id>`: link "Sửa trong Kho" từ học phần mở thẳng form sửa (một lần, khi đã có quyền ghi).
  const editId = useSearchParams().get("edit");
  const openedEditId = useRef<string | null>(null);
  const openLinkedEdit = useEffectEvent((id: string) => void run("Không tải được điểm ngữ pháp.", async () => {
    setEditor({ entry: await getGrammarLibraryDraft(id) });
  }));
  useEffect(() => {
    if (!editId || !canWrite || openedEditId.current === editId) return;
    openedEditId.current = editId;
    openLinkedEdit(editId);
  }, [editId, canWrite]);
  const loading = list.state.kind === "loading";

  async function run(fallback: string, work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await work();
    } catch (error) {
      toast.error(writeErrorMessage(error, fallback));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const columns: TableColumnsType<GrammarLibraryEntry> = [
    { title: "STT", key: "index", width: 68, align: "center", render: (_, __, index) => <span className={styles.rowNumber}>{(page - 1) * size + index + 1}</span> },
    ...GRAMMAR_CONFIG.itemColumns.filter(column => ["title", "hskLevel", "category", "generalDefinition"].includes(column.key)).map(({ key, title, width, render }) => ({
      key, title, width: key === "title" ? undefined : width,
      render: (_: unknown, row: GrammarLibraryEntry) => render(row.point),
    })),
    {
      title: "Trạng thái", key: "status", width: 155,
      render: (_, entry) => entry.publishedVersionId
        ? <Tag color="green">{entry.draftVersionId ? "Có bản nháp mới" : "Đã xuất bản"}</Tag>
        : <Tag>Chưa xuất bản</Tag>,
    },
    {
      key: "actions", width: 56, align: "center", fixed: "right",
      render: (_, entry) => <CatalogRowMenu label={`Thao tác ${entry.point.title}`} items={[
        { key: "view", label: "Xem chi tiết", onClick: () => setViewing(entry) },
        ...(canWrite ? [
          { key: "edit", label: "Chỉnh sửa", disabled: busy, onClick: () => void run("Không tải được điểm ngữ pháp.", async () => {
            setEditor({ entry: await getGrammarLibraryDraft(entry.id) });
          }) },
          ...(entry.draftVersionId ? [{ key: "publish", label: "Xuất bản", disabled: busy, onClick: () => void run("Không thể xuất bản.", async () => {
            const toastId = toast.loading("Đang xuất bản…");
            try {
              await publishGrammarLibraryDraft(entry, demo);
            } catch (error) {
              toast.dismiss(toastId);
              throw error;
            }
            list.reload();
            await syncPublishedToPackages(entry.id, toastId, "Đã xuất bản điểm ngữ pháp.");
          }) }] : []),
          { key: "delete", label: "Xóa", danger: true, disabled: busy, onClick: () => void run("Không thể xóa điểm ngữ pháp.", async () => {
            const confirmed = await confirmAction({ title: "Xóa điểm ngữ pháp", content: entry.point.title, okText: "Xóa", danger: true });
            if (!confirmed) return;
            await deleteGrammarLibraryEntry(entry.id, demo);
            if (rows.length === 1 && page > 1) setPagination({ page: page - 1, size });
            else list.reload();
            toast.success("Đã xóa điểm ngữ pháp.");
          }) },
        ] : []),
      ]} />,
    },
  ];

  return (
    <ManagementPageFrame>
      <div className={`${styles.catalog} p-3`}>
        <CatalogToolbar label="Bộ lọc kho ngữ pháp" heading="Kho ngữ pháp" icon="isax-book-1"
          description="Quản lý các điểm ngữ pháp HSK dùng chung cho học phần."
          loading={loading || busy} onReload={list.reload}
          actions={canWrite && <button type="button" disabled={busy} className={`btn btn-light rounded-pill ${styles.createButton}`} onClick={() => setEditor({ entry: null })}>
            <i className="isax isax-add" aria-hidden="true" />Thêm điểm ngữ pháp
          </button>}>
          <Input.Search className={styles.search} allowClear aria-label="Tìm điểm ngữ pháp" placeholder="Tìm điểm ngữ pháp"
            onSearch={value => { setKeyword(value.trim()); setPagination({ page: 1, size }); }} />
          <Select className={styles.filter} allowClear aria-label="Cấp độ HSK" placeholder="Tất cả cấp độ HSK" value={level} options={LEVELS}
            onChange={value => { setLevel(value); setPagination({ page: 1, size }); }} />
        </CatalogToolbar>
        {!canWrite && <WriteLockedNotice />}
        <section className={styles.panel} aria-label="Danh sách điểm ngữ pháp">
          {list.state.kind === "error" || list.state.kind === "waiting"
            ? <FetchStateNotice state={list.state} waitingText="Kho ngữ pháp chưa được kết nối API." onRetry={list.reload} />
            : <>
                <Table className={styles.table} columns={columns} dataSource={rows} rowKey="id" pagination={false}
                  loading={loading} scroll={{ x: 750 }} locale={{ emptyText: "Không tìm thấy điểm ngữ pháp" }} />
                <CatalogPagination page={page} size={size} total={list.lastData?.total_elements ?? 0} showQuickJumper={false}
                  onChange={(nextPage, nextSize) => setPagination({ page: nextPage, size: nextSize })} />
              </>}
        </section>
      </div>
      {editor && <ContentItemModal config={GRAMMAR_CONFIG} mode={editor.entry ? "edit" : "create"}
        initialValue={editor.entry ? grammarPointToInput(editor.entry.point) : emptyGrammarPointInput()}
        submitting={busy} onCancel={() => { if (!busy) setEditor(null); }}
        onSubmit={input => void run("Không thể lưu bản nháp.", async () => {
          await saveGrammarLibraryDraft(normalizeGrammarPointInput(input), editor.entry, demo);
          setEditor(null);
          if (!editor.entry && page > 1) setPagination({ page: 1, size });
          else list.reload();
          toast.success("Đã lưu bản nháp điểm ngữ pháp.");
        })} />}
      {viewing && <Modal open title={viewing.point.title} width={720} footer={null} onCancel={() => setViewing(null)}>
        <GrammarPointForm value={grammarPointToInput(viewing.point)} onChange={() => undefined} disabled idPrefix="grammar-library-view" />
      </Modal>}
    </ManagementPageFrame>
  );
}
