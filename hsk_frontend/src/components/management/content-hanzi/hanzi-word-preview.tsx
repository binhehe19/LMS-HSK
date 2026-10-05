"use client";

// Xem nhanh một chữ Hán ở cấp mục: chữ lớn trong ô 田字格 (CSS, manage-hanzi.scss), pinyin, nghĩa, số nét/bộ thủ/Hán Việt, ví dụ, nút phát âm.
// Không có trong manage-hanzi.tsx cũ (bản cũ bấm bộ là sang trang sửa); animation nét bằng thư viện hanzi-writer của trang luyện viết học viên KHÔNG
// chuyển (không thêm thư viện) — chỉ hiển thị tĩnh. Phát âm dùng Web Speech API (zh-CN) như useTextToSpeech cũ.
import type { HanziWord } from "@/types/content-writing";

export function HanziWordPreview({ item }: { item: HanziWord }) {
  const speak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(item.hanzi);
    utterance.lang = "zh-CN";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="card border-0 shadow-sm rounded-4 hanzi-word-preview" data-testid="hanzi-preview">
      <div className="card-body p-4 d-flex flex-wrap align-items-center gap-4">
        <div className="hanzi-glyph-box flex-shrink-0" aria-label={`Chữ ${item.hanzi}`}>
          <span className="hanzi-glyph">{item.hanzi}</span>
        </div>
        <div className="flex-grow-1 min-width-0">
          <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
            <h3 className="fw-800 mb-0 hanzi-preview-pinyin">{item.pinyin || "Chưa có phiên âm"}</h3>
            <button type="button" className="flashcard-manage-audio-btn" onClick={speak} title="Phát âm" aria-label="Phát âm">
              <i className="isax isax-volume-high" />
            </button>
          </div>
          <p className="fs-5 fw-600 text-dark mb-2">{item.meaning || "Chưa có nghĩa"}</p>
          <div className="d-flex flex-wrap gap-2 mb-2">
            <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle px-3 py-2">Số nét: {typeof item.strokeCount === "number" ? item.strokeCount : "—"}</span>
            <span className="badge rounded-pill bg-warning-subtle text-warning-emphasis border border-warning-subtle px-3 py-2">Bộ thủ: {item.radical || "—"}</span>
            <span className="badge rounded-pill bg-light text-dark border px-3 py-2">Hán Việt: {item.sinoVn || "—"}</span>
          </div>
          {(item.example || item.exampleMeaning) && (
            <div className="hanzi-preview-example bg-light rounded-3 p-3">
              {item.example && <div className="fw-700 text-dark flashcard-term-cell">{item.example}</div>}
              {item.exampleMeaning && <div className="small text-muted">{item.exampleMeaning}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
