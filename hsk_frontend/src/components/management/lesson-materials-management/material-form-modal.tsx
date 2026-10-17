"use client";

// Modal "Thêm tài liệu học tập". Không gọi API: tệp + giá trị form chuyển cho container (tải tệp lên repo-storage rồi tạo tài liệu). Loại tài liệu
// không chọn riêng — luôn là loại của bộ đích; khi tạo bộ mới trong lúc thêm tài liệu, loại bộ mới được chọn ở đây (gợi ý từ đuôi tệp).
import { Modal } from "antd";
import { useState } from "react";
import type { MaterialFormValues } from "@/components/management/lesson-materials-management/use-lesson-materials";
import { STORAGE_NOT_CONFIGURED_MESSAGE } from "@/lib/api/write-error-message";
import { ACCEPTED_MATERIAL_FILE_TYPES, formatBytes, inferTypeFromFilename, LESSON_MATERIAL_TYPE_LABELS, LESSON_MATERIAL_TYPE_ORDER, NEW_GROUP } from "@/lib/lesson-materials/lesson-material-model";
import type { LessonMaterialGroup, LessonMaterialType } from "@/types/lesson-materials";

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
  const [values, setValues] = useState<MaterialFormValues>({ title: "", groupSelection: defaultGroupSelection, newGroupType: "SLIDE", newGroupName: "" });
  const [file, setFile] = useState<File | null>(null);
  const uploading = uploadProgress !== null;
  const canSubmit = !submitting && storageConfigured && values.title.trim() !== "" && file !== null;

  const pickFile = (picked: File | null) => {
    setFile(picked);
    if (picked && !values.title.trim()) setValues((prev) => ({ ...prev, newGroupType: inferTypeFromFilename(picked.name) }));
  };

  return (
    <Modal
      title="Thêm tài liệu học tập"
      open
      centered
      width={700}
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
          <div className="col-12">
            <label className="form-label" htmlFor="lm-material-title">
              Tên tài liệu
            </label>
            <input id="lm-material-title" className="form-control" value={values.title} onChange={(e) => setValues((prev) => ({ ...prev, title: e.target.value }))} placeholder="Ví dụ: Slide buổi 1" />
          </div>

          <div className="col-12">
            <label className="form-label" htmlFor="lm-material-group">
              Bộ tài liệu
            </label>
            <select id="lm-material-group" className="form-select" value={values.groupSelection} onChange={(e) => setValues((prev) => ({ ...prev, groupSelection: e.target.value }))}>
              <option value="" disabled>
                — Chọn bộ tài liệu —
              </option>
              {groups.map((group) => (
                <option value={group.id} key={group.id}>
                  {group.name} ({LESSON_MATERIAL_TYPE_LABELS[group.type]})
                </option>
              ))}
              <option value={NEW_GROUP}>+ Tạo bộ mới</option>
            </select>
          </div>

          {values.groupSelection === NEW_GROUP && (
            <>
              <div className="col-md-8">
                <label className="form-label" htmlFor="lm-material-new-group">
                  Tên bộ tài liệu mới
                </label>
                <input id="lm-material-new-group" className="form-control" value={values.newGroupName} onChange={(e) => setValues((prev) => ({ ...prev, newGroupName: e.target.value }))} placeholder="Ví dụ: HSK 3" />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="lm-material-new-group-type">
                  Loại bộ mới
                </label>
                <select id="lm-material-new-group-type" className="form-select" value={values.newGroupType} onChange={(e) => setValues((prev) => ({ ...prev, newGroupType: e.target.value as LessonMaterialType }))}>
                  {LESSON_MATERIAL_TYPE_ORDER.map((type) => (
                    <option value={type} key={type}>
                      {LESSON_MATERIAL_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="col-12">
            <label className="form-label" htmlFor="lm-material-file">
              Tải tệp lên
            </label>
            <input id="lm-material-file" type="file" className="form-control" accept={ACCEPTED_MATERIAL_FILE_TYPES} disabled={!storageConfigured || submitting} onChange={(e) => pickFile(e.currentTarget.files?.[0] ?? null)} />
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
        </div>
      </div>
    </Modal>
  );
}
