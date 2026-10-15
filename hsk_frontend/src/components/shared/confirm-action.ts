"use client";

import { Modal } from "antd";
import type { ReactNode } from "react";

/**
 * Xác nhận trước thao tác không hoàn tác (xoá, khoá, gửi kết quả...) bằng antd Modal.confirm — thay cho `window.confirm` và cho các modal
 * react-bootstrap của HSK cũ (khác HSK cũ có chủ đích: một kiểu xác nhận cho mọi màn). Trả về true khi người dùng đồng ý.
 */
export function confirmAction({ title, content, okText = "Xác nhận", cancelText = "Hủy", danger = false }: { title: string; content?: ReactNode; okText?: string; cancelText?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title,
      content,
      okText,
      cancelText,
      okButtonProps: { danger },
      centered: true,
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}
