// Client cho repo-storage của backend chung (`/api/storage/*`, Go/Echo, JSON trần không bọc {success,data}). Hợp đồng đọc từ source 2026-10-27:
//   POST /file/presign {filename, mimeType, sizeBytes} → {fileId, presignedUrl, expiresIn}; client PUT tệp thẳng lên URL ký sẵn (KHÔNG gửi Authorization);
//   POST /file/{id}/confirm → {fileId, filename, mimeType, sizeBytes}; GET /file/{id}?disposition=inline|attachment (hỗ trợ Range; không phải ảnh thì ép tải về).
// Trạng thái: AVAILABLE (chưa xác minh trên môi trường thật). Để trống NEXT_PUBLIC_STORAGE_API_BASE_PATH => ApiNotConfiguredError.
"use client";

import { ApiError, ApiNotConfiguredError, createApiClient } from "@/lib/api/api-client";

function getStorageApiBase(): string | null {
  const base = process.env.NEXT_PUBLIC_STORAGE_API_BASE_PATH?.trim().replace(/\/+$/, "");
  return base || null;
}

export function isStorageApiConfigured(): boolean {
  return getStorageApiBase() !== null;
}

const client = createApiClient(getStorageApiBase);

export interface PresignResponse {
  fileId: string;
  presignedUrl: string;
  expiresIn?: number;
}

export interface FileMeta {
  fileId: string;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number;
}

/** URL tải/xem một tệp theo id; null khi chưa cấu hình dịch vụ (giao diện hiện "Không có tệp" thay vì bịa URL). */
export function fileUrl(fileId: string | undefined | null, disposition: "inline" | "attachment" = "inline"): string | null {
  const base = getStorageApiBase();
  if (!base || !fileId) return null;
  return `${base}/file/${encodeURIComponent(fileId)}?disposition=${disposition}`;
}

/**
 * Tải tệp lên theo 3 bước của backend chung. `onProgress` nhận 0..1 (bước PUT dùng XMLHttpRequest để có tiến độ). Thao tác ghi: nơi gọi phải qua write gate
 * của miền tương ứng trước (storage/lesson-materials/content...).
 */
export async function uploadFile(file: File, onProgress?: (ratio: number) => void): Promise<FileMeta> {
  if (!isStorageApiConfigured()) throw new ApiNotConfiguredError();
  const presign = await client.post<PresignResponse>("/file/presign", { filename: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size });
  if (!presign?.fileId || !presign.presignedUrl) throw new ApiError("Dịch vụ lưu trữ không trả URL tải lên hợp lệ.", 200);
  await putToPresignedUrl(presign.presignedUrl, file, onProgress);
  const meta = await client.post<FileMeta>(`/file/${encodeURIComponent(presign.fileId)}/confirm`);
  return { ...meta, fileId: meta?.fileId || presign.fileId };
}

function putToPresignedUrl(url: string, file: File, onProgress?: (ratio: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new ApiError(`Tải tệp lên thất bại (${xhr.status}).`, xhr.status)));
    xhr.onerror = () => reject(new ApiError("Không thể kết nối tới kho lưu trữ để tải tệp lên.", 0));
    xhr.send(file);
  });
}
