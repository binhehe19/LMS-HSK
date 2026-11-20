"use client";

// Ô tải tệp (ảnh/âm thanh) cho form mục nội dung, dùng kho lưu trữ backend chung qua lib/api/storage-client (presign → PUT → confirm). Giá trị lưu là
// `fileId`; hiển thị qua `fileUrl(fileId)`. Chưa cấu hình kho lưu trữ => báo "Kho lưu trữ chưa được cấu hình" và khoá chọn tệp (không bịa URL).
// Khác HSK cũ có chủ đích: bản cũ lưu URL ảnh tự do (imageOrigin) qua MediaUploadService; ở đây ảnh/âm thanh là id tệp của repo-storage.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AssetImage } from "@/components/shared/asset-image";
import { confirmAction } from "@/components/shared/confirm-action";
import { ApiError, ApiNotConfiguredError } from "@/lib/api/api-client";
import { fetchStoredAudio, fileUrl, isStorageApiConfigured, uploadFile } from "@/lib/api/storage-client";

const STORAGE_NOT_CONFIGURED_MESSAGE = "Kho lưu trữ chưa được cấu hình";

export function ContentAudioPreview({ url, label }: { url: string; label: string }) {
  const [resolved, setResolved] = useState<{ source: string; objectUrl: string | null }>();
  useEffect(() => {
    const controller = new AbortController();
    const stored = fetchStoredAudio(url, controller.signal);
    if (!stored) return;
    let objectUrl: string | undefined;
    void stored.then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setResolved({ source: url, objectUrl });
    }).catch(() => {
      if (!controller.signal.aborted) setResolved({ source: url, objectUrl: null });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  const src = resolved?.source === url ? resolved.objectUrl : url;
  return src
    ? <audio controls src={src} preload="none" aria-label={label} style={{ maxWidth: "100%" }} />
    : <span className="small text-danger">Không tải được tệp để nghe thử.</span>;
}

export function ContentImagePreview({ url, alt, children }: { url?: string | null; alt: string; children?: ReactNode }) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const imageUrl = url && failedImageUrl !== url ? url : null;

  return (
    <div className={`content-image-preview${imageUrl ? " has-image" : ""}`}>
      {imageUrl && <AssetImage src={imageUrl} alt={alt} onError={() => setFailedImageUrl(imageUrl)} />}
      {url && !imageUrl && (
        <span className="d-flex align-items-center gap-2 small text-muted" role="status">
          <i className="isax isax-image fs-5" aria-hidden="true" />
          Không xem được ảnh hiện tại
        </span>
      )}
      {!url && !children && <span className="small text-muted">Chưa có hình minh họa</span>}
      {children}
    </div>
  );
}

export interface ContentFileFieldProps {
  id: string;
  label: string;
  kind: "image" | "audio";
  fileId?: string;
  previewUrl?: string;
  previewSelectedAudio?: boolean;
  imageOverlay?: boolean;
  confirmRemove?: boolean;
  onChange: (fileId: string | undefined) => void;
  onUploadingChange?: (uploading: boolean) => void;
  disabled?: boolean;
  /** Giới hạn kích thước (byte); mặc định ảnh 5MB (bản cũ), âm thanh 10MB. */
  maxBytes?: number;
}

export function ContentFileField({ id, label, kind, fileId, previewUrl, previewSelectedAudio, imageOverlay, confirmRemove, onChange, onUploadingChange, disabled, maxBytes }: ContentFileFieldProps) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const configured = isStorageApiConfigured();
  const input = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<{ url: string; name: string } | null>(null);
  useEffect(() => () => {
    if (localPreview) URL.revokeObjectURL(localPreview.url);
  }, [localPreview]);
  const url = localPreview?.url || previewUrl || fileUrl(fileId);
  const hasImageOverlay = kind === "image" && imageOverlay;
  const canPick = !disabled && configured && progress === null;
  const limit = maxBytes ?? (kind === "image" ? 5 * 1024 * 1024 : 10 * 1024 * 1024);
  const accept = kind === "image" ? "image/*" : "audio/*";

  const remove = async () => {
    if (confirmRemove && !await confirmAction({
      title: `Xóa ${label.toLocaleLowerCase("vi")}?`,
      content: "Thay đổi có hiệu lực sau khi lưu.",
      okText: "Xóa",
      danger: true,
    })) return;
    setLocalPreview(null);
    onChange(undefined);
  };

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
    if (previewSelectedAudio) setLocalPreview({ url: URL.createObjectURL(file), name: file.name });
    setProgress(0);
    onUploadingChange?.(true);
    try {
      const meta = await uploadFile(file, setProgress);
      onChange(meta.fileId);
      toast.success(kind === "image" ? "Tải ảnh thành công!" : "Tải âm thanh thành công!");
    } catch (e) {
      setLocalPreview(null);
      const message = e instanceof ApiNotConfiguredError ? STORAGE_NOT_CONFIGURED_MESSAGE : e instanceof ApiError ? e.message : "Tải tệp lên thất bại, vui lòng thử lại";
      setError(message);
      toast.error(message);
    } finally {
      setProgress(null);
      onUploadingChange?.(false);
    }
  };

  return (
    <div className="content-file-field" data-testid={`file-field-${kind}`}>
      <label className="form-label small fw-700 text-muted mb-1" htmlFor={id}>
        {label}
      </label>
      {hasImageOverlay && (
        <ContentImagePreview url={url} alt={label}>
          <div className="content-image-preview-actions">
            <button type="button" className="btn btn-outline-primary" disabled={!canPick} onClick={() => input.current?.click()}>
              <i className="isax isax-image me-1" aria-hidden="true" />
              {url ? "Đổi ảnh" : "Chọn ảnh"}
            </button>
            {url && !disabled && (
              <button type="button" className="btn btn-outline-danger" onClick={() => void remove()} aria-label="Xóa ảnh" title="Xóa ảnh">
                <i className="isax isax-trash" aria-hidden="true" />
              </button>
            )}
          </div>
        </ContentImagePreview>
      )}
      {!hasImageOverlay && url && (
        <div className="d-flex align-items-center gap-3 mb-2">
          {kind === "image" ? <AssetImage src={url} alt={label} className="rounded-3 border" style={{ width: 72, height: 72, objectFit: "cover" }} />
            : previewSelectedAudio ? <ContentAudioPreview url={url} label="Nghe thử tệp phát âm" />
            : <audio controls src={url} preload="none" style={{ maxWidth: 260 }} />}
          {!disabled && (
            <button type="button" className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => void remove()} title="Xóa tệp">
              <i className="isax isax-trash me-1" />
              Xóa
            </button>
          )}
        </div>
      )}
      {previewSelectedAudio && (
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button type="button" className="btn btn-sm btn-outline-primary" disabled={!canPick} onClick={() => input.current?.click()}>
            {url ? "Chọn tệp mới" : "Chọn tệp âm thanh"}
          </button>
          {localPreview && <span className="small text-muted">{localPreview.name}</span>}
        </div>
      )}
      <input
        id={id}
        ref={input}
        type="file"
        hidden={previewSelectedAudio || hasImageOverlay}
        className="form-control form-control-sm"
        accept={accept}
        disabled={!canPick}
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
