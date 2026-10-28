"use client";

// Dòng mở rộng của bảng từ vựng (phần "EXPANDED ROW - COMPREHENSIVE" của manage-vocabulary.tsx cũ): Ý nghĩa & Ví dụ | Bộ thủ/chiết tự | Tư liệu & Hỗ trợ
// (Phát âm bằng speechSynthesis của trình duyệt như useTextToSpeech cũ, Xem nét viết). View thuần.
import { AssetImage } from "@/components/shared/asset-image";
import { allMeanings, parseRelatedWords, primaryPinyin } from "@/lib/dictionary/vocabulary-model";
import type { Vocabulary } from "@/types/dictionary";

const LABEL_XS = { fontSize: "11px", letterSpacing: "0.5px" } as const;

/** Đọc chữ Hán bằng giọng zh-CN của trình duyệt; không có speechSynthesis => không làm gì (nút đã disabled). */
function speakHanzi(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function VocabularyRowDetails({ vocab, onShowStrokes }: { vocab: Vocabulary; onShowStrokes: (vocab: Vocabulary) => void }) {
  const primary = primaryPinyin(vocab);
  const meanings = allMeanings(vocab);
  const compounds = parseRelatedWords(primary?.compounds, "sinoVietnamese");
  const synonyms = parseRelatedWords(primary?.synonyms, "pinyin");
  const antonyms = parseRelatedWords(primary?.antonyms, "pinyin");
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  return (
    <div className="p-3 ps-5 border-top bg-white bg-opacity-75" data-testid="vocab-row-details">
      <div className="row g-3 scroll-area" style={{ maxHeight: 320, overflowY: "auto" }}>
        <div className="col-md-5 border-end">
          {primary && (primary.sinoVietnamese || primary.measureWord) && (
            <div className="mb-2 small">
              {primary.sinoVietnamese && (
                <span className="me-3 text-muted">
                  <span className="fw-bold text-dark">Hán Việt:</span> {primary.sinoVietnamese}
                </span>
              )}
              {primary.measureWord && (
                <span className="text-muted">
                  <span className="fw-bold text-dark">Lượng từ:</span> {primary.measureWord}
                </span>
              )}
            </div>
          )}
          <div className="label-xs text-uppercase fw-bold text-muted mb-2" style={LABEL_XS}>
            Ý nghĩa & Ví dụ ({meanings.length})
          </div>
          <div className="d-flex flex-column gap-2 pe-2">
            {meanings.map((m, idx) => (
              <div key={m.id ?? idx} className="meaning-item">
                <div className="fw-bold text-dark mb-1 small d-flex align-items-start gap-2">
                  {m.exampleWordType && (
                    <span className="badge bg-secondary bg-opacity-15 text-secondary fw-semibold" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                      {m.exampleWordType}
                    </span>
                  )}
                  <span>
                    {idx + 1}. {m.meaning}
                  </span>
                </div>
                {m.definitionCn && (
                  <div className="text-muted small mb-1" style={{ fontSize: 12 }}>
                    {m.definitionCn}
                  </div>
                )}
                {m.exampleSentenceCn && (
                  <div className="mt-1 text-wrap">
                    <div className="example-cn">{m.exampleSentenceCn}</div>
                    {m.exampleSentencePinyin && <div className="example-pinyin mb-0">{m.exampleSentencePinyin}</div>}
                    {m.exampleSentenceVi && <div className="example-vi">VN: {m.exampleSentenceVi}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
          {compounds.length > 0 && (
            <div className="mt-2 small text-muted">
              <span className="fw-bold text-dark d-block mb-1">Từ ghép:</span>
              {compounds.map((w) => (w.extra ? `${w.hanzi} (${w.extra})` : w.hanzi)).join(", ")}
            </div>
          )}
          {synonyms.length > 0 && (
            <div className="mt-1 small text-muted">
              <span className="fw-bold text-dark">Đồng nghĩa:</span> {synonyms.map((w) => (w.extra ? `${w.hanzi} [${w.extra}]` : w.hanzi)).join(", ")}
            </div>
          )}
          {antonyms.length > 0 && (
            <div className="mt-1 small text-muted">
              <span className="fw-bold text-dark">Trái nghĩa:</span> {antonyms.map((w) => (w.extra ? `${w.hanzi} [${w.extra}]` : w.hanzi)).join(", ")}
            </div>
          )}
          {primary?.notes && (
            <div className="mt-1 small text-muted">
              <span className="fw-bold text-dark">Ghi chú:</span> {primary.notes}
            </div>
          )}
        </div>

        <div className="col-md-4 border-end">
          <div className="label-xs text-uppercase fw-bold text-muted mb-2" style={LABEL_XS}>
            Bộ thủ
          </div>
          <div className="bg-light rounded-4 p-3 border" style={{ borderColor: "rgba(0,0,0,0.03)" }}>
            <div className="scroll-area" style={{ maxHeight: 150, overflowY: "auto" }}>
              <p className="text-muted mb-0" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, wordBreak: "break-word", fontSize: "13.5px" }}>
                {vocab.etymologyStory || "Chưa có thông tin chiết tự cho từ vựng này."}
              </p>
            </div>
            {vocab.etymologyImage && (
              <div className="mt-2 text-center bg-white p-1 rounded shadow-sm border" style={{ width: "fit-content", margin: "0 auto" }}>
                <AssetImage src={vocab.etymologyImage} alt="Chiết tự" className="rounded" style={{ maxHeight: 80 }} />
              </div>
            )}
          </div>
        </div>

        <div className="col-md-3">
          <div className="label-xs text-uppercase fw-bold text-muted mb-2" style={LABEL_XS}>
            Tư liệu & Hỗ trợ
          </div>
          <div className="row g-2 mb-3">
            {vocab.imageUrl && (
              <div className="col-6">
                <div className="bg-white p-1 rounded-3 border shadow-sm hover-up" style={{ height: 85, overflow: "hidden" }}>
                  <AssetImage src={vocab.imageUrl} alt={vocab.hanzi} className="w-100 h-100 object-fit-cover rounded-2" />
                </div>
              </div>
            )}
            {vocab.strokeAnimationUrl && (
              <div className="col-6">
                <div className="bg-white p-1 rounded-3 border shadow-sm d-flex align-items-center justify-content-center hover-up" style={{ height: 85 }}>
                  <AssetImage src={vocab.strokeAnimationUrl} alt="Nét viết" className="img-fluid rounded-2" style={{ maxHeight: 75 }} />
                </div>
              </div>
            )}
          </div>
          <div className="d-flex flex-column gap-2">
            <button type="button" className="btn btn-sm btn-light text-primary d-flex align-items-center justify-content-center border-0 bg-primary bg-opacity-10 fw-600 rounded-3" style={{ height: 36, fontSize: 13 }} onClick={() => speakHanzi(vocab.hanzi)} disabled={!ttsSupported}>
              <i className="isax isax-volume-high me-2 fs-5" /> Phát âm
            </button>
            <button type="button" className="btn btn-sm btn-light text-dark d-flex align-items-center justify-content-center border-0 bg-secondary bg-opacity-10 fw-600 rounded-3" style={{ height: 36, fontSize: 13 }} onClick={() => onShowStrokes(vocab)} disabled={!vocab.strokeAnimationUrl}>
              <i className="isax isax-brush-2 me-2 fs-5" /> Xem nét viết
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
