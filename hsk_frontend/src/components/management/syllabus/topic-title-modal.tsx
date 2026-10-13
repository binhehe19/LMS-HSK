"use client";

import { Input, Modal } from "antd";
import { useState } from "react";

interface TopicTitleModalProps {
  open: boolean;
  /** Tên hiện tại khi đổi tên; rỗng khi tạo mới. */
  initial: string;
  busy: boolean;
  onCancel: () => void;
  /** true = đã lưu, hộp đóng. */
  onSubmit: (title: string) => Promise<boolean>;
}

/** Hộp nhập tên chủ đề (tạo mới hoặc đổi tên). Cha đặt `key` theo mục tiêu nên mỗi lần mở là form mới. */
export function TopicTitleModal({ open, initial, busy, onCancel, onSubmit }: TopicTitleModalProps) {
  const [title, setTitle] = useState(initial);
  const trimmed = title.trim();
  const submit = async () => {
    if (trimmed) await onSubmit(trimmed);
  };
  return (
    <Modal
      open={open}
      centered
      title={initial ? "Đổi tên chủ đề" : "Thêm chủ đề"}
      onCancel={onCancel}
      onOk={() => void submit()}
      okText="Lưu"
      cancelText="Đóng"
      okButtonProps={{ disabled: !trimmed || busy, loading: busy }}
      cancelButtonProps={{ disabled: busy }}
    >
      <Input autoFocus maxLength={200} value={title} placeholder="Tên chủ đề, ví dụ: Gia đình" onChange={(e) => setTitle(e.target.value)} onPressEnter={() => void submit()} disabled={busy} />
    </Modal>
  );
}
