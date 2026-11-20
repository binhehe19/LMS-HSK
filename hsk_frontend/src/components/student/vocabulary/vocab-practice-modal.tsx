"use client";

// Popup Luyện tập từ vựng (vocab-practice-modal.tsx của HSK cũ): câu nối từ ghép ↔ Hán Việt + câu viết pinyin, bảng điểm cuối bài.
// Logic dựng câu hỏi / chấm / xếp loại ở lib/dictionary/vocab-practice.ts. Bộ câu hỏi dựng MỘT lần khi mở popup (xáo trộn không chạy lại mỗi lần render).
import { useState } from "react";
import type { VocabularyExample } from "@/types/dictionary";
import { buildPracticeQuestions, isAnswerCorrect, practiceTier } from "@/lib/dictionary/vocab-practice";
import { PracticeModal } from "./practice-modal";
import "./vocab-practice-modal.scss";

interface VocabPracticeModalProps {
  hanzi: string;
  /** JSON compounds của pinyin chính: [{hanzi, sinoVietnamese}] */
  compounds?: string;
  examples: VocabularyExample[];
  onClose: () => void;
}

export function VocabPracticeModal({ hanzi, compounds, examples, onClose }: VocabPracticeModalProps) {
  const [questions] = useState(() => buildPracticeQuestions(hanzi, compounds, examples));
  const total = questions.length;
  const [idx, setIdx] = useState(0);
  const current = questions[idx];
  const isLast = idx >= total - 1;

  const [pickedLeft, setPickedLeft] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [typed, setTyped] = useState("");

  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [finished, setFinished] = useState(false);

  /** Đã trả lời xong câu hiện tại chưa — quyết định nút "Câu tiếp" xám hay xanh. */
  const answered = current?.kind === "match" ? Object.keys(pairs).length === current.left.length : typed.trim().length > 0;

  const resetQuestion = () => {
    setPickedLeft(null);
    setPairs({});
    setTyped("");
  };

  const goNext = () => {
    if (!answered || !current) return;
    if (isAnswerCorrect(current, pairs, typed)) setCorrectCount((c) => c + 1);
    else setWrongCount((w) => w + 1);
    if (isLast) {
      setFinished(true);
      return;
    }
    setIdx(idx + 1);
    resetQuestion();
  };

  const handleRetryAll = () => {
    setIdx(0);
    resetQuestion();
    setCorrectCount(0);
    setWrongCount(0);
    setFinished(false);
  };

  const handleRight = (rightKey: string) => {
    if (!pickedLeft) return;
    setPairs((p) => ({ ...p, [pickedLeft]: rightKey }));
    setPickedLeft(null);
  };

  /** Bấm lại ô đã ghép để gỡ cặp — tránh kẹt khi nối nhầm. */
  const unpair = (leftKey: string) => {
    setPairs((p) => {
      const next = { ...p };
      delete next[leftKey];
      return next;
    });
    setPickedLeft(null);
  };

  const tier = practiceTier(correctCount, wrongCount, total);
  const gradeLabel = tier === "great" ? "Xuất sắc!" : tier === "good" ? "Khá tốt!" : "Cần cố gắng!";

  return (
    <PracticeModal
      icon="isax-teacher"
      title="Luyện tập từ vựng:"
      hanzi={hanzi}
      theme="green"
      onClose={onClose}
      footer={
        finished ? (
          <button type="button" className="vp-next" onClick={onClose}>
            Đóng
          </button>
        ) : (
          <button type="button" className={`vp-next ${answered ? "is-ready" : ""}`} onClick={goNext} disabled={!answered || total === 0}>
            {isLast ? "Hoàn thành" : "Câu tiếp"}
          </button>
        )
      }
    >
      <div className="vp">
        {total === 0 || !current ? (
          <p className="vp-empty">Chưa có dữ liệu để tạo bài luyện tập cho từ này.</p>
        ) : finished ? (
          <div className={`vp-result vp-result--${tier}`}>
            <span className="vp-result__cup">
              <i className="isax isax-cup" />
            </span>
            <p className="vp-result__grade">{gradeLabel}</p>

            <div className="vp-result__stats">
              <div className="vp-stat">
                <span className="vp-stat__num is-ok">{correctCount}</span>
                <span className="vp-stat__label">Câu đúng</span>
              </div>
              <div className="vp-stat">
                <span className="vp-stat__num is-bad">{wrongCount}</span>
                <span className="vp-stat__label">Câu sai</span>
              </div>
            </div>

            <button type="button" className="vp-btn vp-btn--green" onClick={handleRetryAll}>
              <i className="isax isax-refresh" />
              Làm lại
            </button>
          </div>
        ) : (
          <>
            <div className="vp-progress">
              <div className="vp-progress__bar">
                <span style={{ width: `${((idx + 1) / total) * 100}%` }} />
              </div>
              <span className="vp-progress__label">
                Câu {idx + 1}/{total}
              </span>
            </div>

            <p className="vp-prompt">{current.prompt}</p>

            {current.kind === "match" && (
              <>
                <p className="vp-hint">{pickedLeft ? "Chọn đáp án tương ứng ở cột B." : "Chọn một mục ở cột A, rồi chọn đáp án ở cột B. Bấm lại ô đã nối để gỡ."}</p>

                <div className="vp-match">
                  <div className="vp-col">
                    <span className="vp-col__head">A</span>
                    {current.left.map((l, i) => (
                      <button
                        type="button"
                        key={l.key}
                        className={`vp-opt ${pickedLeft === l.key ? "is-picked" : ""} ${pairs[l.key] ? "is-done" : ""}`}
                        onClick={() => (pairs[l.key] ? unpair(l.key) : setPickedLeft(l.key))}
                      >
                        {i + 1}. {l.text}
                      </button>
                    ))}
                  </div>

                  <div className="vp-col">
                    <span className="vp-col__head">B</span>
                    {current.right.map((r, i) => {
                      const takenBy = Object.entries(pairs).find(([, v]) => v === r.key);
                      return (
                        <button
                          type="button"
                          key={r.key}
                          className={`vp-opt ${takenBy ? "is-done" : ""}`}
                          onClick={() => (takenBy ? unpair(takenBy[0]) : handleRight(r.key))}
                          disabled={!takenBy && !pickedLeft}
                        >
                          {String.fromCharCode(97 + i)}. {r.text}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {current.kind === "pinyin" && (
              <div className="vp-pinyin">
                <span className="vp-label">Câu Hán tự</span>
                <div className="vp-cn">{current.cn}</div>

                <span className="vp-label">Pinyin (viết hoàn chỉnh)</span>
                <input
                  className="vp-input"
                  aria-label="Pinyin (viết hoàn chỉnh)"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Nhập pinyin có thanh điệu…"
                />
              </div>
            )}
          </>
        )}
      </div>
    </PracticeModal>
  );
}
