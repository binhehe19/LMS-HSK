"use client";

// Modal chi tiết video (thay video-player-modal.tsx cũ). Khác bản cũ có chủ đích: bản cũ phát HLS `/api/storage/videos/{code}/playlist` bằng hls.js
// + phụ đề karaoke; app mới không thêm thư viện và phụ đề không chuyển => phát trực tiếp tệp gốc từ repo-storage (fileUrl(fileId)) bằng <video>
// khi có `fileId` và dịch vụ đã cấu hình, ngược lại hiện ghi chú "chưa có nguồn phát"; phần phụ đề chỉ hiện số lượng.
import { Modal } from "antd";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { fileUrl } from "@/lib/api/storage-client";
import { formatVideoDate, videoStatusLabel } from "@/lib/hsk-storage/storage-model";
import { formatBytes } from "@/lib/lesson-materials/lesson-material-model";
import type { StorageVideo, StorageVideoDetails } from "@/types/hsk-storage";

export interface VideoDetailModalProps {
  video: StorageVideo | null;
  state: FetchState<StorageVideoDetails>;
  onClose: () => void;
  onRetry: () => void;
}

export function VideoDetailModal({ video, state, onClose, onRetry }: VideoDetailModalProps) {
  if (!video) return null;
  const detail = state.kind === "ok" ? state.data : video;
  const source = fileUrl(detail.fileId);
  return (
    <Modal open centered width={960} title={video.name} onCancel={onClose} footer={null}>
      <div className="row g-4" data-testid="storage-video-detail">
        <div className="col-lg-8">
          {source ? (
            <div className="ratio ratio-16x9 bg-black rounded-3 overflow-hidden">
              <video controls className="w-100 h-100" src={source} data-testid="storage-video-player" />
            </div>
          ) : (
            <div className="alert alert-secondary mb-0" role="status" data-testid="storage-video-no-source">
              Chưa có nguồn phát cho video này (HSK cũ phát HLS playlist của kho riêng; app mới phát tệp gốc từ repo-storage khi có <code>fileId</code> và dịch vụ đã cấu hình).
            </div>
          )}
        </div>
        <div className="col-lg-4">
          <h6 className="fw-bold mb-3">Mô tả</h6>
          <p className="small text-muted mb-4">{detail.description || "Không có mô tả"}</p>
          <h6 className="fw-bold mb-3">Ngày tải lên</h6>
          <p className="small text-muted mb-4">{formatVideoDate(detail.createdAt)}</p>
          <h6 className="fw-bold mb-3">Trạng thái</h6>
          <p className="small text-muted mb-4">{videoStatusLabel(detail.status)}</p>
          {detail.size ? (
            <>
              <h6 className="fw-bold mb-3">Dung lượng</h6>
              <p className="small text-muted mb-4">{formatBytes(detail.size)}</p>
            </>
          ) : null}
          <h6 className="fw-bold mb-3">Phụ đề (Subtitles)</h6>
          {state.kind === "loading" ? (
            <div className="text-center py-3">
              <div className="spinner-border spinner-border-sm text-primary" role="status" />
            </div>
          ) : state.kind === "ok" ? (
            <p className="small text-muted mb-0">{state.data.subtitles?.length ? `${state.data.subtitles.length} phụ đề` : "Chưa có phụ đề nào."} Quản lý phụ đề karaoke chưa chuyển sang app mới.</p>
          ) : (
            <FetchStateNotice state={state} waitingText="Chi tiết video chưa được kết nối API (WAITING FOR BACKEND)." onRetry={onRetry} testId="storage-video-detail-notice" />
          )}
        </div>
      </div>
    </Modal>
  );
}
