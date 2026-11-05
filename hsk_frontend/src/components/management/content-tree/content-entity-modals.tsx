"use client";

// Ba modal Tạo/Sửa gói, thư mục, bộ của nền content-tree — port CreatePackageModal / CreateFolderModal / CreateStudySetWithCardsModal (phần thông tin
// bộ) của HSK cũ sang antd Modal (khác bản cũ có chủ đích theo quy ước M5: modal tự vẽ bằng div overlay → antd Modal; cùng nhãn/placeholder).
// Không gọi API: `onSubmit(values)` do container xử lý; giá trị khởi tạo lấy một lần lúc mount (container remount bằng `key` mỗi lần mở).
import { Modal } from "antd";
import { useState } from "react";
import type { ContentFolderInput, ContentLabels, ContentPackageInput, ContentSkillOption, ContentStudySetInput } from "@/types/content";

const LABEL_CLASS = "form-label small fw-700 text-uppercase mb-2";
const LABEL_STYLE = { letterSpacing: "0.5px" } as const;

export interface PackageFormModalProps {
  labels: ContentLabels;
  mode: "create" | "edit";
  initialValues: ContentPackageInput;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: ContentPackageInput) => void;
}

export function PackageFormModal({ labels, mode, initialValues, submitting, onCancel, onSubmit }: PackageFormModalProps) {
  const [values, setValues] = useState<ContentPackageInput>(initialValues);
  const isEdit = mode === "edit";
  const noun = labels.package;
  return (
    <Modal
      title={isEdit ? `Cập nhật ${noun}` : `Tạo ${noun} mới`}
      open
      centered
      wrapClassName="content-tree-modal"
      width={550}
      onCancel={onCancel}
      onOk={() => onSubmit(values)}
      okText={submitting ? (isEdit ? "Đang cập nhật..." : "Đang tạo...") : isEdit ? "Cập nhật" : `Tạo ${noun}`}
      cancelText="Hủy"
      okButtonProps={{ disabled: submitting }}
      confirmLoading={submitting}
    >
      <div data-testid="package-form">
        <div className="mb-4">
          <label className={LABEL_CLASS} style={LABEL_STYLE} htmlFor="content-package-name">
            Tên {noun}
          </label>
          <input id="content-package-name" type="text" className="form-control form-control-lg shadow-sm rounded-3" placeholder={`VD: ${noun} Tiếng Trung HSK 1`} value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} />
        </div>
        <div className="mb-2">
          <label className={LABEL_CLASS} style={LABEL_STYLE} htmlFor="content-package-description">
            Mô tả
          </label>
          <textarea id="content-package-description" className="form-control shadow-sm rounded-3" rows={4} placeholder={`Mô tả ngắn về ${noun.toLowerCase()} này...`} value={values.description ?? ""} onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))} />
        </div>
      </div>
    </Modal>
  );
}

export interface FolderFormModalProps {
  labels: ContentLabels;
  mode: "create" | "edit";
  initialValues: ContentFolderInput;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: ContentFolderInput) => void;
}

export function FolderFormModal({ labels, mode, initialValues, submitting, onCancel, onSubmit }: FolderFormModalProps) {
  const [values, setValues] = useState<ContentFolderInput>(initialValues);
  const isEdit = mode === "edit";
  const noun = labels.folder;
  return (
    <Modal
      title={isEdit ? `Cập nhật ${noun}` : `Thêm ${noun} mới`}
      open
      centered
      wrapClassName="content-tree-modal"
      width={550}
      onCancel={onCancel}
      onOk={() => onSubmit(values)}
      okText={submitting ? (isEdit ? "Đang cập nhật..." : "Đang tạo...") : isEdit ? "Cập nhật" : `Tạo ${noun}`}
      cancelText="Hủy"
      okButtonProps={{ disabled: submitting }}
      confirmLoading={submitting}
    >
      <div data-testid="folder-form">
        <div className="mb-4">
          <label className={LABEL_CLASS} style={LABEL_STYLE} htmlFor="content-folder-name">
            Tên {noun}
          </label>
          <input id="content-folder-name" type="text" className="form-control form-control-lg shadow-sm rounded-3" placeholder="VD: Từ vựng cơ bản" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} />
        </div>
        <div className="mb-3">
          <label className={LABEL_CLASS} style={LABEL_STYLE} htmlFor="content-folder-description">
            Mô tả
          </label>
          <textarea id="content-folder-description" className="form-control shadow-sm rounded-3" rows={4} placeholder={`Mô tả ngắn về ${noun.toLowerCase()} này...`} value={values.description ?? ""} onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))} />
        </div>
        <div className="form-check">
          <input id="content-folder-private" type="checkbox" className="form-check-input" checked={values.isPrivate ?? false} onChange={(e) => setValues((v) => ({ ...v, isPrivate: e.target.checked }))} />
          <label className="form-check-label" htmlFor="content-folder-private">
            Riêng tư (chỉ người quản lý nội dung thấy)
          </label>
        </div>
      </div>
    </Modal>
  );
}

export interface StudySetFormModalProps {
  labels: ContentLabels;
  mode: "create" | "edit";
  initialValues: ContentStudySetInput;
  skills?: ContentSkillOption[];
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: ContentStudySetInput) => void;
}

export function StudySetFormModal({ labels, mode, initialValues, skills, submitting, onCancel, onSubmit }: StudySetFormModalProps) {
  const [values, setValues] = useState<ContentStudySetInput>(initialValues);
  const isEdit = mode === "edit";
  const noun = labels.studySet;
  return (
    <Modal
      title={isEdit ? `Chỉnh sửa ${noun}` : `Tạo ${noun} mới`}
      open
      centered
      wrapClassName="content-tree-modal"
      width={550}
      onCancel={onCancel}
      onOk={() => onSubmit(values)}
      okText={submitting ? (isEdit ? "Đang cập nhật..." : "Đang tạo...") : isEdit ? "Cập nhật" : `Tạo ${noun}`}
      cancelText="Hủy"
      okButtonProps={{ disabled: submitting }}
      confirmLoading={submitting}
    >
      <div data-testid="study-set-form">
        <div className="mb-4">
          <label className={LABEL_CLASS} style={LABEL_STYLE} htmlFor="content-set-title">
            Tên {noun}
          </label>
          <input id="content-set-title" type="text" className="form-control form-control-lg shadow-sm rounded-3" placeholder="VD: Bài 1 - Chào hỏi cơ bản" value={values.title} onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))} />
        </div>
        {skills && skills.length > 0 && (
          <div className="mb-4">
            <label className={LABEL_CLASS} style={LABEL_STYLE} htmlFor="content-set-skill">
              Kỹ năng
            </label>
            <select id="content-set-skill" className="form-select form-select-lg shadow-sm rounded-3" value={values.skill ?? ""} onChange={(e) => setValues((v) => ({ ...v, skill: e.target.value }))}>
              <option value="">Chọn kỹ năng</option>
              {skills.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="mb-2">
          <label className={LABEL_CLASS} style={LABEL_STYLE} htmlFor="content-set-description">
            Mô tả
          </label>
          <textarea id="content-set-description" className="form-control shadow-sm rounded-3" rows={3} placeholder={`Mô tả ngắn về ${noun.toLowerCase()} này...`} value={values.description ?? ""} onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))} />
        </div>
      </div>
    </Modal>
  );
}
