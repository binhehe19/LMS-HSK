"use client";

// Popup Luyện hội thoại + Cài đặt hội thoại (conversation-modal.tsx của HSK cũ): mỗi câu ví dụ là một lượt thoại luân phiên A/B, tốc độ đọc
// lưu ở localStorage `dialogue_audio_speed`, bật/tắt phiên âm / chữ Hán / bản dịch. Khác bản cũ: bảng Cài đặt cũng render qua portal
// (trong .hsk-vocab-modal) để SCSS đã khoanh vùng vẫn áp dụng; truy cập localStorage bọc try/catch.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { VocabularyMeaning } from "@/types/dictionary";
import { PracticeModal } from "./practice-modal";
import { VocabularyHighlight } from "./vocabulary-highlight";
import "./conversation-modal.scss";

const SPEED_KEY = "dialogue_audio_speed";
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75];

function readSpeed(): number {
  try {
    const saved = Number.parseFloat(window.localStorage.getItem(SPEED_KEY) ?? "");
    return Number.isFinite(saved) && saved > 0 ? saved : 1;
  } catch {
    return 1;
  }
}

interface ConversationModalProps {
  hanzi: string;
  hskLevel?: number;
  pinyin: string;
  meaning: string;
  wordType?: string;
  /** các câu ví dụ — mỗi câu là một lượt thoại */
  examples: VocabularyMeaning[];
  onSpeak: (text: string, rate?: number) => void;
  onStop: () => void;
  onClose: () => void;
}

export function ConversationModal({ hanzi, hskLevel, pinyin, meaning, wordType, examples, onSpeak, onStop, onClose }: ConversationModalProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showPinyin, setShowPinyin] = useState(true);
  const [showHanzi, setShowHanzi] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  // Popup chỉ mount sau khi người dùng bấm (không có SSR) nên đọc storage trong hàm khởi tạo không lệch hydrate.
  const [audioSpeed, setAudioSpeed] = useState<number>(readSpeed);

  useEffect(() => onStop, [onStop]);

  const handleSpeedChange = (speed: number) => {
    setAudioSpeed(speed);
    try {
      window.localStorage.setItem(SPEED_KEY, speed.toString());
    } catch {
      // Không lưu được thì chỉ áp dụng trong phiên hiện tại.
    }
  };

  const turns = examples
    .filter((e) => e.exampleSentenceCn)
    .map((e, i) => ({
      key: e.id ?? `turn-${i}`,
      speaker: i % 2 === 0 ? ("A" as const) : ("B" as const),
      cn: e.exampleSentenceCn ?? "",
      pinyin: e.exampleSentencePinyin ?? "",
      vi: e.exampleSentenceVi ?? "",
    }));

  const playAll = () => {
    // Nối các câu bằng dấu chấm và khoảng trắng để engine TTS ngắt nghỉ đúng
    const text = turns.map((t) => t.cn).join("。 ");
    if (text) onSpeak(text, audioSpeed);
  };

  const toggles = [
    { label: "Hiển thị phiên âm", value: showPinyin, set: setShowPinyin },
    { label: "Hiển thị chữ hán", value: showHanzi, set: setShowHanzi },
    { label: "Hiển thị bản dịch", value: showTranslation, set: setShowTranslation },
  ];

  return (
    <>
      <PracticeModal icon="isax-message-text" title="Luyện hội thoại:" hanzi={hanzi} theme="coral" onClose={onClose} noFooter>
        <div className="cv">
          <div className="cv-info">
            <div className="cv-info__left">
              <div className="cv-info__row">
                <button type="button" className="cv-speaker cv-speaker--plain" onClick={() => onSpeak(hanzi)} title="Nghe phát âm">
                  <i className="isax isax-volume-high" />
                </button>
                <span className="cv-info__pinyin">{pinyin}</span>
                <span className="cv-info__meaning">{meaning}</span>
              </div>
              <div className="cv-info__tags">
                {hskLevel && <span className="cv-tag-hsk">HSK{hskLevel}</span>}
                {wordType && <span className="cv-tag-type">{wordType}</span>}
              </div>
            </div>

            <div className="cv-info__actions">
              <button type="button" className="cv-pill" onClick={playAll}>
                <i className="isax isax-volume-high" />
                Nghe toàn đoạn
              </button>
              <button type="button" className="cv-pill" onClick={() => setShowSettings(true)}>
                <i className="isax isax-setting-4" />
                Cài đặt
              </button>
            </div>
          </div>

          <div className="cv-chat">
            {turns.length === 0 && <p className="cv-empty">Chưa có câu hội thoại cho từ này.</p>}

            {turns.map((t) => (
              <div className={`cv-turn cv-turn--${t.speaker.toLowerCase()}`} key={t.key}>
                <span className="cv-avatar">{t.speaker}</span>
                <div className="cv-bubble">
                  <button type="button" className="cv-speaker" onClick={() => onSpeak(t.cn, audioSpeed)} title="Nghe câu này">
                    <i className="isax isax-volume-high" />
                  </button>
                  <div className="cv-bubble__body">
                    {showPinyin && t.pinyin && (
                      <p className="cv-bubble__pinyin">
                        <VocabularyHighlight text={t.pinyin} needle={pinyin} className="cv-hl" />
                      </p>
                    )}
                    {showHanzi && (
                      <p className="cv-bubble__cn">
                        <VocabularyHighlight text={t.cn} needle={hanzi} className="cv-hl" />
                      </p>
                    )}
                    {showTranslation && t.vi && <p className="cv-bubble__vi">{t.vi}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PracticeModal>

      {showSettings &&
        createPortal(
          <div className="hsk-vocab-modal">
            <div className="cs-overlay" onClick={() => setShowSettings(false)} role="presentation">
              <div className="cs-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Cài đặt hội thoại">
                <header className="cs-head">
                  <h3>Cài đặt hội thoại</h3>
                  <button type="button" className="cs-close" onClick={() => setShowSettings(false)} aria-label="Đóng">
                    <i className="isax isax-close-square" />
                  </button>
                </header>

                <div className="cs-row">
                  <div style={{ display: "flex", gap: "4px", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", background: "#f5f5f5", padding: "4px", borderRadius: "8px" }}>
                    {SPEEDS.map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => handleSpeedChange(speed)}
                        aria-pressed={audioSpeed === speed}
                        style={{
                          padding: "4px 8px",
                          border: "none",
                          borderRadius: "6px",
                          background: audioSpeed === speed ? "#C8102E" : "transparent",
                          color: audioSpeed === speed ? "#fff" : "#333",
                          fontWeight: audioSpeed === speed ? 600 : 400,
                          cursor: "pointer",
                          fontSize: "12px",
                          transition: "all 0.2s",
                        }}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                {toggles.map((row) => (
                  <div className="cs-row" key={row.label}>
                    <span>{row.label}</span>
                    <button
                      type="button"
                      className={`cs-switch ${row.value ? "is-on" : ""}`}
                      onClick={() => row.set(!row.value)}
                      role="switch"
                      aria-checked={row.value}
                      aria-label={row.label}
                    >
                      <span className="cs-switch__knob" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
