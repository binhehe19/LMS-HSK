"use client";
import { Input, Modal, Select } from "antd";
import { SessionHeading } from "./session-heading";
import { TopicTitleModal } from "@/components/management/syllabus/topic-title-modal";
import { ManagementBackButton } from "@/components/management/management-back-button";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { packageLinks } from "@/lib/api/package-management-client";
import { clearPackageSession, listPackageSessionNames, renamePackageSession } from "@/lib/api/package-sessions-client";
import { writeErrorMessage } from "@/lib/content/content-tree-validate";
import { listSyllabuses } from "@/lib/api/lms-syllabus-client";
import type { ContentPackage, ContentPackageInput, FlatTopicUi } from "@/types/content";
import styles from "./package-workspace.module.css";

export function PackageWorkspace({ pkg, sessionNo, onSession, busy, canWrite, canPublish, demo = false, itemCount, topicUi, onSave, onCopy, onBack, onImport, onCreate, children }: {
  pkg: ContentPackage; sessionNo: number; onSession: (n: number) => void; busy: boolean; canWrite: boolean; itemCount: number;
  canPublish: boolean;
  /** Công tắc ghi giả lập của giao diện (truyền cho client ghi tên buổi). */
  demo?: boolean;
  topicUi?: FlatTopicUi;
  onSave: (input: ContentPackageInput, publish?: boolean) => Promise<boolean>;
  onCopy: (syllabusId: string) => Promise<boolean>;
  onBack: () => void; onImport: () => void; onCreate: () => void; children: ReactNode;
}) {
  const [name, setName] = useState(pkg.name);
  const [description, setDescription] = useState(pkg.description ?? "");
  const [pendingSyllabus, setPendingSyllabus] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [topicCreateOpen, setTopicCreateOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySyllabus, setCopySyllabus] = useState<string>();
  const lock = useRef(false);
  const syllabusId = pkg.syllabusId ?? pendingSyllabus;
  const syllabusChoices = useKeyedFetch(pkg.syllabusId || canWrite ? "package-syllabuses" : null, listSyllabuses);
  const syllabusOptions = syllabusChoices.state.kind === "ok"
    ? syllabusChoices.state.data.map(s => ({ value: s.id, label: s.name || s.code || s.id }))
    : [];
  const dirty = name !== pkg.name || description !== (pkg.description ?? "") || (!pkg.syllabusId && !!pendingSyllabus);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const resources = useKeyedFetch(`package-sessions:${pkg.id}:${sessionNo}:${itemCount}`, () => packageLinks(pkg.id));
  const rows = resources.state.kind === "ok" ? resources.state.data : [];
  // Tên buổi là tùy chọn: tải lỗi thì chỉ hiện "Buổi n", không chặn việc soạn.
  const sessionNames = useKeyedFetch(`package-session-names:${pkg.id}`, () => listPackageSessionNames(pkg.id));
  const names: Record<number, string> = sessionNames.state.kind === "ok" ? sessionNames.state.data : (sessionNames.lastData ?? {});
  const total = Math.max(1, pkg.sessionCount ?? 1, sessionNo, ...rows.map(r => r.sessionNo));
  const blocked = busy || saving;
  // Ghi thẳng lên bản nháp; tên rỗng = xóa tên. Lỗi được báo rồi ném lại để ô nhập không đóng.
  const renameSession = async (no: number, title: string) => {
    try {
      if (title) await renamePackageSession(pkg.id, no, title, demo);
      else await clearPackageSession(pkg.id, no, demo);
    } catch (error) {
      toast.error(writeErrorMessage(error, "Không lưu được tên buổi."));
      throw error;
    }
    sessionNames.reload();
  };
  const save = async (count = total, mode: "session" | "draft" | "publish" = "session") => {
    if (blocked || lock.current || !name.trim()) return false;
    lock.current = true;
    setSaving(true);
    try {
      return await onSave({ name, description, type: pkg.type, sessionCount: count, syllabusId: mode !== "session" && !pkg.syllabusId ? pendingSyllabus : undefined }, mode === "publish");
    }
    finally { lock.current = false; setSaving(false); }
  };
  return <div className={styles.workspace}>
    <div className={styles.toolbar}>
      <div className="d-flex align-items-center flex-wrap gap-3">
        <ManagementBackButton
          disabled={blocked}
          onClick={() => {
            if (!dirty || window.confirm("Thông tin chưa lưu. Bạn có muốn rời màn hình?")) onBack();
          }}
        />
        <h4 className={styles.pageTitle}>Soạn học phần</h4>
      </div>
      {canWrite && (
        <div className={styles.actions}>
          <button type="button" className={`btn btn-outline-primary ${styles.save}`} disabled={blocked} onClick={() => { setCopySyllabus(pkg.syllabusId ?? undefined); setCopyOpen(true); }}>Tạo bản sao</button>
          <button type="button" className={`btn btn-outline-primary ${styles.save}`} disabled={blocked || !name.trim()} onClick={() => void save(total, "draft")}>Lưu nháp</button>
          {canPublish && <button type="button" className={`btn btn-primary ${styles.save}`} disabled={blocked || !name.trim()} onClick={() => void save(total, "publish")}>Lưu & Xuất bản</button>}
        </div>
      )}
    </div>
    <section className={styles.details} aria-label="Thông tin học phần">
      <div className={styles.toolbar}>
        <h5 className={styles.sectionTitle}><i className="isax isax-edit-2" aria-hidden="true" />Thông tin học phần</h5>
      </div>
      <div className={styles.metadataRow}>
        <div className={styles.field}>
          <label htmlFor="package-editor-name">Tên học phần</label>
          <Input id="package-editor-name" className={styles.nameInput} value={name} disabled={!canWrite || blocked} onChange={e => setName(e.target.value)} />
        </div>
        <div className={styles.field}>
          <label htmlFor="package-editor-syllabus">Giáo trình</label>
          <Select
            id="package-editor-syllabus"
            aria-label="Giáo trình"
            className={styles.syllabusSelect}
            value={syllabusId}
            placeholder="Chưa gắn giáo trình"
            options={syllabusOptions}
            labelRender={({ label, value }) => label ?? String(value)}
            allowClear={!pkg.syllabusId}
            showSearch
            optionFilterProp="label"
            loading={syllabusChoices.state.kind === "loading"}
            disabled={!canWrite || blocked || !!pkg.syllabusId || syllabusChoices.state.kind !== "ok"}
            onChange={setPendingSyllabus}
          />
          {syllabusChoices.state.kind === "error" && (
            <button type="button" className="btn btn-link btn-sm p-0 text-start" onClick={syllabusChoices.reload}>Thử tải lại giáo trình</button>
          )}
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="package-editor-description">Mô tả</label>
        <textarea id="package-editor-description" rows={2} className={`form-control ${styles.description}`} placeholder="Mô tả mục tiêu, nội dung học phần…" value={description} disabled={!canWrite || blocked} onChange={e => setDescription(e.target.value)} />
      </div>
    </section>
    {copyOpen && canWrite && (
      <Modal
        open
        title="Tạo bản sao học phần"
        okText="Tạo bản sao"
        cancelText="Hủy"
        onCancel={() => { if (!blocked) setCopyOpen(false); }}
        confirmLoading={blocked}
        okButtonProps={{ disabled: blocked || !copySyllabus || syllabusChoices.state.kind !== "ok" }}
        onOk={async () => { if (copySyllabus && !blocked && await onCopy(copySyllabus)) setCopyOpen(false); }}
      >
        <p>Bản sao được tạo ở dạng nháp từ phiên bản đã xuất bản, hoặc từ bản nháp nếu học phần chưa từng xuất bản.</p>
        {dirty && <p className="text-warning">Các thay đổi chưa lưu trên màn này sẽ bị bỏ khi mở bản sao.</p>}
        <label className="form-label" htmlFor="copy-package-syllabus">Giáo trình đích</label>
        <Select id="copy-package-syllabus" aria-label="Giáo trình đích" className="w-100" placeholder="Chọn giáo trình" value={copySyllabus} options={syllabusOptions} showSearch optionFilterProp="label" disabled={blocked} loading={syllabusChoices.state.kind === "loading"} onChange={setCopySyllabus} />
        {syllabusChoices.state.kind === "error" && <button type="button" className="btn btn-link btn-sm p-0" onClick={syllabusChoices.reload}>Thử tải lại giáo trình</button>}
      </Modal>
    )}
    <section className={styles.learningCard} aria-label="Buổi học và học liệu">
      <h5 className={`${styles.sectionTitle} ${styles.learningTitle}`}>
        <i className="isax isax-calendar-1" aria-hidden="true" />
        Buổi học & học liệu
      </h5>
      <div className={styles.layout}>
        <aside className={styles.rail} aria-label="Danh sách buổi học">
          <div className={styles.current}><strong>Buổi {sessionNo}</strong><span>{itemCount} học liệu</span></div>
          {resources.state.kind === "error" && <button type="button" className="btn btn-link" onClick={resources.reload}>Tải lại danh sách buổi</button>}
          <div className={styles.sessions}>
            {Array.from({ length: total }, (_, i) => i + 1).map(n => {
              const selected = n === sessionNo;
              const hasContent = rows.some(r => r.sessionNo === n);
              const status = selected ? "Đang chọn" : hasContent ? "Có nội dung" : resources.state.kind === "ok" ? "Trống" : undefined;
              return (
                <button
                  type="button"
                  key={n}
                  aria-label={`Buổi ${n}`}
                  title={names[n] ? `Buổi ${n} — ${names[n]}` : undefined}
                  aria-pressed={selected}
                  aria-description={status}
                  disabled={blocked}
                  className={selected ? styles.active : hasContent ? styles.filled : styles.emptySession}
                  onClick={() => onSession(n)}
                >{n}</button>
              );
            })}
          </div>
          <ul className={styles.legend} aria-label="Chú giải trạng thái buổi học">
            <li><span className={styles.active} aria-hidden="true" />Đang chọn</li>
            <li><span className={styles.filled} aria-hidden="true" />Có nội dung</li>
            <li><span className={styles.emptySession} aria-hidden="true" />Trống</li>
          </ul>

          {canWrite && <button type="button" className={`btn ${styles.addSession}`} disabled={blocked || resources.state.kind !== "ok"} onClick={async () => { if (await save(total + 1)) onSession(total + 1); }}>+ Thêm buổi</button>}
        </aside>
        <div className={styles.content}>
          <SessionHeading
            sessionNo={sessionNo}
            title={names[sessionNo]}
            onRename={canWrite ? renameSession : undefined}
            actions={canWrite && topicUi ? (
              <button type="button" className={`btn btn-outline-primary ${styles.resourceAction}`} disabled={blocked} onClick={() => setTopicCreateOpen(true)}>
                <i className="isax isax-add-circle" aria-hidden="true" /> Thêm chủ đề
              </button>
            ) : undefined}
          />
          <div className={`${styles.toolbar} ${styles.resourceToolbar}`}>
            <h6 className={styles.resourceTitle}>
              <i className="isax isax-book-1" aria-hidden="true" />
              Học liệu
              <span className={styles.count}>{itemCount}</span>
            </h6>
            {canWrite && (
              <div className={styles.actions}>
                <button type="button" className={`btn btn-outline-primary ${styles.resourceAction}`} disabled={blocked} onClick={onImport}>
                  <i className="isax isax-folder-open" aria-hidden="true" /> Từ kho / học phần khác
                </button>
                <button type="button" className={`btn btn-primary ${styles.resourceAction}`} disabled={blocked} onClick={onCreate}>
                  <i className="isax isax-add" aria-hidden="true" /> Thêm học liệu
                </button>
              </div>
            )}
          </div>
          <div className={styles.resourceList}>{children}</div>
        </div>
      </div>
    </section>
    {topicCreateOpen && canWrite && topicUi && (
      <TopicTitleModal
        key="create-topic"
        open
        initial=""
        busy={blocked}
        onCancel={() => setTopicCreateOpen(false)}
        onSubmit={async (title) => {
          const saved = await topicUi.onCreate(title);
          if (saved) setTopicCreateOpen(false);
          return saved;
        }}
      />
    )}
  </div>;
}
