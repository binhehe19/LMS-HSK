"use client";

// Ô tải tệp (ảnh/âm thanh) cho form mục nội dung, dùng kho lưu trữ backend chung qua lib/api/storage-client (presign → PUT → confirm). Giá trị lưu là
// `fileId`; hiển thị qua `fileUrl(fileId)`. Chưa cấu hình kho lưu trữ => báo "Kho lưu trữ chưa được cấu hình" và khoá chọn tệp (không bịa URL).
// Khác HSK cũ có chủ đích: bản cũ lưu URL ảnh tự do (imageOrigin) qua MediaUploadService; ở đây ảnh/âm thanh là id tệp của repo-storage.
import { useState } from "react";
import { toast } from "sonner";
import { AssetImage } from "@/components/shared/asset-image";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { fileUrl, isStorageApiConfigured, uploadFile } from "@/lib/api/storage-client";

const STORAGE_NOT_CONFIGURED_MESSAGE = "Kho lưu trữ chưa được cấu hình";

export interface ContentFileFieldProps {
  id: string;
  label: string;
  kind: "image" | "audio";
  fileId: string | undefined;
  onChange: (fileId: string | undefined) => void;
  disabled?: boolean;
  /** Giới hạn kích thước (byte); mặc định ảnh 5MB (bản cũ), âm thanh 10MB. */
  maxBytes?: number;
}

export function ContentFileField({ id, label, kind, fileId, onChange, disabled, maxBytes }: ContentFileFieldProps) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const configured = isStorageApiConfigured();
  const url = fileUrl(fileId);
  const limit = maxBytes ?? (kind === "image" ? 5 * 1024 * 1024 : 10 * 1024 * 1024);
  const accept = kind === "image" ? "image/*" : "audio/*";

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith(kind === "image" ? "image/" : "audio/")) {
      toast.error(kind === "image" ? "Vui lòng chọn file ảnh" : "Vui lòng chọn file âm thanh");
      return;
    }
    if (file.size > limit) {
      toast.error(`${kind === "image" ? "Ảnh" : "Âm thanh"} không được vượt quá ${Math.round(limit / 1024 / 1024)}MB`);
      return;
    }
    setError(null);
    setProgress(0);
    try {
      const meta = await uploadFile(file, setProgress);
      onChange(meta.fileId);
      toast.success(kind === "image" ? "Tải ảnh thành công!" : "Tải âm thanh thành công!");
    } catch (e) {
      const message = e instanceof ApiNotConfiguredError ? STORAGE_NOT_CONFIGURED_MESSAGE : e instanceof ApiError ? e.message : "Tải tệp lên thất bại, vui lòng thử lại";
      setError(message);
      toast.error(message);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="content-file-field" data-testid={`file-field-${kind}`}>
      <label className="form-label small fw-700 text-muted mb-1" htmlFor={id}>
        {label}
      </label>
      {url && (
        <div className="d-flex align-items-center gap-3 mb-2">
          {kind === "image" ? <AssetImage src={url} alt={label} className="rounded-3 border" style={{ width: 72, height: 72, objectFit: "cover" }} /> : <audio controls src={url} preload="none" style={{ maxWidth: 260 }} />}
          {!disabled && (
            <button type="button" className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => onChange(undefined)} title="Xóa tệp">
              <i className="isax isax-trash me-1" />
              Xóa
            </button>
          )}
        </div>
      )}
      <input
        id={id}
        type="file"
        className="form-control form-control-sm"
        accept={accept}
        disabled={disabled || !configured || progress !== null}
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {!configured && (
        <small className="text-muted d-block mt-1" data-testid="storage-not-configured">
          {STORAGE_NOT_CONFIGURED_MESSAGE}: chưa tải tệp lên được, có thể lưu mục không kèm tệp.
        </small>
      )}
      {progress !== null && (
        <div className="progress mt-2" style={{ height: 6 }} aria-label="Tiến độ tải lên">
          <div className="progress-bar bg-primary" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {error && <small className="text-danger d-block mt-1">{error}</small>}
    </div>
  );
}
