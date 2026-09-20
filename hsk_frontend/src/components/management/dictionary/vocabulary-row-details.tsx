"use client";

import { Tabs } from "antd";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ContentImagePreview } from "@/components/management/content-tree/content-file-field";
import { DictionaryWordTypeTag } from "./dictionary-word-type-tag";
import { HanziStructureSvg } from "./hanzi-structure-svg";
import { parseRelatedWords, primaryPinyin } from "@/lib/dictionary/vocabulary-model";
import { useTextToSpeech } from "@/lib/dictionary/use-text-to-speech";
import type { Vocabulary, VocabularyPinyin } from "@/types/dictionary";

const LABEL_XS = { fontSize: "11px", letterSpacing: "0.5px" } as const;

function PinyinDetails({ reading }: { reading?: VocabularyPinyin }) {
  const meanings = reading?.meanings ?? [];
  const compounds = parseRelatedWords(reading?.compounds, "sinoVietnamese");
  const synonyms = parseRelatedWords(reading?.synonyms, "pinyin");
  const antonyms = parseRelatedWords(reading?.antonyms, "pinyin");

  return (
    <>
      {reading && (reading.sinoVietnamese || reading.measureWord) && (
        <div className="mb-2 small">
          {reading.sinoVietnamese && (
            <span className="me-3 text-muted">
              <span className="fw-bold text-dark">Hán Việt:</span> {reading.sinoVietnamese}
            </span>
          )}
          {reading.measureWord && (
            <span className="text-muted">
              <span className="fw-bold text-dark">Lượng từ:</span> {reading.measureWord}
            </span>
          )}
        </div>
      )}
      {(compounds.length > 0 || synonyms.length > 0 || antonyms.length > 0) && (
        <div className="mb-3">
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
        </div>
      )}
      <div className="label-xs text-uppercase fw-bold text-muted mb-2" style={LABEL_XS}>
        Ý nghĩa & Ví dụ ({meanings.length})
      </div>
      <div className="d-flex flex-column gap-2 pe-2">
        {meanings.map((m, idx) => (
          <div key={m.id ?? idx} className="meaning-item">
            <div className="fw-bold text-dark mb-1 small d-flex align-items-start justify-content-between gap-2">
              <span>
                {idx + 1}. {[m.meaning, m.meaningEn, m.meaningZh].filter(Boolean).join(" · ")}
              </span>
              {m.exampleWordType && <DictionaryWordTypeTag type={m.exampleWordType} />}
            </div>
            {m.definitionCn && (
              <div className="text-muted small mb-1" style={{ fontSize: 12 }}>
                {m.definitionCn}
              </div>
            )}
            {(m.examples ?? []).filter((e) => e.zh).map((e, exampleIdx) => (
              <div key={exampleIdx} className="mt-1 text-wrap">
                <div className="example-cn">{e.zh}</div>
                {e.pinyin && <div className="example-pinyin mb-0">{e.pinyin}</div>}
                {e.vi && <div className="example-vi">VN: {e.vi}</div>}
              </div>
            ))}
          </div>
        ))}
      </div>
      {reading?.notes && (
        <div className="mt-1 small text-muted">
          <span className="fw-bold text-dark">Ghi chú:</span> {reading.notes}
        </div>
      )}
    </>
  );
}

export function VocabularyRowDetails({ vocab, onView, onEdit, busy }: {
  vocab: Vocabulary;
  onView: (vocab: Vocabulary) => void;
  onEdit?: () => void;
  busy: boolean;
}) {
  const { speak, stop } = useTextToSpeech();
  const [readingIndex, setReadingIndex] = useState(0);
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const actions = actionsRef.current;
    const column = actions?.parentElement;
    if (!actions || !column) return;
    const scrollPane = column.closest(".management-main-column");
    const desktop = window.matchMedia("(min-width: 768px)");

    // Ant Design's horizontal scroll wrapper prevents native vertical sticky positioning.
    const update = () => {
      const top = Math.max(0, scrollPane?.getBoundingClientRect().top ?? 0) + 12;
      const available = column.clientHeight - actions.offsetTop - actions.offsetHeight;
      const offset = top - column.getBoundingClientRect().top - actions.offsetTop;
      const distance = desktop.matches ? Math.max(0, Math.min(offset, available)) : 0;
      actions.style.translate = `0 ${distance}px`;
    };
    scrollPane?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(column);
    observer?.observe(actions);
    update();
    return () => {
      scrollPane?.removeEventListener("scroll", update);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, []);

  const primary = primaryPinyin(vocab);
  const readings = primary ? [primary, ...(vocab.pinyins ?? []).filter(reading => reading !== primary)] : [];
  const activeIndex = readings[readingIndex] ? readingIndex : 0;
  const reading = readings[activeIndex];
  const multipleReadings = readings.length > 1;
  const pronunciation = reading?.pinyin.trim();
  const playPronunciation = () => {
    const audioUrl = reading?.audioUrl;
    const text = multipleReadings ? pronunciation : vocab.hanzi;
    if (!text && !audioUrl) {
      toast.error("Cách đọc này chưa có Pinyin hoặc tệp phát âm.");
      return;
    }
    speak(text ?? "", {
      audioUrl,
      language: "zh-cn",
      onError: () => toast.error(audioUrl
        ? "Không phát được tệp âm thanh hoặc giọng đọc tiếng Trung cho cách đọc này."
        : "Cách đọc này chưa có tệp phát âm và trình duyệt không đọc được. Hãy tải tệp lên trong Chỉnh sửa → Thông tin."),
    });
  };

  return (
    <div data-testid="vocab-row-details">
      <div className="row g-3">
        <div className="col-md-5 border-end">
          {multipleReadings ? (
            <Tabs
              size="small"
              activeKey={String(activeIndex)}
              onChange={key => {
                stop();
                setReadingIndex(Number(key));
              }}
              destroyInactiveTabPane
              items={readings.map((reading, index) => ({
                key: String(index),
                label: reading.pinyin || `Pinyin ${index + 1}`,
                children: <PinyinDetails reading={reading} />,
              }))}
            />
          ) : <PinyinDetails reading={primary} />}
        </div>

        <div className="col-md-4 border-end">
          <div className="label-xs text-uppercase fw-bold text-muted mb-2" style={LABEL_XS}>
            Cấu tạo & minh họa
          </div>
          <HanziStructureSvg key={vocab.hanzi} word={vocab.hanzi} />
          <div className="bg-light rounded-4 p-3 border" style={{ borderColor: "rgba(0,0,0,0.03)" }}>
            <p className="text-muted mb-0" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, wordBreak: "break-word", fontSize: "13.5px" }}>
              {vocab.etymologyStory || "Chưa có thông tin chiết tự cho từ vựng này."}
            </p>
          </div>
          {vocab.imageUrl && (
            <div className="mt-3">
              <ContentImagePreview url={vocab.imageUrl} alt={`Ảnh minh họa cho ${vocab.hanzi}`} />
            </div>
          )}
        </div>

        <div className="col-md-3 position-relative">
          <div className="label-xs text-uppercase fw-bold text-muted mb-2" style={LABEL_XS}>
            Tư liệu & Hỗ trợ
          </div>
          <div ref={actionsRef} className="d-flex flex-column gap-2">
            <button type="button" className="btn btn-sm btn-light text-primary d-flex align-items-center justify-content-center border-0 bg-primary bg-opacity-10 fw-600 rounded-3" style={{ height: 36, fontSize: 13 }} onClick={playPronunciation} title={pronunciation ? `Phát âm ${pronunciation}` : undefined}>
              <i className="isax isax-volume-high me-2 fs-5" aria-hidden="true" /> Phát âm
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center fw-600 rounded-3" style={{ height: 36, fontSize: 13 }} onClick={() => onView(vocab)}>
              <i className="isax isax-eye me-2 fs-5" aria-hidden="true" /> Xem chi tiết
            </button>
            {onEdit && (
              <button type="button" className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center fw-600 rounded-3" style={{ height: 36, fontSize: 13 }} onClick={onEdit} disabled={busy}>
                <i className="isax isax-edit-2 me-2 fs-5" aria-hidden="true" /> Chỉnh sửa
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
