"use client";

// Modal "Tải video lên" (video-upload-modal.tsx cũ => antd Modal, cùng trường/nhãn/ghi chú). Không gọi API: tệp + tên + mô tả chuyển cho container
// (tải lên repo-storage rồi POST /storage/videos). Khác bản cũ có chủ đích: bản cũ đóng modal ngay và tải "fire and forget" bằng toast; ở đây modal
// giữ mở, hiện tiến độ tải lên và chỉ đóng khi video đã được đăng ký (lỗi thì giữ nguyên để thử lại). repo-storage chưa cấu hình => ô tệp khoá + dòng báo.
import { Modal } from "antd";
import { useState } from "react";
import { STORAGE_NOT_CONFIGURED_MESSAGE } from "@/lib/api/write-error-message";
import { defaultVideoTitle, formatMegabytes, validateVideoFile } from "@/lib/hsk-storage/storage-model";

export interface VideoUploadModalProps {
  submitting: boolean;
  /** 0..1 trong lúc tải lên repo-storage; null khi không tải. */
  uploadProgress: number | null;
  storageConfigured: boolean;
  onCancel: () => void;
  onSubmit: (file: File, title: string, description: string) => void;
}

export function VideoUploadModal({ submitting, uploadProgress, storageConfigured, onCancel, onSubmit }: VideoUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const uploading = uploadProgress !== null;
  const percent = Math.round((uploadProgress ?? 0) * 100);

  return (
    <Modal
      title={
        <span>
          <i className="isax isax-video-add me-2" />
          Tải video lên
        </span>
      }
      open
      centered
      width={720}
      closable={!submitting}
      maskClosable={!submitting}
      onCancel={onCancel}
      onOk={() => file && onSubmit(file, title, description)}
      okText={uploading ? `Đang tải lên... ${percent}%` : submitting ? "Đang lưu..." : "Tải video lên"}
      cancelText="Hủy"
      okButtonProps={{ disabled: submitting || !storageConfigured || !file || !title.trim() }}
      cancelButtonProps={{ disabled: submitting }}
      confirmLoading={submitting}
    >
      <div data-testid="storage-video-upload">
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        {!storageConfigured && (
          <div className="alert alert-warning py-2 small" role="status" data-testid="storage-video-unconfigured">
            {STORAGE_NOT_CONFIGURED_MESSAGE} Chưa thể tải video lên.
          </div>
        )}
        <div className="mb-3">
          <label className="form-label" htmlFor="video-upload-file">
            Tệp video <span className="text-danger">*</span>
          </label>
          <input
            id="video-upload-file"
            type="file"
            className="form-control"
            accept="video/*"
            disabled={submitting || !storageConfigured}
            title="Chọn file video để tải lên"
            onChange={(e) => {
              const selected = e.currentTarget.files?.[0] ?? null;
              if (!selected) return;
              const invalid = validateVideoFile(selected);
              setError(invalid);
              if (invalid) return;
              setFile(selected);
              setTitle((prev) => prev || defaultVideoTitle(selected.name)); // tự điền tên nếu còn trống (bản cũ)
            }}
          />
          <small className="form-text text-muted">Định dạng hỗ trợ: MP4, AVI, MOV... Dung lượng tối đa: 1GB</small>
          {file && (
            <div className="mt-2">
              <small className="text-success">
                <i className="isax isax-tick-circle me-1" />
                Đã chọn: {file.name} ({formatMegabytes(file.size)})
              </small>
            </div>
          )}
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="video-upload-title">
            Tên video <span className="text-danger">*</span>
          </label>
          <input id="video-upload-title" type="text" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Giới thiệu HSK cấp 1" disabled={submitting} />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="video-upload-description">
            Mô tả
          </label>
          <textarea id="video-upload-description" className="form-control" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả ngắn về video này..." disabled={submitting} />
        </div>
        {uploading && (
          <div className="mb-2">
            <div className="d-flex justify-content-between mb-1">
              <span className="text-primary fw-medium">Đang tải lên...</span>
              <span className="text-primary fw-medium">{percent}%</span>
            </div>
            <div className="progress" style={{ height: 8 }}>
              <div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
