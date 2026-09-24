"use client";

// Popup Luyện viết (stroke-order-modal.tsx của HSK cũ): xem mẫu / viết có chấm nét bằng hanzi-writer / ẩn nét gợi ý, thumbnail thứ tự nét,
// bảng kết quả. Khác bản cũ:
// - hanzi-writer nạp bằng import() động trong effect (thư viện đụng `window`, không được vào SSR/prerender).
// - Reset trạng thái khi đổi chữ làm ngay trong thao tác đổi chữ (không setState đồng bộ trong effect theo luật lint của Next 16).
// - Khối "Phân tích thành phần" nhận sẵn các ô đã dựng ở trang (components của API / bộ thủ), không tra lại componentVocabs.
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { CharacterJson } from "hanzi-writer";
import type HanziWriter from "hanzi-writer";
import { charDataLoader, loadHanziChar } from "@/lib/dictionary/hanzi-writer-loader";
import type { AnalysisNode } from "@/lib/dictionary/vocabulary-detail-model";
import { PracticeModal } from "./practice-modal";
import "./stroke-order-modal.scss";

interface StrokeOrderModalProps {
  hanzi: string;
  hskLevel?: number;
  pinyin: string;
  meaning: string;
  wordType?: string;
  analysisNodes: AnalysisNode[];
  onSpeak: (text: string) => void;
  onClose: () => void;
}

/** Công tắc bật/tắt (Component 331). */
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <div className="so-toggle">
      <button type="button" className={`so-switch ${checked ? "is-on" : ""}`} onClick={onChange} role="switch" aria-checked={checked} aria-label={label}>
        <span className="so-switch__knob" />
      </button>
      <span className="so-toggle__label">{label}</span>
    </div>
  );
}

/** Thumbnail thứ tự nét: vẽ nét 0..idx, nét cuối tô đỏ. */
function StrokeThumb({ strokes, idx }: { strokes: string[]; idx: number }) {
  return (
    <svg className="so-thumb" viewBox="0 0 1024 1024">
      <g transform="scale(1, -1) translate(0, -900)">
        {strokes.slice(0, idx + 1).map((d, i) => (
          <path key={i} d={d} fill={i === idx ? "#e11d1d" : "#1e293b"} />
        ))}
      </g>
    </svg>
  );
}

function cancelQuizSafely(writer: HanziWriter | null) {
  try {
    writer?.cancelQuiz();
  } catch {
    /* chưa ở chế độ viết / writer đã huỷ */
  }
}

export function StrokeOrderModal({ hanzi, hskLevel, pinyin, meaning, wordType, analysisNodes, onSpeak, onClose }: StrokeOrderModalProps) {
  const chars = useMemo(() => Array.from(hanzi || ""), [hanzi]);
  const [activeIdx, setActiveIdx] = useState(0);
  const activeChar = chars[activeIdx] ?? "";

  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  // Công tắc "Viết": bật khi bấm "Viết", CHỈ tắt khi người dùng tự tắt, bật "Xem mẫu", hoặc đổi sang chữ khác — viết xong KHÔNG tự tắt.
  const [isWriting, setIsWriting] = useState(false);
  const [hideHint, setHideHint] = useState(false);

  const [loaded, setLoaded] = useState<{ char: string; data: CharacterJson | null } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  // Nút "Kết quả" chỉ hiện khi đang ở trạng thái viết VÀ đã đặt bút viết ít nhất 1 nét.
  const [strokeStarted, setStrokeStarted] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const charData = loaded && loaded.char === activeChar ? loaded.data : null;
  const strokes: string[] = charData?.strokes ?? [];

  // Bảng kết quả nằm cuối popup -> tự cuộn tới khi nó hiện, nếu không sẽ bị khuất.
  useEffect(() => {
    if (showResult) resultRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [showResult]);

  // dữ liệu nét của chữ đang tập (thumbnail)
  useEffect(() => {
    if (!activeChar) return;
    let cancelled = false;
    loadHanziChar(activeChar)
      .catch(() => null)
      .then((data) => {
        if (!cancelled) setLoaded({ char: activeChar, data });
      });
    return () => {
      cancelled = true;
    };
  }, [activeChar]);

  // Đọc hideHint lúc TẠO writer mà không để effect tạo writer phụ thuộc vào nó (đổi "Ẩn nét gợi ý" không được làm mất lượt viết).
  const createWriter = useEffectEvent((Writer: typeof HanziWriter, target: HTMLDivElement, char: string) => {
    try {
      writerRef.current = Writer.create(target, char, {
        width: 260,
        height: 260,
        padding: 10,
        showOutline: !hideHint,
        showCharacter: false,
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 150,
        strokeColor: "#1e293b",
        radicalColor: "#077ddd",
        highlightColor: "#e11d1d",
        charDataLoader,
      });
    } catch {
      writerRef.current = null;
    }
  });

  // khởi tạo writer mỗi khi đổi chữ — chờ người dùng bấm "Viết" mới bắt đầu chấm nét.
  useEffect(() => {
    const target = canvasRef.current;
    if (!activeChar || !target) return;
    let cancelled = false;
    target.innerHTML = "";
    import("hanzi-writer")
      .then(({ default: Writer }) => {
        if (!cancelled) createWriter(Writer, target, activeChar);
      })
      .catch(() => {
        writerRef.current = null;
      });
    return () => {
      cancelled = true;
      cancelQuizSafely(writerRef.current);
      writerRef.current = null;
    };
  }, [activeChar]);

  // "Ẩn nét gợi ý": chỉ bật/tắt outline trên writer hiện có, không tạo lại / reset phiên viết đang chấm dở.
  useEffect(() => {
    const writer = writerRef.current;
    if (!writer) return;
    if (hideHint) writer.hideOutline();
    else writer.showOutline();
  }, [hideHint]);

  const resetProgress = () => {
    setCorrectCount(0);
    setMistakeCount(0);
    setShowResult(false);
    setStrokeStarted(false);
  };

  const beginQuiz = () => {
    setShowDemo(false);
    resetProgress();
    setIsWriting(true);
    void writerRef.current?.quiz({
      onCorrectStroke: (d) => {
        setStrokeStarted(true);
        setCorrectCount(d.strokeNum + 1);
      },
      onMistake: () => {
        setStrokeStarted(true);
        setMistakeCount((p) => p + 1);
      },
    });
  };

  const selectChar = (idx: number) => {
    if (idx === activeIdx) return;
    resetProgress();
    setIsWriting(false);
    setShowDemo(false);
    setActiveIdx(idx);
  };

  const handleDemo = () => {
    const next = !showDemo;
    setShowDemo(next);
    if (next) {
      cancelQuizSafely(writerRef.current);
      // Xem mẫu = thoát khỏi lượt viết hiện tại -> tắt "Viết", nút "Kết quả" ẩn theo.
      setIsWriting(false);
      setStrokeStarted(false);
      void writerRef.current?.animateCharacter();
    }
  };

  const handleWrite = () => {
    if (isWriting) {
      setIsWriting(false);
      setStrokeStarted(false);
      cancelQuizSafely(writerRef.current);
      return;
    }
    beginQuiz();
  };

  /** Xếp loại theo số lỗi sai — quyết định màu cúp, màu tiêu đề và nút chính. */
  const tier: "great" | "good" | "poor" = mistakeCount === 0 ? "great" : mistakeCount <= 3 ? "good" : "poor";
  const gradeLabel = tier === "great" ? "Xuất sắc!" : tier === "good" ? "Khá tốt!" : "Cần cố gắng!";
  const isGreat = tier === "great";

  return (
    <PracticeModal
      icon="isax-edit-2"
      title="Luyện viết:"
      hanzi={hanzi}
      theme="blue"
      onClose={onClose}
      footer={
        isWriting &&
        strokeStarted &&
        !showResult && (
          <button type="button" className="so-result-btn" onClick={() => setShowResult(true)}>
            Kết quả <i className="isax isax-arrow-right-3" />
          </button>
        )
      }
    >
      <div className="so">
        <div className="so-info">
          <div className="so-info__left">
            <div className="so-info__row">
              <button type="button" className="so-info__speaker" onClick={() => onSpeak(hanzi)} title="Nghe phát âm">
                <i className="isax isax-volume-high" />
              </button>
              <span className="so-info__pinyin">{pinyin}</span>
              <span className="so-info__meaning">{meaning}</span>
            </div>
            <div className="so-info__tags">
              {hskLevel && <span className="so-tag-hsk">HSK{hskLevel}</span>}
              {wordType && <span className="so-tag-type">{wordType}</span>}
            </div>
          </div>

          <button type="button" className="so-analysis-btn" onClick={() => setShowAnalysis((v) => !v)} aria-expanded={showAnalysis}>
            <i className="isax isax-hierarchy-square-2" />
            <span>Phân tích thành phần</span>
            <i className={`isax ${showAnalysis ? "isax-arrow-up-2" : "isax-arrow-right-3"}`} />
          </button>
        </div>

        {showAnalysis && (
          <div className="so-analysis">
            <div className="so-node so-node--main">
              <span className="so-node__hanzi">{hanzi}</span>
              <span className="so-node__sub">{pinyin}</span>
              <span className="so-node__sub">{meaning}</span>
            </div>

            {analysisNodes.length > 0 && (
              <>
                <span className="so-connector" />
                <div className="so-node-group">
                  {analysisNodes.map((node) => (
                    <div className="so-node so-node--sub" key={node.key}>
                      <span className="so-node__hanzi so-node__hanzi--sm">{node.hanzi}</span>
                      <div className="so-node__text">
                        <span className="so-node__title">{node.title}</span>
                        <span className="so-node__desc">{node.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {chars.length > 1 && (
          <div className="so-chars">
            {chars.map((c, i) => (
              <button type="button" key={`${c}-${i}`} className={`so-char ${i === activeIdx ? "is-active" : ""}`} onClick={() => selectChar(i)}>
                <span className="so-char__hanzi">{c}</span>
                <span className="so-char__state">{i === activeIdx ? "ĐANG TẬP" : "KẾ TIẾP"}</span>
              </button>
            ))}
          </div>
        )}

        <div className="so-canvas">
          <div className="so-canvas__grid" />
          <div className="so-canvas__writer" ref={canvasRef} data-testid="stroke-writer" />
        </div>

        {strokes.length > 0 && (
          <div className="so-thumbs">
            {strokes.map((_, i) => (
              <div className={`so-thumb-box ${i === 0 ? "is-first" : ""}`} key={i}>
                <StrokeThumb strokes={strokes} idx={i} />
              </div>
            ))}
          </div>
        )}

        <div className="so-toggles">
          <Toggle checked={showDemo} onChange={handleDemo} label="Xem mẫu" />
          <Toggle checked={isWriting} onChange={handleWrite} label="Viết" />
          <Toggle checked={hideHint} onChange={() => setHideHint((v) => !v)} label="Ẩn nét gợi ý" />
        </div>

        {showResult && (
          <div className={`so-result so-result--${tier}`} ref={resultRef}>
            <span className="so-result__cup">
              <i className="isax isax-cup" />
            </span>
            <p className="so-result__grade">{gradeLabel}</p>

            <div className="so-result__stats">
              <div className="so-stat">
                <span className="so-stat__num is-ok">{correctCount}</span>
                <span className="so-stat__label">Nét đúng</span>
              </div>
              <div className="so-stat">
                <span className="so-stat__num is-bad">{mistakeCount}</span>
                <span className="so-stat__label">Lỗi sai</span>
              </div>
            </div>

            <div className="so-result__actions">
              <button type="button" className={`so-btn ${isGreat ? "" : "so-btn--blue"}`} onClick={beginQuiz}>
                <i className="isax isax-refresh" />
                Viết lại
              </button>
              <button type="button" className="so-btn" onClick={() => void writerRef.current?.animateCharacter()}>
                <i className="isax isax-magicpen" />
                Sửa nét sai
              </button>
              <button type="button" className={`so-btn ${isGreat ? "so-btn--red" : ""}`} onClick={() => selectChar(activeIdx + 1)} disabled={activeIdx >= chars.length - 1}>
                <i className="isax isax-arrow-right-3" />
                Chữ tiếp
              </button>
            </div>
          </div>
        )}
      </div>
    </PracticeModal>
  );
}
