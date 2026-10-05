"use client";

// Modal Thêm/Sửa MỘT mục nội dung (EditCardModal của HSK cũ, viết generic): thân form do ContentModuleConfig.ItemForm vẽ; kiểm tra bằng
// config.validateItemInput; không gọi API (container xử lý `onSubmit`). Giá trị khởi tạo lấy một lần lúc mount (container remount bằng `key`).
import { Modal } from "antd";
import { useState } from "react";
import { toast } from "sonner";
import type { ContentItemBase, ContentItemInput, ContentModuleConfig } from "@/types/content";

export interface ContentItemModalProps<TItem extends ContentItemBase> {
  config: ContentModuleConfig<TItem>;
  mode: "create" | "edit";
  initialValue: ContentItemInput<TItem>;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (value: ContentItemInput<TItem>) => void;
}

export function ContentItemModal<TItem extends ContentItemBase>({ config, mode, initialValue, submitting, onCancel, onSubmit }: ContentItemModalProps<TItem>) {
  const [value, setValue] = useState<ContentItemInput<TItem>>(initialValue);
  const noun = config.labels.item;
  const isEdit = mode === "edit";
  const isGrammar = config.module === "GRAMMAR";
  const { ItemForm } = config;

  const submit = () => {
    const invalid = config.validateItemInput(value);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    onSubmit(value);
  };

  return (
    <Modal
      title={isEdit ? `Chỉnh sửa ${noun.toLowerCase()}` : `Thêm ${noun.toLowerCase()} mới`}
      open
      centered
      wrapClassName="content-tree-modal"
      width={isGrammar ? 900 : 720}
      styles={isGrammar ? { body: { maxHeight: "calc(100dvh - 160px)", overflowY: "auto", padding: 4 } } : undefined}
      onCancel={onCancel}
      onOk={submit}
      okText={submitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : `Thêm ${noun.toLowerCase()}`}
      cancelText="Hủy"
      okButtonProps={{ disabled: submitting }}
      confirmLoading={submitting}
    >
      <div data-testid="content-item-form">
        <ItemForm value={value} onChange={setValue} disabled={submitting} idPrefix={`content-item-${mode}`} />
      </div>
    </Modal>
  );
}
