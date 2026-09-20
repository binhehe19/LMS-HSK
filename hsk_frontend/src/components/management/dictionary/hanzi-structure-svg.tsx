"use client";

// Ảnh SVG cấu tạo chữ Hán do Hanzi Writer vẽ ngay trong trang (không lưu tệp): mỗi chữ Hán khác nhau của từ một SVG, phần bộ thủ tô màu riêng.
// Dữ liệu nét lấy qua hanzi-writer-loader (CDN, có nhớ đệm). Chữ không có dữ liệu thì ẩn; không chữ nào vẽ được thì không hiện gì.
// Dưới mỗi chữ có nút "Viết": bấm thì nét của chính chữ đó được viết lại từng nét ngay trong ô.
import type HanziWriter from "hanzi-writer";
import { useCallback, useEffect, useRef, useState } from "react";
import { charDataLoader } from "@/lib/dictionary/hanzi-writer-loader";
import { hanziCharsOf, loadHanziWriter } from "@/lib/dictionary/hanzi-writer-module";

const SIZE = 72;
const STROKE_COLOR = "#1e293b";
const RADICAL_COLOR = "#077ddd";

function CharTile({ char, visible, onResult }: { char: string; visible: boolean; onResult: (char: string, ok: boolean) => void }) {
  const targetRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;
    let cancelled = false;
    target.innerHTML = "";
    loadHanziWriter()
      .then(({ default: Writer }) => {
        if (cancelled) return;
        writerRef.current = Writer.create(target, char, {
          width: SIZE,
          height: SIZE,
          padding: 4,
          showCharacter: true,
          showOutline: false,
          strokeColor: STROKE_COLOR,
          radicalColor: RADICAL_COLOR,
          strokeAnimationSpeed: 1,
          delayBetweenStrokes: 150,
          charDataLoader,
          onLoadCharDataSuccess: () => {
            if (!cancelled) onResult(char, true);
          },
          onLoadCharDataError: () => {
            if (!cancelled) onResult(char, false);
          },
        });
      })
      .catch(() => {
        if (!cancelled) onResult(char, false);
      });
    return () => {
      cancelled = true;
      const writer = writerRef.current;
      writerRef.current = null;
      if (writer) void writer.pauseAnimation().catch(() => undefined);
      target.innerHTML = "";
    };
  }, [char, onResult]);

  // Viết lại chữ từng nét trong chính ô này; xong thì chữ hiện đủ như cũ. Đang viết thì khóa nút để không chạy chồng.
  const play = () => {
    const writer = writerRef.current;
    if (!writer || playing) return;
    setPlaying(true);
    void writer
      .animateCharacter()
      .catch(() => undefined)
      .finally(() => setPlaying(false));
  };

  return (
    // Ô chưa có dữ liệu nét (đang tải hoặc không có) bị ẩn cùng nút của nó; vẫn dựng sẵn để Hanzi Writer nạp dữ liệu.
    <div className={`d-flex flex-column align-items-center gap-1${visible ? "" : " d-none"}`}>
      <div ref={targetRef} role="img" aria-label={`Cấu tạo chữ ${char}`} className="bg-white border rounded-3" style={{ width: SIZE, height: SIZE }} />
      <button
        type="button"
        className="btn btn-light border text-dark fw-semibold d-flex align-items-center justify-content-center"
        style={{ width: SIZE, height: 34, fontSize: 14 }}
        onClick={play}
        disabled={playing}
        aria-label={`Viết chữ ${char}`}
      >
        <i className="isax isax-edit-2 me-1" style={{ fontSize: 18 }} aria-hidden="true" />
        Viết
      </button>
    </div>
  );
}

export function HanziStructureSvg({ word, showStatus = false }: { word: string | undefined; showStatus?: boolean }) {
  const chars = hanziCharsOf(word);
  const [drawn, setDrawn] = useState<Record<string, boolean>>({});
  const report = useCallback((char: string, ok: boolean) => setDrawn((prev) => (prev[char] === ok ? prev : { ...prev, [char]: ok })), []);
  if (chars.length === 0) {
    return showStatus ? <p className="vocab-section-empty mb-0">Chưa có chữ Hán để xem nét viết.</p> : null;
  }
  const anyDrawn = chars.some((c) => drawn[c]);
  const loading = showStatus && !anyDrawn && chars.some((c) => drawn[c] === undefined);
  return (
    <div hidden={!showStatus && !anyDrawn} data-testid="hanzi-structure" className={showStatus ? undefined : "mb-3"}>
      {showStatus && !anyDrawn && (
        <p className="vocab-section-empty mb-0" role="status">
          {loading ? "Đang tải nét viết…" : "Chưa có dữ liệu nét viết cho từ này."}
        </p>
      )}
      <div className="d-flex flex-wrap justify-content-center gap-2">
        {chars.map((c) => (
          <CharTile key={c} char={c} visible={Boolean(drawn[c])} onResult={report} />
        ))}
      </div>
    </div>
  );
}
