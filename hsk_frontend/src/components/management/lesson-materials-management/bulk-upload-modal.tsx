"use client";

// Modal "Thêm nhiều tài liệu cùng lúc": ba trạng thái (chọn tệp / đang xử lý / kết quả). Không gọi API: danh sách tệp + bộ đích chuyển cho container
// (startBulk). Mọi tệp trong một lượt tải lên cùng một bộ đích (loại tài liệu = loại của bộ đó); không còn chọn loại riêng từng tệp.
import { Modal } from "antd";
import { useState } from "react";
import type { BulkState } from "@/components/management/lesson-materials-management/use-lesson-materials";
import { STORAGE_NOT_CONFIGURED_MESSAGE } from "@/lib/api/write-error-message";
import { ACCEPTED_MATERIAL_FILE_TYPES, appendBulkFiles, formatBytes, LESSON_MATERIAL_TYPE_LABELS, LESSON_MATERIAL_TYPE_ORDER, MAX_BULK_FILES, NEW_GROUP, type BulkFileItem } from "@/lib/lesson-materials/lesson-material-model";
import type { LessonMaterialGroup, LessonMaterialType } from "@/types/lesson-materials";

export interface BulkUploadModalProps {
  groups: LessonMaterialGroup[];
  defaultGroupSelection: string;
  bulk: BulkState;
  storageConfigured: boolean;
  onStart: (items: BulkFileItem[], groupSelection: string, newGroupType: LessonMaterialType, newGroupName: string) => void;
  onClose: () => void;
}

export function BulkUploadModal({ groups, defaultGroupSelection, bulk, storageConfigured, onStart, onClose }: BulkUploadModalProps) {
  const [items, setItems] = useState<BulkFileItem[]>([]);
  const [groupSelection, setGroupSelection] = useState(defaultGroupSelection);
  const [newGroupType, setNewGroupType] = useState<LessonMaterialType>("SLIDE");
  const [newGroupName, setNewGroupName] = useState("");
  const processing = bulk.phase === "processing";
  const done = bulk.phase === "done" && bulk.result !== null;
  const update = (index: number, patch: Partial<BulkFileItem>) => setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <Modal
      title={done ? "Kết quả tải lên" : "Thêm nhiều tài liệu cùng lúc"}
      open
      centered
      width={800}
      closable={!processing}
      maskClosable={!processing}
      keyboard={!processing}
      onCancel={onClose}
      footer={
        done ? (
          <button type="button" className="btn btn-danger rounded-pill px-4" onClick={onClose}>
            Đóng
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-link text-muted" onClick={onClose} disabled={processing}>
              Hủy
            </button>
            <button type="button" className="btn btn-danger rounded-pill px-4" onClick={() => onStart(items, groupSelection, newGroupType, newGroupName)} disabled={processing || !storageConfigured || items.length === 0 || !groupSelection}>
              {processing ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="isax isax-document-upload me-2" />}
              Tải lên {items.length} tệp
            </button>
          </>
        )
      }
    >
      <div data-testid="lm-bulk-modal" data-phase={bulk.phase}>
        {done && bulk.result ? (
          <div className="lesson-material-management__bulk-result">
            <div className="lesson-material-management__bulk-result-summary">
              <div className={`lesson-material-management__bulk-stat ${bulk.result.totalCreated > 0 ? "success" : ""}`}>
                <i className="isax isax-tick-circle" />
                <span>
                  {bulk.result.totalCreated}/{bulk.result.totalRequested} thành công
                </span>
              </div>
              {bulk.result.totalFailed > 0 && (
                <div className="lesson-material-management__bulk-stat error">
                  <i className="isax isax-close-circle" />
                  <span>{bulk.result.totalFailed} lỗi</span>
                </div>
              )}
            </div>
            {bulk.result.errors.length > 0 && (
              <div className="lesson-material-management__bulk-errors">
                <h6>Chi tiết lỗi:</h6>
                {bulk.result.errors.map((error, index) => (
                  <div className="lesson-material-management__bulk-error-item" key={`${error.index}-${index}`}>
                    <span className="lesson-material-management__bulk-error-title">
                      <i className="isax isax-warning-2 me-1" />
                      {error.title || `Tệp #${error.index + 1}`}
                    </span>
                    <span className="lesson-material-management__bulk-error-msg">{error.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : processing ? (
          <div className="lesson-material-management__bulk-processing">
            <div className="lesson-material-management__bulk-phase">
              <span className="spinner-border spinner-border-sm me-2" />
              {bulk.progress.phase}
            </div>
            <div className="progress mt-3" style={{ height: 16 }}>
              <div className="progress-bar progress-bar-striped progress-bar-animated bg-danger" style={{ width: `${bulk.progress.total > 0 ? (bulk.progress.current / bulk.progress.total) * 100 : 0}%` }}>
                {bulk.progress.current}/{bulk.progress.total}
              </div>
            </div>
            <div className="lesson-material-management__bulk-processing-list">
              {bulk.items.map((item, index) => (
                <div className={`lesson-material-management__bulk-file-status ${item.uploadStatus}`} key={index}>
                  <span className="lesson-material-management__bulk-file-name">{item.file.name}</span>
                  <span className="lesson-material-management__bulk-file-badge">
                    {item.uploadStatus === "uploaded" && <i className="isax isax-tick-circle text-success" />}
                    {item.uploadStatus === "uploading" && <span className="spinner-border spinner-border-sm" />}
                    {item.uploadStatus === "error" && <i className="isax isax-close-circle text-danger" />}
                    {item.uploadStatus === "idle" && <i className="isax isax-clock text-muted" />}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="lesson-material-management__modal-notice">
              <i className="isax isax-info-circle" />
              <span>Chọn tối đa {MAX_BULK_FILES} tệp, tất cả thêm vào CÙNG một bộ tài liệu (loại tài liệu theo loại của bộ đó).</span>
            </div>
            {!storageConfigured && (
              <div className="alert alert-warning py-2 small" role="status">
                {STORAGE_NOT_CONFIGURED_MESSAGE} Chưa thể tải tệp lên.
              </div>
            )}

            <div className="row g-3 mb-3">
              <div className="col-12">
                <label className="form-label" htmlFor="lm-bulk-files">
                  Chọn tệp (nhiều tệp cùng lúc)
                </label>
                <input
                  id="lm-bulk-files"
                  type="file"
                  className="form-control"
                  accept={ACCEPTED_MATERIAL_FILE_TYPES}
                  multiple
                  disabled={!storageConfigured}
                  onChange={(e) => {
                    const input = e.currentTarget;
                    setItems((prev) => appendBulkFiles(prev, Array.from(input.files ?? [])));
                    input.value = ""; // chọn lại cùng tệp vẫn bắn onChange, như bản cũ
                  }}
                />
              </div>
              <div className="col-md-8">
                <label className="form-label" htmlFor="lm-bulk-group">
                  Bộ tài liệu (áp dụng cho tất cả)
                </label>
                <select id="lm-bulk-group" className="form-select" value={groupSelection} onChange={(e) => setGroupSelection(e.target.value)}>
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
              {groupSelection === NEW_GROUP && (
                <>
                  <div className="col-md-4">
                    <label className="form-label" htmlFor="lm-bulk-new-group-type">
                      Loại bộ mới
                    </label>
                    <select id="lm-bulk-new-group-type" className="form-select" value={newGroupType} onChange={(e) => setNewGroupType(e.target.value as LessonMaterialType)}>
                      {LESSON_MATERIAL_TYPE_ORDER.map((type) => (
                        <option value={type} key={type}>
                          {LESSON_MATERIAL_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="lm-bulk-new-group">
                      Tên bộ tài liệu mới
                    </label>
                    <input id="lm-bulk-new-group" className="form-control" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Ví dụ: HSK 3" />
                  </div>
                </>
              )}
            </div>

            {items.length > 0 && (
              <div className="lesson-material-management__bulk-file-list">
                <div className="lesson-material-management__bulk-file-header">
                  <span>
                    Tệp ({items.length}/{MAX_BULK_FILES})
                  </span>
                  <button type="button" className="btn btn-link btn-sm text-danger p-0" onClick={() => setItems([])}>
                    Xóa tất cả
                  </button>
                </div>
                {items.map((item, index) => (
                  <div className="lesson-material-management__bulk-file-row" key={`${item.file.name}-${index}`}>
                    <div className="lesson-material-management__bulk-file-info">
                      <input className="form-control form-control-sm lesson-material-management__bulk-title-input" value={item.title} onChange={(e) => update(index, { title: e.target.value })} placeholder="Tên tài liệu" aria-label={`Tên tài liệu ${index + 1}`} />
                      <span className="lesson-material-management__bulk-file-size">{formatBytes(item.file.size)}</span>
                    </div>
                    <div className="lesson-material-management__bulk-file-controls">
                      <button type="button" className="btn btn-link btn-sm text-muted p-0 ms-2" onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))} aria-label={`Bỏ tệp ${item.file.name}`}>
                        <i className="isax isax-trash" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
