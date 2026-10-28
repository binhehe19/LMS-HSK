"use client";

// Modal "Thêm tài liệu học tập" (react-bootstrap Modal cũ => antd Modal, cùng trường/nhãn/placeholder/ghi chú). Không gọi API: tệp + giá trị form
// chuyển cho container (tải tệp lên repo-storage rồi tạo tài liệu). Khác bản cũ: khi repo-storage chưa cấu hình, ô tệp bị khoá + dòng báo
// "Kho lưu trữ chưa được cấu hình" thay vì lỗi lúc bấm Thêm; có thanh tiến độ tải lên.
import { Modal } from "antd";
import { useState } from "react";
import type { MaterialFormValues } from "@/components/management/lesson-materials-management/use-lesson-materials";
import { STORAGE_NOT_CONFIGURED_MESSAGE } from "@/lib/api/write-error-message";
import {
  ACCEPTED_MATERIAL_FILE_TYPES,
  formatBytes,
  LESSON_MATERIAL_CATEGORY_LABELS,
  LESSON_MATERIAL_CATEGORY_ORDER,
  LESSON_MATERIAL_TYPE_LABELS,
  LESSON_MATERIAL_TYPES_BY_CATEGORY,
  NEW_GROUP,
} from "@/lib/lesson-materials/lesson-material-model";
import type { LessonMaterialCategory, LessonMaterialGroup, LessonMaterialType } from "@/types/lesson-materials";

export interface MaterialFormModalProps {
  groups: LessonMaterialGroup[];
  /** Bộ đang xem được chọn sẵn (bản cũ). */
  defaultGroupSelection: string;
  submitting: boolean;
  /** 0..1 trong lúc tải tệp lên; null khi không tải. */
  uploadProgress: number | null;
  storageConfigured: boolean;
  onCancel: () => void;
  onSubmit: (values: MaterialFormValues, file: File | null) => void;
}

export function MaterialFormModal({ groups, defaultGroupSelection, submitting, uploadProgress, storageConfigured, onCancel, onSubmit }: MaterialFormModalProps) {
  const [values, setValues] = useState<MaterialFormValues>({ title: "", description: "", category: "LESSON", type: "SLIDE", groupSelection: defaultGroupSelection, newGroupName: "" });
  const [file, setFile] = useState<File | null>(null);
  const types = LESSON_MATERIAL_TYPES_BY_CATEGORY[values.category];
  const uploading = uploadProgress !== null;
  const canSubmit = !submitting && storageConfigured && values.title.trim() !== "" && file !== null;

  return (
    <Modal
      title="Thêm tài liệu học tập"
      open
      centered
      width={800}
      onCancel={onCancel}
      onOk={() => onSubmit(values, file)}
      okText={uploading ? "Đang tải lên..." : submitting ? "Đang lưu..." : "Thêm tài liệu"}
      cancelText="Hủy"
      okButtonProps={{ disabled: !canSubmit, danger: true }}
      confirmLoading={submitting}
    >
      <div data-testid="lm-material-form">
        <div className="lesson-material-management__modal-notice">
          <i className="isax isax-info-circle" />
          <span>Tệp được tải lên kho đa phương tiện. Dịch vụ tài liệu học tập chỉ lưu mã tệp và metadata an toàn.</span>
        </div>
        {!storageConfigured && (
          <div className="alert alert-warning py-2 small" role="status" data-testid="lm-storage-unconfigured">
            {STORAGE_NOT_CONFIGURED_MESSAGE} Chưa thể tải tệp lên.
          </div>
        )}

        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label" htmlFor="lm-material-title">
              Tên tài liệu
            </label>
            <input id="lm-material-title" className="form-control" value={values.title} onChange={(e) => setValues((prev) => ({ ...prev, title: e.target.value }))} placeholder="Ví dụ: Slide buổi 1" />
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="lm-material-category">
              Danh mục
            </label>
            <select
              id="lm-material-category"
              className="form-select"
              value={values.category}
              onChange={(e) => {
                const category = e.target.value as LessonMaterialCategory;
                setValues((prev) => ({ ...prev, category, type: LESSON_MATERIAL_TYPES_BY_CATEGORY[category][0] }));
              }}
            >
              {LESSON_MATERIAL_CATEGORY_ORDER.map((category) => (
                <option value={category} key={category}>
                  {LESSON_MATERIAL_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="lm-material-type">
              Loại tài liệu
            </label>
            <select id="lm-material-type" className="form-select" value={values.type} onChange={(e) => setValues((prev) => ({ ...prev, type: e.target.value as LessonMaterialType }))}>
              {types.map((type) => (
                <option value={type} key={type}>
                  {LESSON_MATERIAL_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12">
            <label className="form-label" htmlFor="lm-material-group">
              Bộ tài liệu
            </label>
            <select id="lm-material-group" className="form-select" value={values.groupSelection} onChange={(e) => setValues((prev) => ({ ...prev, groupSelection: e.target.value }))}>
              <option value="">Chưa phân loại</option>
              {groups
                .filter((group) => group.status !== "ARCHIVED")
                .map((group) => (
                  <option value={group.id} key={group.id}>
                    {group.name}
                  </option>
                ))}
              <option value={NEW_GROUP}>+ Tạo bộ mới</option>
            </select>
          </div>

          {values.groupSelection === NEW_GROUP && (
            <div className="col-12">
              <label className="form-label" htmlFor="lm-material-new-group">
                Tên bộ tài liệu
              </label>
              <input id="lm-material-new-group" className="form-control" value={values.newGroupName} onChange={(e) => setValues((prev) => ({ ...prev, newGroupName: e.target.value }))} placeholder="Ví dụ: HSK 3" />
            </div>
          )}

          <div className="col-12">
            <label className="form-label" htmlFor="lm-material-file">
              Tải tệp lên
            </label>
            <input id="lm-material-file" type="file" className="form-control" accept={ACCEPTED_MATERIAL_FILE_TYPES} disabled={!storageConfigured || submitting} onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)} />
            {file ? (
              <div className="lesson-material-management__selected-file">
                <i className="isax isax-document-upload me-1" />
                {file.name} ({formatBytes(file.size)})
              </div>
            ) : null}
            {uploading && (
              <div className="progress mt-2" style={{ height: 8 }} aria-label="Tiến độ tải lên">
                <div className="progress-bar bg-danger" style={{ width: `${Math.round((uploadProgress ?? 0) * 100)}%` }} />
              </div>
            )}
          </div>

          <div className="col-12">
            <label className="form-label" htmlFor="lm-material-description">
              Mô tả
            </label>
            <textarea id="lm-material-description" className="form-control" rows={3} value={values.description} onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))} placeholder="Ghi chú nội bộ cho quản lý" />
          </div>
        </div>
      </div>
    </Modal>
  );
}
