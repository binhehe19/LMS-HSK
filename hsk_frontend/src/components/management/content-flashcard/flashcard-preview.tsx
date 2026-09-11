"use client";

// Thẻ lật xem nhanh một thẻ ghi nhớ — port khối "Flashcard Viewer Display" của manage-flashcard.tsx cũ (cùng DOM/class .flashcard-viewer/.flashcard-inner/
// .flashcard-face để SCSS cũ áp dụng). Mặt trước: ảnh, chữ Hán, nút phát âm, pinyin, từ loại; mặt sau: nghĩa, ví dụ, dịch câu.
// Khác bản cũ có chủ đích: phát âm ưu tiên tệp âm thanh đã tải lên (audioFileId), không có thì dùng Web Speech API (zh-CN) như useTextToSpeech cũ;
// không có nút Trước/Tiếp (bảng mục bên dưới thay cho danh sách thẻ).
import { useRef, useState } from "react";
import { AssetImage } from "@/components/shared/asset-image";
import { fileUrl } from "@/lib/api/storage-client";
import type { FlashcardCard } from "@/types/content-flashcard";

export function FlashcardPreview({ item }: { item: FlashcardCard }) {
  const [flipped, setFlipped] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const image = fileUrl(item.imageFileId);
  const audio = fileUrl(item.audioFileId);

  const speak = () => {
    if (audio && audioRef.current) {
      void audioRef.current.play().catch(() => undefined);
      return;
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(item.term);
    utterance.lang = "zh-CN";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flashcard-viewer mb-4 shadow-sm" onClick={() => setFlipped((f) => !f)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setFlipped((f) => !f); }} data-testid="flashcard-preview" data-flipped={flipped}>
      <div className={`flashcard-inner ${flipped ? "flipped" : ""}`}>
        <div className="card border-0 shadow-sm p-4 position-absolute w-100 flashcard-face flashcard-front rounded-4">
          <div className="text-center w-100 flashcard-front-content">
            <p className="small opacity-75 mb-0 text-uppercase fw-700 tracking-wider text-muted">Mặt trước</p>
            {image && (
              <div className="flashcard-image-wrap">
                <AssetImage src={image} alt={item.term} className="rounded-3 shadow-sm flashcard-term-img" />
              </div>
            )}
            <h2 className="fw-800 mb-0 flashcard-term-text">{item.term}</h2>
            <button type="button" className="flashcard-manage-audio-btn" onClick={(e) => { e.stopPropagation(); speak(); }} title="Phát âm" aria-label="Phát âm">
              <i className="isax isax-volume-high" />
            </button>
            {audio && <audio ref={audioRef} src={audio} preload="none" />}
            <p className="mb-0 flashcard-pinyin-text">{item.pinyin || "Chưa có pinyin"}</p>
            <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 fw-700">{item.wordType || "Chưa có từ loại"}</span>
            <p className="small opacity-50 mb-0 fst-italic">
              <i className="isax isax-repeat-circle me-1" />
              Nhấp để xem mặt sau
            </p>
          </div>
        </div>

        <div className="card border-0 shadow-sm position-absolute w-100 flashcard-face flashcard-back rounded-4 bg-primary bg-opacity-10">
          <p className="small opacity-75 mb-0 text-uppercase fw-700 tracking-wider text-primary flashcard-back-header">Mặt sau</p>
          <div className="flashcard-back-scroll">
            <div className="flashcard-back-content">
              <div className="flashcard-detail-block">
                <p className="flashcard-detail-title mb-1">Nghĩa tiếng Việt</p>
                <p className="flashcard-detail-text mb-0">{item.meaning || "Chưa có nghĩa tiếng Việt"}</p>
              </div>
              <div className="flashcard-detail-block">
                <p className="flashcard-detail-title mb-1">Ví dụ minh hoạ</p>
                <p className="flashcard-detail-example mb-0">{item.example || "Chưa có ví dụ"}</p>
              </div>
              <div className="flashcard-detail-block">
                <p className="flashcard-detail-title mb-1">Dịch câu</p>
                <p className="flashcard-detail-example mb-0">{item.exampleMeaning || "Chưa có bản dịch"}</p>
              </div>
            </div>
          </div>
          <p className="small opacity-50 mb-0 fst-italic text-primary flashcard-back-footer">
            <i className="isax isax-repeat-circle me-1" />
            Nhấp để quay lại mặt trước
          </p>
        </div>
      </div>
    </div>
  );
}
