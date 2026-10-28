"use client";

// Port của storage-video-list.tsx HSK cũ (cùng DOM `.video-repository-view` + `.videos-thumbnail-grid` + `.video-thumbnail-card`, chữ, biểu tượng).
// Khác bản cũ có chủ đích: ảnh mascot dự phòng dùng hocbadentrang.png đã có trong /public (LOGOHBMascot.png nặng 5MB không sao chép); modal phát
// video + tải phụ đề karaoke KHÔNG chuyển — nút "Xem" mở modal chi tiết (video-detail-modal.tsx); lỗi/chưa cấu hình => FetchStateNotice.
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { AssetImage } from "@/components/shared/asset-image";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { episodeTag, formatVideoDate, videoStatusColor, videoStatusLabel } from "@/lib/hsk-storage/storage-model";
import type { StorageVideo } from "@/types/hsk-storage";

export const VIDEO_FALLBACK_IMAGE = "/assets/hocba/hocbadentrang.png";

export interface StorageVideoListProps {
  state: FetchState<StorageVideo[]>;
  videos: StorageVideo[];
  canManage: boolean;
  writeEnabled: boolean;
  onUpload: () => void;
  onDelete: (video: StorageVideo) => void;
  onOpen: (video: StorageVideo) => void;
  onReload: () => void;
}

export function StorageVideoList({ state, videos, canManage, writeEnabled, onUpload, onDelete, onOpen, onReload }: StorageVideoListProps) {
  const loading = state.kind === "loading" && videos.length === 0;
  return (
    <div className="storage-view-container video-repository-view" data-testid="storage-videos">
      <div className="view-header">
        <div className="view-info">
          <i className="isax isax-video-play" />
          <div>
            <h2 className="view-title">Kho Video Media</h2>
          </div>
        </div>
        <div className="view-actions d-flex gap-2">
          <button type="button" className="btn btn-light rounded-pill px-3 shadow-sm d-flex align-items-center border" onClick={onReload} title="Tải lại danh sách">
            <i className="isax isax-refresh me-1" />
            Tải lại
          </button>
          {canManage && (
            <button type="button" className="btn btn-primary rounded-pill px-4 shadow-sm d-flex align-items-center fw-600" onClick={onUpload} disabled={!writeEnabled}>
              <i className="isax isax-add-circle me-1" />
              Tải lên Media
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-overlay" data-testid="storage-videos-loading">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : state.kind === "waiting" || state.kind === "error" ? (
        <FetchStateNotice state={state} waitingText="Kho video chưa được kết nối API (WAITING FOR BACKEND)." onRetry={onReload} testId="storage-videos-notice" />
      ) : videos.length === 0 ? (
        <div className="text-center py-5 bg-white rounded-4 border shadow-sm mx-3" data-testid="storage-videos-empty">
          <div className="mb-3 opacity-25">
            <i className="isax isax-video-slash" style={{ fontSize: 48, color: "#B10019" }} />
          </div>
          <h6 className="text-muted fw-600">Kho video đang trống</h6>
          <p className="text-muted small">Bắt đầu bằng cách tải lên video đầu tiên của bạn</p>
        </div>
      ) : (
        <div className="videos-thumbnail-grid p-3">
          {videos.map((video, index) => (
            <div key={video.id} className="video-thumbnail-card position-relative" role="button" tabIndex={0} onClick={() => onOpen(video)} onKeyDown={(e) => e.key === "Enter" && onOpen(video)} style={{ cursor: "pointer" }} data-testid="storage-video-card">
              {canManage && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm rounded-circle position-absolute d-flex align-items-center justify-content-center shadow-sm"
                  style={{ top: 12, right: 12, zIndex: 10, width: 32, height: 32, padding: 0, border: "none" }}
                  disabled={!writeEnabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(video);
                  }}
                  title="Xóa video khỏi kho lưu trữ"
                  aria-label={`Xóa video ${video.name}`}
                >
                  <i className="isax isax-trash" />
                </button>
              )}
              <div className="card-cover" style={video.thumbnailUrl ? { backgroundImage: `url(${video.thumbnailUrl})` } : undefined}>
                {!video.thumbnailUrl && (
                  <div className="fallback-icon">
                    <AssetImage src={VIDEO_FALLBACK_IMAGE} alt="Mascot" />
                  </div>
                )}
                <div className="overlay-play">
                  <i className="isax isax-play-circle5" />
                </div>
                <div className="status-badge" style={{ background: videoStatusColor(video.status) }}>
                  {videoStatusLabel(video.status)}
                </div>
              </div>
              <div className="card-body d-flex flex-column h-100">
                <div>
                  <div className="episode-tag">{episodeTag(index)}</div>
                  <h6 className="video-title">{video.name}</h6>
                </div>
                <div className="mt-auto pt-3 border-top mt-3 d-flex justify-content-between align-items-center">
                  <p className="video-meta mb-0 text-muted" style={{ fontSize: 13 }}>
                    <i className="isax isax-calendar-1 me-1" />
                    {formatVideoDate(video.createdAt)}
                  </p>
                  <button
                    type="button"
                    className="btn btn-sm d-flex align-items-center justify-content-center"
                    style={{ backgroundColor: "#B10019", color: "white", borderRadius: 8, padding: "4px 14px", fontSize: 13, fontWeight: 600, border: "none" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(video);
                    }}
                    aria-label={`Xem video ${video.name}`}
                  >
                    <i className="isax isax-eye me-1" style={{ fontSize: 16 }} />
                    Xem
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
