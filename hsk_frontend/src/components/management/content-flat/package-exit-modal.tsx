"use client";

import { Button, Modal } from "antd";

export function PackageExitModal({ mode, published, blocked, saving, saveDisabled, onClose, onConfirmDiscard, onDiscard, onSaveDraft, onPublish }: {
  mode: "leave" | "discard" | null;
  published: boolean;
  blocked: boolean;
  saving: boolean;
  saveDisabled: boolean;
  onClose: () => void;
  onConfirmDiscard: () => void;
  onDiscard: () => Promise<void>;
  onSaveDraft: () => Promise<void>;
  onPublish?: () => void;
}) {
  const confirmingDiscard = mode === "discard";
  return (
    <Modal
      open={mode !== null}
      title={confirmingDiscard ? "Hủy toàn bộ bản nháp?" : "Rời màn soạn học phần?"}
      okText="Hủy bản nháp"
      cancelText="Tiếp tục soạn"
      okButtonProps={{ danger: true, disabled: blocked }}
      cancelButtonProps={{ disabled: blocked }}
      confirmLoading={saving}
      onCancel={() => { if (!blocked) onClose(); }}
      onOk={onDiscard}
      footer={confirmingDiscard ? undefined : [
        <Button key="discard" danger disabled={blocked} onClick={onConfirmDiscard}>Hủy bỏ thay đổi</Button>,
        <Button key="draft" type={onPublish ? "default" : "primary"} disabled={blocked || saveDisabled} onClick={onSaveDraft}>Lưu nháp và thoát</Button>,
        onPublish && <Button key="publish" type="primary" disabled={blocked || saveDisabled} onClick={onPublish}>Lưu &amp; Xuất bản</Button>,
      ]}
    >
      {confirmingDiscard ? <>
        <p>Tất cả thay đổi trong bản nháp, kể cả các thay đổi đã lưu trước đó, sẽ bị hủy và không thể khôi phục.</p>
        <p className="mb-0">{published
          ? "Phiên bản đang xuất bản vẫn được giữ. Nếu bạn đã lưu việc đổi giáo trình, liên kết đó vẫn được giữ."
          : "Học phần hiện chưa có phiên bản xuất bản nên sẽ bị xóa khỏi danh sách."}</p>
      </> : <p className="mb-0">Học phần có thay đổi trong phiên soạn này. Chọn cách xử lý trước khi rời trang.</p>}
    </Modal>
  );
}
