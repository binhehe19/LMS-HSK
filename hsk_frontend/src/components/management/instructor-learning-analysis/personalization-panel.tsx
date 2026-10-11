"use client";

// Port của LMS_Frontend/src/core/common/personalization/personalization-panel.tsx — CHỈ nhánh audience="teacher" (nhánh học viên thuộc app học viên, ngoài
// phạm vi frontend quản lý). Cùng DOM/class/chữ; logic thuần ở lib/learning-analysis/personalization-model.ts.
//
// Khác bản cũ có chủ đích: (1) nhận FetchState thay cho (view, loading): dịch vụ chưa cấu hình / lỗi => FetchStateNotice (kèm Thử lại) thay vì câu
// "Tạm thời không tải được" chung chung; (2) ba thao tác ghi (gửi nhận xét, tạo/duyệt nhận xét AI) bị KHOÁ khi công tắc "teacher-note" đóng
// (WriteLockedNotice) — không có thành công giả; (3) nhận xét đã gửi cũng có trạng thái waiting/error riêng với Thử lại.
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { FetchErrorNotice, FetchStateNotice, WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import {
  aiWeakAreas,
  canApproveReport,
  canGenerateHistorical,
  groupHasMultipleTargets,
  groupKcLabels,
  groupPersonalizationTasks,
  groupStatus,
  humanSummary,
  insufficientMessage,
  isHistoricalInsufficient,
  NO_HISTORICAL_MESSAGE,
  type PersonalizationTaskGroup,
  scopedPersonalizationTasks,
  taskStatusClass,
  taskStatusLabel,
} from "@/lib/learning-analysis/personalization-model";
import type { PersonalizationView, TeacherNoteResponse } from "@/types/learning-analysis";

interface PersonalizationPanelProps {
  state: FetchState<PersonalizationView>;
  scheduleId: string;
  onRetry: () => void;
  /** Công tắc ghi "teacher-note" (useWriteGate): đóng => nút Tạo/Duyệt/Gửi bị khoá. */
  writeEnabled: boolean;
  generating: boolean;
  onGenerate: () => void;
  approving: boolean;
  onApprove: () => void;
  noteState: FetchState<TeacherNoteResponse | null>;
  onRetryNote: () => void;
  noteDraft: string;
  onNoteDraftChange: (value: string) => void;
  onSendNote: () => void;
  sendingNote: boolean;
}

function TaskCard({ group }: { group: PersonalizationTaskGroup }) {
  const task = group.tasks[0];
  const labels = groupKcLabels(group);
  const status = groupStatus(group);
  return (
    <div className="border rounded-3 p-3 h-100 bg-white" data-testid="ai-task">
      <div className="d-flex align-items-start justify-content-between gap-2">
        <div className="fw-semibold text-dark">{task.title}</div>
        <span className={`badge rounded-pill ${taskStatusClass(status)}`}>{taskStatusLabel(status)}</span>
      </div>
      {labels.length > 1 ? (
        <div className="small text-muted mt-2">Nội dung cần củng cố: {labels.join(", ")}</div>
      ) : groupHasMultipleTargets(group) ? (
        <div className="small text-muted mt-2">Bài tập gồm nhiều nội dung cần củng cố.</div>
      ) : labels.length === 1 ? (
        <div className="small text-muted mt-2">Nội dung cần củng cố: {labels[0]}</div>
      ) : null}
      {task.description && <p className="small text-muted mb-2 mt-2">{task.description}</p>}
      {task.deadline && <div className="small text-muted mb-2">Hạn: {new Date(task.deadline).toLocaleDateString("vi-VN")}</div>}
      {group.materialUrl && (
        <a className="btn btn-sm btn-outline-danger" href={group.materialUrl} target="_blank" rel="noreferrer">
          <i className="fa-solid fa-arrow-up-right-from-square me-1" /> Xem bài tập
        </a>
      )}
    </div>
  );
}

function TeacherNoteCard({ noteState, onRetryNote, writeEnabled, draft, onDraftChange, onSend, sending }: Pick<PersonalizationPanelProps, "noteState" | "onRetryNote" | "writeEnabled"> & { draft: string; onDraftChange: (v: string) => void; onSend: () => void; sending: boolean }) {
  const note = noteState.kind === "ok" ? noteState.data : null;
  return (
    <div className="rounded-3 p-3 bg-light border" data-testid="teacher-note-card">
      <div className="fw-semibold mb-2">Nhận xét gửi học viên</div>
      {note && (
        <div className="rounded-3 p-3 mb-3 bg-white border">
          <div className="small text-muted mb-1">Đã gửi cho học viên</div>
          <div className="text-dark" style={{ whiteSpace: "pre-wrap" }}>
            {note.content}
          </div>
        </div>
      )}
      {noteState.kind === "loading" && <div className="small text-muted mb-2">Đang tải nhận xét đã gửi...</div>}
      {noteState.kind === "error" && (
        <FetchErrorNotice title="Không tải được nhận xét đã gửi cho buổi học này." onRetry={onRetryNote} testId="note-notice" className="border rounded-3 mb-2" />
      )}
      {noteState.kind === "waiting" && <FetchStateNotice state={noteState} waitingText="Nhận xét đã gửi chưa được kết nối API (WAITING FOR BACKEND)." testId="note-notice" className="mb-2" />}
      {noteState.kind === "ok" && !note && <div className="small text-muted mb-2">Chưa có nhận xét nào được gửi cho buổi học này.</div>}
      {!writeEnabled && <WriteLockedNotice what="Gửi nhận xét" className="mb-2" />}
      <textarea className="form-control mb-2" rows={3} placeholder="Nhập nhận xét dành cho học viên..." value={draft} onChange={(e) => onDraftChange(e.target.value)} disabled={!writeEnabled} aria-label="Nhận xét dành cho học viên" />
      <button type="button" className="btn btn-danger btn-sm" disabled={sending || !writeEnabled} onClick={onSend}>
        {sending ? "Đang gửi..." : "Gửi nhận xét"}
      </button>
    </div>
  );
}

export function PersonalizationPanel({ state, scheduleId, onRetry, writeEnabled, generating, onGenerate, approving, onApprove, noteState, onRetryNote, noteDraft, onNoteDraftChange, onSendNote, sendingNote }: PersonalizationPanelProps) {
  const loading = state.kind === "loading";
  const view = state.kind === "ok" ? state.data : null;
  const snapshot = view?.historicalSnapshot ?? null;
  const insufficient = view ? isHistoricalInsufficient(view) : false;
  const weakAreas = view ? aiWeakAreas(view) : [];
  const groups = view ? groupPersonalizationTasks(scopedPersonalizationTasks(view, scheduleId)) : [];
  const showGenerate = Boolean(view && canGenerateHistorical(view));
  const showApprove = Boolean(view && canApproveReport(view));

  return (
    <div className="card mb-3" data-testid="personalization-panel">
      <div className="card-header bg-light d-flex align-items-center justify-content-between gap-2">
        <div className="d-flex align-items-center gap-2 fw-bold">
          <i className="fa-solid fa-wand-magic-sparkles text-danger" />
          Cá nhân hóa học tập
        </div>
        {view?.dataSufficiency === "SUFFICIENT" && <span className="badge rounded-pill bg-success-subtle text-success">Đủ dữ liệu</span>}
      </div>

      <div className="card-body">
        {loading && (
          <div className="text-center py-3 text-muted" role="status">
            <span className="spinner-border spinner-border-sm text-danger me-2" /> Đang tải...
          </div>
        )}

        <section className="rounded-3 p-3 mb-3 bg-primary-subtle border border-primary-subtle">
          <div className="fw-semibold mb-2">Nhận xét của AI</div>
          {loading ? (
            <div className="small text-muted">Đang tải nhận xét AI...</div>
          ) : state.kind !== "ok" ? (
            <FetchStateNotice state={state} waitingText="Gợi ý AI chưa được kết nối API (WAITING FOR BACKEND)." onRetry={onRetry} testId="ai-notice" />
          ) : !view?.available ? (
            <div className="small text-dark">Tạm thời không tải được nhận xét AI. Vui lòng thử lại sau.</div>
          ) : insufficient ? (
            <div className="small text-dark">{insufficientMessage(view)}</div>
          ) : !snapshot ? (
            <div className="small text-dark">{NO_HISTORICAL_MESSAGE}</div>
          ) : null}
          {view?.available && snapshot && !insufficient && (
            <div className="text-dark" style={{ whiteSpace: "pre-wrap" }} data-testid="ai-summary">
              {view.report?.summary ? humanSummary(view) : <span className="small">AI chưa có nội dung nhận xét cho buổi học này.</span>}
            </div>
          )}
          {view?.available && snapshot && weakAreas.length > 0 && !insufficient && (
            <div className="mt-3">
              <div className="small fw-semibold text-dark mb-1">Điểm cần chú ý</div>
              <ul className="small text-dark mb-0 ps-3">
                {weakAreas.map((area, index) => (
                  <li key={`${area.label}-${index}`}>{area.label}</li>
                ))}
              </ul>
            </div>
          )}
          {showGenerate && (
            <button type="button" className="btn btn-sm btn-danger mt-2" onClick={onGenerate} disabled={generating || !writeEnabled}>
              {generating ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" /> AI đang phân tích dữ liệu học tập...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-wand-magic-sparkles me-1" /> Tạo nhận xét AI
                </>
              )}
            </button>
          )}
          {showApprove && (
            <button type="button" className="btn btn-sm btn-success mt-2 ms-2" onClick={onApprove} disabled={approving || !writeEnabled}>
              {approving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" /> Đang duyệt...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check me-1" /> Duyệt nhận xét
                </>
              )}
            </button>
          )}
          {(showGenerate || showApprove) && !writeEnabled && <WriteLockedNotice what="Tạo/duyệt nhận xét AI" className="mt-2" />}
        </section>

        <section className="mb-3">
          <div className="fw-semibold mb-2">Bài tập AI đề xuất</div>
          {loading ? (
            <div className="small text-muted">Đang tải bài tập đề xuất...</div>
          ) : !view ? (
            <div className="small text-muted">Chưa tải được bài tập đề xuất (xem thông báo ở trên).</div>
          ) : groups.length > 0 ? (
            <div className="row g-2">
              {groups.map((group) => (
                <div className="col-lg-6" key={group.key}>
                  <TaskCard group={group} />
                </div>
              ))}
            </div>
          ) : view.recommendations.length > 0 ? (
            <div className="d-flex flex-column gap-2">
              {view.recommendations.map((r, index) => (
                <div key={`${r.label || "recommendation"}-${index}`} className="border rounded-3 p-3 bg-white" data-testid="ai-recommendation">
                  <div className="fw-semibold small">{r.label || "Bài củng cố cá nhân hóa"}</div>
                  {r.reason && <div className="small text-muted mt-1">{r.reason}</div>}
                  <div className="small text-muted mt-2">Đang chờ giáo viên duyệt và giao bài.</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="small text-muted">Chưa có bài tập củng cố được đề xuất cho buổi học này.</div>
          )}
        </section>

        <TeacherNoteCard noteState={noteState} onRetryNote={onRetryNote} writeEnabled={writeEnabled} draft={noteDraft} onDraftChange={onNoteDraftChange} onSend={onSendNote} sending={sendingNote} />
      </div>
    </div>
  );
}
