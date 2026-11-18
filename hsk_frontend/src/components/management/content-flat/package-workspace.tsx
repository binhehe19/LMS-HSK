"use client";
import { Alert, Button, Input, Modal, Select } from "antd";
import { SessionHeading } from "./session-heading";
import { TopicTitleModal } from "@/components/management/syllabus/topic-title-modal";
import { ManagementBackButton } from "@/components/management/management-back-button";
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { packageLinks } from "@/lib/api/package-management-client";
import { clearPackageSession, listPackageSessionNames, renamePackageSession } from "@/lib/api/package-sessions-client";
import { writeErrorMessage } from "@/lib/content/content-tree-validate";
import { listSyllabuses } from "@/lib/api/lms-syllabus-client";
import type { ContentPackage, ContentPackageInput, FlatTopicUi } from "@/types/content";
import type { PackageDraftFields } from "@/lib/api/package-edit-session-client";
import { PACKAGE_HEARTBEAT_MS, PACKAGE_IDLE_MS, type usePackageEditSession } from "./use-package-edit-session";
import styles from "./package-workspace.module.css";

export function PackageWorkspace({ pkg, sessionNo, onSession, busy, canWrite, canPublish, demo = false, itemCount, topicUi, status, statusMessage, hasLock, onRetryEdit, onHeartbeat, onSave, onDiscard, onCopy, onBack, onImport, onCreate, children }: {
  pkg: ContentPackage; sessionNo: number; onSession: (n: number) => void; busy: boolean; canWrite: boolean; itemCount: number;
  canPublish: boolean;
  /** Công tắc ghi giả lập của giao diện (truyền cho client ghi tên buổi). */
  demo?: boolean;
  topicUi?: FlatTopicUi;
  status?: ReturnType<typeof usePackageEditSession>["status"];
  statusMessage?: string;
  hasLock?: () => boolean;
  onRetryEdit?: () => void;
  onHeartbeat?: (fields?: PackageDraftFields) => Promise<boolean>;
  onSave: (input: ContentPackageInput, publish?: boolean) => Promise<boolean>;
  onDiscard?: () => Promise<boolean>;
  onCopy: (syllabusId: string) => Promise<boolean>;
  onBack: () => void; onImport: () => void; onCreate: () => void; children: ReactNode;
}) {
  const [name, setName] = useState(pkg.name);
  const [description, setDescription] = useState(pkg.description ?? "");
  const [sessionCount, setSessionCount] = useState(pkg.sessionCount ?? 1);
  const [pendingSyllabus, setPendingSyllabus] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [topicCreateOpen, setTopicCreateOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySyllabus, setCopySyllabus] = useState<string>();
  const [dialog, setDialog] = useState<"leave" | "discard" | null>(null);
  const [idleWarning, setIdleWarning] = useState(false);
  const [autosaveFailed, setAutosaveFailed] = useState(false);
  const lock = useRef(false);
  const [saved, setSaved] = useState({ title: pkg.name, description: pkg.description ?? "" });
  const sessionUnavailable = status && status !== "ready";
  const syllabusId = pendingSyllabus ?? pkg.syllabusId ?? undefined;
  const syllabusChanged = !!pendingSyllabus && pendingSyllabus !== pkg.syllabusId;
  const syllabusChoices = useKeyedFetch(!sessionUnavailable && (pkg.syllabusId || canWrite) ? "package-syllabuses" : null, listSyllabuses);
  const syllabusOptions = syllabusChoices.state.kind === "ok"
    ? syllabusChoices.state.data.map(s => ({ value: s.id, label: s.name || s.code || s.id }))
    : [];
  const dirty = name.trim() !== saved.title || description !== saved.description || syllabusChanged;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const resources = useKeyedFetch(sessionUnavailable ? null : `package-sessions:${pkg.id}:${sessionNo}:${itemCount}`, () => packageLinks(pkg.id));
  const rows = resources.state.kind === "ok" ? resources.state.data : [];
  // Tên buổi là tùy chọn: tải lỗi thì chỉ hiện "Buổi n", không chặn việc soạn.
  const sessionNames = useKeyedFetch(sessionUnavailable ? null : `package-session-names:${pkg.id}`, () => listPackageSessionNames(pkg.id));
  const names: Record<number, string> = sessionNames.state.kind === "ok" ? sessionNames.state.data : (sessionNames.lastData ?? {});
  const total = Math.max(1, sessionCount, sessionNo, ...rows.map(r => r.sessionNo));
  const blocked = busy || saving;
  const canMutate = () => canWrite && (hasLock?.() ?? true);

  const tick = useEffectEvent(async () => {
    if (!onHeartbeat || !canMutate()) return;
    const fields = !blocked && !lock.current && name.trim() &&
      (name.trim() !== saved.title || description !== saved.description)
      ? { title: name.trim(), description, sessionCount: total }
      : undefined;
    try {
      if (await onHeartbeat(fields)) {
        if (fields) {
          setSaved(fields);
          setAutosaveFailed(false);
        }
      }
    } catch {
      if (fields) setAutosaveFailed(true);
    }
  });
  const heartbeatEnabled = canWrite && !!onHeartbeat;
  useEffect(() => {
    if (!heartbeatEnabled) return;
    let lastActivity = Date.now();
    const activity = () => {
      lastActivity = Date.now();
      setIdleWarning(false);
    };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    for (const event of events) window.addEventListener(event, activity, { passive: true, capture: true });
    const timer = window.setInterval(() => {
      const idle = Date.now() - lastActivity;
      setIdleWarning(idle >= PACKAGE_IDLE_MS - 60_000);
      if (idle < PACKAGE_IDLE_MS) void tick();
    }, PACKAGE_HEARTBEAT_MS);
    return () => {
      window.clearInterval(timer);
      for (const event of events) window.removeEventListener(event, activity, true);
    };
  }, [heartbeatEnabled]);

  // Ghi thẳng lên bản nháp; tên rỗng = xóa tên. Lỗi được báo rồi ném lại để ô nhập không đóng.
  const renameSession = async (no: number, title: string) => {
    if (!canMutate()) throw new Error("Phiên chỉnh sửa đã hết hạn.");
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
    if (blocked || lock.current || !canMutate() || !name.trim()) return false;
    const syllabusToSave = mode !== "session" && syllabusChanged ? pendingSyllabus : undefined;
    if (pkg.syllabusId && syllabusToSave && !window.confirm("Chuyển học phần sang giáo trình đã chọn? Học phần sẽ rời giáo trình cũ. Liên kết CLO và hạng mục tính điểm cũ sẽ được bỏ.")) {
      return false;
    }
    lock.current = true;
    setSaving(true);
    try {
      const ok = await onSave({ name, description, type: pkg.type, sessionCount: count, syllabusId: syllabusToSave }, mode === "publish");
      if (ok) {
        setSaved({ title: name.trim(), description });
        setSessionCount(count);
        if (syllabusToSave) setPendingSyllabus(undefined);
        setAutosaveFailed(false);
      }
      return ok;
    }
    finally { lock.current = false; setSaving(false); }
  };
  const discard = async () => {
    if (!canMutate() || blocked || lock.current || !onDiscard) return;
    lock.current = true;
    setSaving(true);
    try {
      if (await onDiscard()) setDialog(null);
    } finally { lock.current = false; setSaving(false); }
  };
  const back = () => {
    if (canMutate() && onDiscard) setDialog("leave");
    else if (!dirty || window.confirm("Thông tin chưa lưu. Bạn có muốn rời màn hình?")) onBack();
  };

  if (sessionUnavailable) {
    const state = {
      checking: { title: "Đang mở phiên chỉnh sửa", detail: "Đang kiểm tra khóa của học phần." },
      denied: { title: "Học phần đang được soạn", detail: "Học phần đang được chỉnh sửa trong một phiên khác. Hãy thử lại sau khi phiên đó kết thúc." },
      error: { title: "Không thể mở phiên chỉnh sửa", detail: statusMessage ?? "Vui lòng thử lại để mở học phần." },
      lost: { title: "Phiên chỉnh sửa đã kết thúc", detail: "Bản nháp đã lưu vẫn còn. Bạn có thể thử mở lại phiên chỉnh sửa." },
      finished: { title: "Đang về danh sách học phần", detail: "" },
    }[status];
    const pending = status === "checking" || status === "finished";
    return (
      <div className={styles.workspace}>
        <section className={styles.sessionState}>
          <div role="status" className={styles.sessionMessage}>
            <span className={styles.sessionStateIcon} aria-hidden="true">
              {pending ? <span className="spinner-border spinner-border-sm" /> : <i className="isax isax-lock-1" />}
            </span>
            <h1 className={styles.pageTitle}>{state.title}</h1>
            <p className={styles.sessionPackage}>{pkg.name}</p>
            {state.detail && <p className="text-muted mb-0">{state.detail}</p>}
          </div>
          <div className={styles.sessionStateActions}>
            <ManagementBackButton disabled={blocked} onClick={back} />
            {!pending && (
              <button
                type="button"
                className={`btn btn-primary ${styles.save}`}
                onClick={status === "lost" ? () => window.location.reload() : onRetryEdit}
              >
                <i className="isax isax-refresh" aria-hidden="true" /> Thử lại
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  return <div className={styles.workspace}>
    <div className={styles.toolbar}>
      <div className="d-flex align-items-center flex-wrap gap-3">
        <ManagementBackButton disabled={blocked} onClick={back} />
        <h4 className={styles.pageTitle}>Soạn học phần</h4>
      </div>
      {canWrite && (
        <div className={styles.actions}>
          {onDiscard && (
            <button type="button" className={`btn btn-outline-danger ${styles.save}`} disabled={blocked} onClick={() => setDialog("discard")}>
              <i className="isax isax-trash" aria-hidden="true" /> Hủy thay đổi
            </button>
          )}
          <button type="button" className={`btn btn-outline-primary ${styles.save}`} disabled={blocked} onClick={() => { setCopySyllabus(pkg.syllabusId ?? undefined); setCopyOpen(true); }}>
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
    <Modal
      open={dialog !== null && canWrite}
      title={dialog === "discard" ? "Hủy toàn bộ bản nháp?" : "Rời màn soạn học phần?"}
      okText="Hủy bản nháp"
      cancelText="Tiếp tục soạn"
      okButtonProps={{ danger: true, disabled: blocked }}
      cancelButtonProps={{ disabled: blocked }}
      confirmLoading={saving}
      onCancel={() => { if (!blocked) setDialog(null); }}
      onOk={discard}
      footer={dialog === "leave" ? [
        <Button key="continue" disabled={blocked} onClick={() => setDialog(null)}>Tiếp tục soạn</Button>,
        <Button key="discard" danger disabled={blocked} onClick={() => setDialog("discard")}>Hủy thay đổi</Button>,
        <Button key="draft" disabled={blocked || !name.trim()} onClick={async () => { if (await save(total, "draft")) onBack(); }}>Lưu nháp và thoát</Button>,
        canPublish && <Button key="publish" type="primary" disabled={blocked || !name.trim()} onClick={() => void save(total, "publish")}>Lưu & Xuất bản</Button>,
      ] : undefined}
    >
      {dialog === "discard" ? <>
        <p>Tất cả thay đổi trong bản nháp, kể cả các thay đổi đã lưu trước đó, sẽ bị hủy và không thể khôi phục.</p>
        <p className="mb-0">{pkg.publishStatus === "PUBLISHED"
          ? "Phiên bản đang xuất bản vẫn được giữ. Nếu bạn đã lưu việc đổi giáo trình, liên kết đó vẫn được giữ."
          : "Học phần hiện chưa có phiên bản xuất bản nên sẽ bị xóa khỏi danh sách."}</p>
      </> : <p className="mb-0">Bạn có thể lưu bản nháp để soạn tiếp sau, xuất bản, hoặc hủy toàn bộ bản nháp của học phần.</p>}
    </Modal>
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
            allowClear={!pkg.syllabusId}
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

          {canWrite && <button type="button" className={`btn ${styles.addSession}`} disabled={blocked || resources.state.kind !== "ok"} onClick={async () => { if (await save(total + 1)) onSession(total + 1); }}>+ Thêm buổi</button>}
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
