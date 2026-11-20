"use client";
import { Alert, Input, Modal, Select } from "antd";
import { PackageExitModal } from "./package-exit-modal";
import { SessionHeading } from "./session-heading";
import { TopicTitleModal } from "@/components/management/syllabus/topic-title-modal";
import { ManagementBackButton } from "@/components/management/management-back-button";
import { useEffect, useEffectEvent, useRef, useState, type ReactNode, type RefObject } from "react";
import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { packageLinks } from "@/lib/api/package-management-client";
import { clearPackageSession, listPackageSessionNames, renamePackageSession } from "@/lib/api/package-sessions-client";
import { writeErrorMessage } from "@/lib/content/content-tree-validate";
import { listSyllabuses } from "@/lib/api/lms-syllabus-client";
import type { ContentPackage, ContentPackageInput, FlatTopicUi } from "@/types/content";
import type { PackageDraftFields } from "@/lib/api/package-edit-session-client";
import type { PackageEditDraft, usePackageEditSession } from "./use-package-edit-session";
import { usePackageDraft, type PackageSaveProgress } from "./use-package-draft";
import styles from "./package-workspace.module.css";

export function PackageWorkspace({ pkg, sessionNo, onSession, busy, canWrite, canPublish, demo = false, itemCount, linksRevision = 0, draft, navigationGuardRef, topicUi, status, statusMessage, hasLock, write, onRetryEdit, onHeartbeat, draftRevision = 0, onDraftChanged, onSave, onDiscard, onCopy, onBack, onImport, onCreate, children }: {
  pkg: ContentPackage; sessionNo: number; onSession: (n: number) => void; busy: boolean; canWrite: boolean; itemCount: number;
  canPublish: boolean;
  draft?: PackageEditDraft;
  linksRevision?: number;
  navigationGuardRef?: RefObject<((navigate: (refresh?: boolean) => void) => void) | null>;
  /** Công tắc ghi giả lập của giao diện (truyền cho client ghi tên buổi). */
  demo?: boolean;
  topicUi?: FlatTopicUi;
  status?: ReturnType<typeof usePackageEditSession>["status"];
  statusMessage?: string;
  hasLock?: () => boolean;
  write?: (action: () => Promise<unknown>) => Promise<unknown>;
  onRetryEdit?: () => void;
  onHeartbeat?: (fields?: PackageDraftFields) => Promise<boolean>;
  draftRevision?: number;
  onDraftChanged?: () => void;
  onSave: (input: ContentPackageInput, publish?: boolean, progress?: PackageSaveProgress) => Promise<boolean>;
  onDiscard?: () => Promise<boolean>;
  onCopy: (syllabusId: string) => Promise<boolean>;
  onBack: (refresh?: boolean) => void; onImport: () => void; onCreate: () => void; children: ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  const [topicCreateOpen, setTopicCreateOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySyllabus, setCopySyllabus] = useState<string>();
  const [dialog, setDialog] = useState<"leave" | "discard" | null>(null);
  const lock = useRef(false);
  const destination = useRef<(() => void) | null>(null);
  const blocked = busy || saving;
  const draftForm = usePackageDraft({ pkg, draft, draftRevision, canWrite: hasLock ? !!draft : canWrite, hasLock, busy: blocked, onHeartbeat });
  const { form: { title: name, description, sessionCount }, setName, setDescription, setSessionCount, syllabusId, savedSyllabus, syllabusChanged, setPendingSyllabus,
    dirty, hasChanges, idleWarning, autosaving, autosaveFailed, conflict } = draftForm;
  const sessionUnavailable = status && !draft;
  const syllabusChoices = useKeyedFetch(pkg.syllabusId || canWrite ? "package-syllabuses" : null, listSyllabuses);
  const syllabusOptions = syllabusChoices.state.kind === "ok"
    ? syllabusChoices.state.data.map(s => ({ value: s.id, label: s.name || s.code || s.id }))
    : [];
  const resources = useKeyedFetch(sessionUnavailable ? null : `package-sessions:${pkg.id}:${draft?.id ?? "read"}`, () => packageLinks(pkg.id, draft?.id), { keepDataOnReload: true });
  const reloadResources = resources.reload;
  const previousLinksRevision = useRef(linksRevision);
  useEffect(() => {
    if (previousLinksRevision.current === linksRevision) return;
    previousLinksRevision.current = linksRevision;
    reloadResources();
  }, [linksRevision, reloadResources]);
  const rows = resources.state.kind === "ok" ? resources.state.data : [];
  const sessionNames = useKeyedFetch(sessionUnavailable ? null : `package-session-names:${pkg.id}:${draft?.id ?? "read"}`, () => listPackageSessionNames(pkg.id), { keepDataOnReload: true });
  const reloadSessionNames = sessionNames.reload;
  const lastDraft = useRef(draft);
  useEffect(() => {
    const previous = lastDraft.current;
    lastDraft.current = draft;
    if (previous && previous !== draft && previous.id === draft?.id) {
      reloadResources();
      reloadSessionNames();
    }
  }, [draft, reloadResources, reloadSessionNames]);
  const names: Record<number, string> = sessionNames.state.kind === "ok" ? sessionNames.state.data : {};
  const total = Math.max(1, sessionCount, ...rows.map(r => r.sessionNo));
  const canMutate = () => !conflict && canWrite && (hasLock?.() ?? true);

  // Ghi thẳng lên bản nháp; tên rỗng = xóa tên. Lỗi được báo rồi ném lại để ô nhập không đóng.
  const renameSession = async (no: number, title: string) => {
    if (!canMutate()) throw new Error("Phiên chỉnh sửa đã hết hạn.");
    if (title === (names[no] ?? "")) return;
    try {
      const action = () => title ? renamePackageSession(pkg.id, no, title, demo) : clearPackageSession(pkg.id, no, demo);
      await (write ? write(action) : action());
    } catch (error) {
      toast.error(writeErrorMessage(error, "Không lưu được tên buổi."));
      throw error;
    }
    onDraftChanged?.();
    sessionNames.reload();
  };
  const leave = () => {
    const navigate = destination.current ?? (() => onBack(true));
    destination.current = null;
    navigate();
  };
  const save = async (count = total, mode: "draft" | "publish" = "draft") => {
    if (blocked || lock.current || !canMutate() || !name.trim()) return false;
    const syllabusToSave = syllabusChanged ? syllabusId : undefined;
    if (savedSyllabus && syllabusToSave && !window.confirm("Chuyển học phần sang giáo trình đã chọn? Học phần sẽ rời giáo trình cũ. Liên kết CLO và hạng mục tính điểm cũ sẽ được bỏ.")) return false;
    lock.current = true;
    setSaving(true);
    const snapshot = { title: name.trim(), description, sessionCount: count };
    try {
      const ok = await onSave({ name, description, type: pkg.type, sessionCount: count, syllabusId: syllabusToSave }, mode === "publish", {
        fieldsSaved: () => draftForm.acknowledgeFields(snapshot),
        syllabusSaved: draftForm.acknowledgeSyllabus,
      });
      if (!ok) return false;
      draftForm.acknowledgeFields(snapshot);
      draftForm.finishSave(snapshot, mode === "draft");
      if (syllabusToSave) draftForm.acknowledgeSyllabus(syllabusToSave);
      if (mode === "publish") leave();
      return true;
    } finally { lock.current = false; setSaving(false); }
  };
  const discard = async () => {
    if (!canMutate() || blocked || lock.current || !onDiscard) return;
    lock.current = true;
    setSaving(true);
    try {
      if (await onDiscard()) {
        setDialog(null);
        const navigate = destination.current ?? (() => onBack(true));
        destination.current = null;
        navigate();
      }
    } finally { lock.current = false; setSaving(false); }
  };
  const requestLeave = (navigate: (refresh?: boolean) => void) => {
    if (blocked || lock.current) return;
    if (!hasChanges) navigate(draftForm.catalogChanged);
    else if (canMutate() && onDiscard) {
      destination.current = () => navigate(true);
      setDialog("leave");
    } else if (!dirty || window.confirm("Thông tin chưa lưu. Bạn có muốn rời màn hình?")) navigate(draftForm.catalogChanged);
  };
  const guardedNavigation = useEffectEvent(requestLeave);
  useEffect(() => {
    if (!navigationGuardRef) return;
    navigationGuardRef.current = navigate => guardedNavigation(navigate);
    return () => { navigationGuardRef.current = null; };
  }, [navigationGuardRef]);
  const back = () => requestLeave(onBack);

  if ((status === "checking" && !draft) || status === "finished") {
    return (
      <div role="status" className="d-flex align-items-center gap-2 py-3 text-muted">
        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
        {status === "checking" ? "Đang tải màn soạn học phần…" : "Đang về danh sách học phần…"}
      </div>
    );
  }

  let recovery: ReactNode;
  if ((status && status !== "ready") || conflict) {
    const showConflict = conflict && (!status || status === "ready");
    const state = showConflict ? { title: "Bản nháp đã thay đổi", detail: "Bạn có thể sao chép nội dung đang soạn bên dưới hoặc mở bản mới nhất." } : {
      denied: { title: "Học phần đang được soạn", detail: "Học phần đang được chỉnh sửa trong một phiên khác. Hãy thử lại sau khi phiên đó kết thúc." },
      error: { title: "Không thể mở phiên chỉnh sửa", detail: statusMessage ?? "Vui lòng thử lại để mở học phần." },
      lost: { title: "Phiên chỉnh sửa đã kết thúc", detail: "Bản nháp đã lưu vẫn còn. Bạn có thể thử mở lại phiên chỉnh sửa." },
      checking: { title: "Đang kết nối lại", detail: "Nội dung đang soạn được giữ trong màn này." },
    }[status as "denied" | "error" | "lost" | "checking"];
    recovery = (
      <section className={draft ? undefined : styles.sessionState}>
        <div role="status" className={styles.sessionMessage}>
          <span className={styles.sessionStateIcon} aria-hidden="true">
            <i className="isax isax-lock-1" />
          </span>
          <h1 className={styles.pageTitle}>{state.title}</h1>
          <p className={styles.sessionPackage}>{pkg.name}</p>
          <p className="text-muted mb-0">{state.detail}</p>
        </div>
        {conflict && <textarea className="form-control mt-3" readOnly aria-label="Nội dung chưa lưu" value={[name, description, sessionCount + " buổi", syllabusId].filter(Boolean).join("\n")} />}
        <div className={styles.sessionStateActions}>
          <ManagementBackButton disabled={blocked} onClick={back} />
          <button
            type="button"
            className={`btn btn-primary ${styles.save}`}
            disabled={status === "checking"}
            onClick={showConflict ? draftForm.acceptRemote : onRetryEdit}
          >
            <i className="isax isax-refresh" aria-hidden="true" /> {showConflict ? "Mở bản mới nhất" : "Thử lại"}
          </button>
        </div>
      </section>
    );
    if (!draft) return <div className={styles.workspace}>{recovery}</div>;
  }

  return <div className={styles.workspace}>
    {recovery && <Modal open footer={null} closable={false} keyboard={false} maskClosable={false} aria-label="Khôi phục phiên soạn">{recovery}</Modal>}
    <div className={styles.toolbar}>
      <div className="d-flex align-items-center flex-wrap gap-3">
        <ManagementBackButton disabled={blocked} onClick={back} />
        <h4 className={styles.pageTitle}>Soạn học phần</h4>
        {canWrite && autosaving && <small role="status" className="text-muted">Đang lưu nền…</small>}
      </div>
      {canWrite && (
        <div className={styles.actions}>
          {onDiscard && (
            <button type="button" className={`btn btn-outline-danger ${styles.save}`} disabled={blocked} onClick={() => { destination.current = null; setDialog("discard"); }}>
              <i className="isax isax-trash" aria-hidden="true" /> Hủy thay đổi
            </button>
          )}
          <button type="button" className={`btn btn-outline-primary ${styles.save}`} disabled={blocked} onClick={() => { setCopySyllabus(savedSyllabus); setCopyOpen(true); }}>
            <i className="isax isax-copy" aria-hidden="true" /> Tạo bản sao
          </button>
          <button type="button" className={`btn btn-outline-primary ${styles.save}`} disabled={blocked || !name.trim()} onClick={() => void save(total, "draft")}>
            <i className="isax isax-save-2" aria-hidden="true" /> Lưu nháp
          </button>
          {canPublish && (
            <button type="button" className={`btn btn-primary ${styles.save}`} disabled={blocked || !name.trim()} onClick={() => void save(total, "publish")}>
              <i className="isax isax-send-2" aria-hidden="true" /> Lưu & Xuất bản
            </button>
          )}
        </div>
      )}
    </div>

    {canWrite && idleWarning && <Alert type="warning" showIcon message="Phiên chỉnh sửa sắp hết hạn do không có hoạt động. Tiếp tục thao tác để giữ khóa." />}
    {canWrite && autosaveFailed && <Alert type="warning" showIcon message="Chưa tự lưu được thay đổi. Hệ thống sẽ thử lại hoặc bạn có thể bấm Lưu nháp." />}
    <PackageExitModal
      mode={canWrite && !recovery ? dialog : null}
      published={pkg.publishStatus === "PUBLISHED"}
      blocked={blocked}
      saving={saving}
      saveDisabled={!name.trim()}
      onClose={() => { destination.current = null; setDialog(null); }}
      onConfirmDiscard={() => setDialog("discard")}
      onDiscard={discard}
      onSaveDraft={async () => { if (await save(total, "draft")) { setDialog(null); leave(); } }}
      onPublish={canPublish ? () => void save(total, "publish") : undefined}
    />
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
            popupClassName="package-select-popup"
            aria-label="Giáo trình"
            className={styles.syllabusSelect}
            value={syllabusId}
            placeholder="Chưa gắn giáo trình"
            options={syllabusOptions}
            labelRender={({ label, value }) => label ?? String(value)}
            allowClear={!savedSyllabus}
            showSearch
            optionFilterProp="label"
            loading={syllabusChoices.state.kind === "loading"}
            disabled={!canWrite || blocked || syllabusChoices.state.kind !== "ok"}
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
        <Select popupClassName="package-select-popup" id="copy-package-syllabus" aria-label="Giáo trình đích" className="w-100" placeholder="Chọn giáo trình" value={copySyllabus} options={syllabusOptions} showSearch optionFilterProp="label" disabled={blocked} loading={syllabusChoices.state.kind === "loading"} onChange={setCopySyllabus} />
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

          {canWrite && <button type="button" className={`btn ${styles.addSession}`} disabled={blocked || total >= 500 || resources.state.kind !== "ok"} onClick={() => { if (canMutate()) { setSessionCount(total + 1); onSession(total + 1); } }}>+ Thêm buổi</button>}
        </aside>
        <div className={styles.content}>
          <SessionHeading
            sessionNo={sessionNo}
            title={names[sessionNo]}
            onRename={canWrite && !blocked ? renameSession : undefined}
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
                  <i className="isax isax-folder-open" aria-hidden="true" /> Chọn học liệu có sẵn
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
