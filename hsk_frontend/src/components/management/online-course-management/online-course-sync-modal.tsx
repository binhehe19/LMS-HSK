"use client";

// Modal theo dõi đồng bộ CMS (react-bootstrap Modal `.onl-sync-modal` cũ => antd Modal không footer, cùng DOM bên trong: sync-icon-box, sync-title,
// sync-desc, sync-features, sync-progress-container, nút "Chạy nền"/"Đóng"). Khi đang đồng bộ chỉ đóng được bằng "Chạy nền" (bản cũ: onHide bị chặn).
import { Modal } from "antd";
import { syncJobView } from "@/lib/online-course/online-course-model";
import type { OnlineSystemSyncJob } from "@/types/online-course";

export interface OnlineCourseSyncModalProps {
  open: boolean;
  job: OnlineSystemSyncJob | null;
  syncing: boolean;
  onClose: () => void;
}

export function OnlineCourseSyncModal({ open, job, syncing, onClose }: OnlineCourseSyncModalProps) {
  const view = syncJobView(job);
  return (
    <Modal open={open} centered footer={null} closable={false} maskClosable={!syncing} destroyOnClose wrapClassName="onl-sync-modal" onCancel={onClose} width={480}>
      <div className="text-center" data-testid="onl-sync-modal" data-tone={view.tone}>
        <div className={`sync-icon-box ${view.tone}`}>
          <i className={view.icon} />
        </div>
        <h4 className="sync-title">{view.title}</h4>
        <p className="sync-desc">{view.description}</p>

        {!view.finished && (
          <div className="sync-features">
            {[
              { icon: "isax-calendar-tick", label: "Thời khóa biểu" },
              { icon: "isax-book", label: "Syllabus" },
              { icon: "isax-medal-star", label: "Khóa học" },
            ].map((f) => (
              <div className="feature-item" key={f.label}>
                <i className={`isax ${f.icon}`} />
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        )}

        {syncing && (
          <div className="sync-progress-container">
            <div className="progress">
              <div className="progress-bar" style={{ width: `${view.progress}%` }} />
            </div>
            <div className="progress-label">
              <span className="step-name">{view.step}</span>
              <span className="percent">{job?.progressPercent || 0}%</span>
            </div>
          </div>
        )}

        <div className="mt-4">
          <button type="button" className="btn btn-light btn-close-modal" onClick={onClose}>
            {view.finished ? "Đóng" : "Chạy nền"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
