"use client";

// Một modal cho ba form Gói / Thư mục / Bộ học (package-modal.tsx, create-folder-modal.tsx, create-studyset-modal.tsx của HSK cũ gộp lại: cùng
// trường tên + mô tả, thư mục/bộ học thêm "riêng tư"; giữ nguyên tiêu đề, nhãn, placeholder cũ). react-bootstrap Modal => antd Modal. Không gọi API.
import { Modal } from "antd";
import { useState } from "react";
import type { StorageItemFormValues } from "@/components/management/manage-storage/use-manage-storage";
import type { StorageItemType } from "@/lib/hsk-storage/storage-model";

const TEXT: Record<StorageItemType, { icon: string; create: string; edit: string; nameLabel: string; namePlaceholder: string; descPlaceholder: string; privateLabel: string; okCreate: string; okEdit: string }> = {
  PACKAGE: { icon: "isax-package", create: "Tạo package mới", edit: "Sửa package", nameLabel: "Tên package", namePlaceholder: "VD: Khóa học tiếng Trung HSK", descPlaceholder: "Mô tả ngắn về package này...", privateLabel: "", okCreate: "Tạo package", okEdit: "Cập nhật package" },
  FOLDER: { icon: "isax-folder-2", create: "Tạo folder mới", edit: "Sửa folder", nameLabel: "Tên folder", namePlaceholder: "VD: HSK cấp 1", descPlaceholder: "Mô tả ngắn về folder này...", privateLabel: "Đặt folder ở chế độ riêng tư", okCreate: "Tạo folder", okEdit: "Cập nhật folder" },
  STUDYSET: { icon: "isax-book", create: "Tạo study set mới", edit: "Sửa study set", nameLabel: "Tiêu đề study set", namePlaceholder: "VD: Bài 1: Chào hỏi", descPlaceholder: "Mô tả ngắn về study set này...", privateLabel: "Đặt study set ở chế độ riêng tư", okCreate: "Tạo study set", okEdit: "Cập nhật study set" },
};

export interface StorageItemModalProps {
  type: StorageItemType;
  editing: boolean;
  initialValues: StorageItemFormValues;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: StorageItemFormValues) => void;
}

export function StorageItemModal({ type, editing, initialValues, submitting, onCancel, onSubmit }: StorageItemModalProps) {
  const [values, setValues] = useState(initialValues);
  const text = TEXT[type];
  const id = (field: string) => `storage-${type.toLowerCase()}-${field}`;
  return (
    <Modal
      title={
        <span>
          <i className={`isax ${text.icon} me-2`} />
          {editing ? text.edit : text.create}
        </span>
      }
      open
      centered
      onCancel={onCancel}
      onOk={() => onSubmit(values)}
      okText={submitting ? (editing ? "Đang cập nhật..." : "Đang tạo...") : editing ? text.okEdit : text.okCreate}
      cancelText="Hủy"
      okButtonProps={{ disabled: submitting || !values.name.trim() }}
      confirmLoading={submitting}
    >
      <div data-testid="storage-item-form" data-type={type}>
        <div className="mb-3">
          <label className="form-label" htmlFor={id("name")}>
            {text.nameLabel} <span className="text-danger">*</span>
          </label>
          <input id={id("name")} type="text" className="form-control" value={values.name} onChange={(e) => setValues((prev) => ({ ...prev, name: e.target.value }))} placeholder={text.namePlaceholder} />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor={id("description")}>
            Mô tả
          </label>
          <textarea id={id("description")} className="form-control" rows={3} value={values.description} onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))} placeholder={text.descPlaceholder} />
        </div>
        {type !== "PACKAGE" && (
          <div className="mb-3">
            <div className="form-check">
              <input type="checkbox" className="form-check-input" id={id("private")} checked={values.isPrivate} onChange={(e) => setValues((prev) => ({ ...prev, isPrivate: e.target.checked }))} />
              <label className="form-check-label" htmlFor={id("private")}>
                <i className="isax isax-lock me-1" />
                {text.privateLabel}
              </label>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
