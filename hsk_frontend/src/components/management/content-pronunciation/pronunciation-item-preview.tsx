"use client";

// Xem nhanh một mục phát âm ở cấp mục — port "EXPANDED DETAIL ROW" (item-detail-panel) của manage-pronunciation.tsx cũ: ký hiệu + pinyin, khối
// "Hướng dẫn phát âm" (.pronunciation-guide-box), "Media & Hỗ trợ" (hình miệng .media-thumb + nút Phát âm/Tạm dừng). Cùng class để SCSS cũ áp dụng.
// Khác bản cũ có chủ đích: âm thanh/ảnh lấy từ repo-storage theo fileId; không có tệp âm thanh thì đọc bằng Web Speech API (zh-CN) thay vì nút bị khoá.
import { useEffect, useRef, useState } from "react";
import { AssetImage } from "@/components/shared/asset-image";
import { fileUrl } from "@/lib/api/storage-client";
import type { PronunciationItem } from "@/types/content-pronunciation";

export function PronunciationItemPreview({ item }: { item: PronunciationItem }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const audio = fileUrl(item.audioFileId);
  const image = fileUrl(item.imageFileId);

  // Đổi mục khi đang phát => dừng tệp cũ (bản cũ dọn audio khi unmount). Chụp phần tử lúc chạy effect vì ref đổi khi mục đổi.
  useEffect(() => {
    const element = audioRef.current;
    return () => {
      element?.pause();
    };
  }, [item.id]);

  const toggle = () => {
    if (audio && audioRef.current) {
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
        return;
      }
      // Promise.resolve: một số môi trường (jsdom) trả undefined thay cho Promise từ play().
      void Promise.resolve(audioRef.current.play())
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
      return;
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.lang = "zh-CN";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="card border-0 shadow-sm rounded-4 overflow-hidden" data-testid="pronunciation-preview" data-playing={playing}>
      <div className="item-detail-panel">
        <div className="row g-3">
          <div className="col-md-5 border-end">
            <div className="d-flex align-items-baseline gap-3 mb-3">
              <span className="fw-bold text-primary flashcard-term-cell" style={{ fontSize: "2rem", lineHeight: 1 }}>
                {item.text}
              </span>
              <span className="fw-medium text-dark fs-5">{item.pinyin || "—"}</span>
            </div>
            <div className="detail-section-label">Hướng dẫn phát âm</div>
            <div className="pronunciation-guide-box mb-0">{item.tip || "Chưa có hướng dẫn phát âm."}</div>
          </div>

          <div className="col-md-4 border-end">
            <div className="detail-section-label">Media & Hỗ trợ</div>
            <div className="d-flex gap-3 mb-3">
              {image ? (
                <div>
                  <div className="small text-muted mb-1">Hình miệng</div>
                  <div className="media-thumb">
                    <AssetImage src={image} alt={`Hình miệng ${item.text}`} />
                  </div>
                </div>
              ) : (
                <small className="text-muted">Chưa có hình miệng.</small>
              )}
            </div>
            <div className="d-grid">
              <button type="button" className={`btn btn-sm ${playing ? "btn-danger" : "btn-outline-primary"} d-flex align-items-center justify-content-center py-1`} style={{ fontSize: "12px" }} onClick={toggle} title={audio ? "Phát tệp âm thanh mẫu" : "Đọc bằng giọng máy (chưa có tệp âm thanh)"}>
                <i className={`isax ${playing ? "isax-pause" : "isax-volume-high"} me-1`} /> {playing ? "Tạm dừng" : "Phát âm"}
              </button>
              {audio && <audio ref={audioRef} src={audio} preload="none" onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} />}
            </div>
          </div>

          <div className="col-md-3">
            <div className="detail-section-label">Thông tin thêm</div>
            <div className="d-flex flex-column gap-2">
              <div className="bg-light rounded-3 p-2">
                <div className="small text-muted">Thứ tự</div>
                <div className="fw-bold text-dark">{(item.index ?? 0) + 1}</div>
              </div>
              <div className="bg-light rounded-3 p-2">
                <div className="small text-muted">Tệp</div>
                <div className="fw-bold text-dark small">{[audio ? "Âm thanh" : null, image ? "Hình miệng" : null].filter(Boolean).join(", ") || "Không có"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
