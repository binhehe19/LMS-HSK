"use client";

// Modal "Đồng bộ dữ liệu từ CMS" (antd Modal + Progress, cùng DOM/class `tm-sync-*` của bản cũ). Trạng thái và thao tác từ use-cms-sync.ts.
import { Modal, Progress } from "antd";
import type { CmsSyncState } from "@/components/management/teacher-management/use-cms-sync";

export interface TeacherSyncModalProps {
  open: boolean;
  state: CmsSyncState;
  onStart: () => void;
  onClose: () => void;
}

const OK_TEXT: Record<CmsSyncState["phase"], string> = { idle: "Bắt đầu đồng bộ", running: "Đang đồng bộ...", success: "Hoàn tất", error: "Thử lại" };

const NOTE: Record<CmsSyncState["phase"], string> = {
  idle: "Sẵn sàng bắt đầu đồng bộ.",
  running: "Đang đối soát dữ liệu, vui lòng chờ trong giây lát.",
  success: "Bạn có thể đóng popup và tiếp tục quản lý danh sách.",
  error: "Bạn có thể thử lại ngay hoặc kiểm tra kết nối hệ thống CMS.",
};

export function TeacherSyncModal({ open, state, onStart, onClose }: TeacherSyncModalProps) {
  const syncing = state.phase === "running";
  return (
    <Modal
      title="Đồng bộ dữ liệu từ CMS"
      open={open}
      centered
      destroyOnClose
      wrapClassName="tm-modal tm-sync-modal"
      width={560}
      maskClosable={!syncing}
      closable={!syncing}
      onCancel={onClose}
      onOk={() => {
        if (state.phase === "running") return;
        if (state.phase === "success") onClose();
        else onStart();
      }}
      okText={OK_TEXT[state.phase]}
      cancelText="Đóng"
      okButtonProps={{ disabled: syncing }}
      cancelButtonProps={{ disabled: syncing }}
    >
      <div className="tm-sync-content" data-testid="teacher-sync-content" data-phase={state.phase}>
        <div className={`tm-sync-state ${state.phase}`}>
          {state.phase === "success" ? <i className="isax isax-tick-circle" /> : state.phase === "error" ? <i className="isax isax-warning-2" /> : <i className="isax isax-refresh-circle" />}
        </div>

        <p className="tm-sync-message">{state.message}</p>

        <Progress percent={state.progress} status={state.phase === "error" ? "exception" : state.phase === "success" ? "success" : "active"} strokeColor={state.phase === "error" ? "#c61e3a" : "#b10019"} trailColor="#f4e5e8" />

        <div className="tm-sync-note">{NOTE[state.phase]}</div>
      </div>
    </Modal>
  );
}
