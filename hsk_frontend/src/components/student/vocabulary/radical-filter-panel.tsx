"use client";

// Panel "Lọc theo Bộ thủ" (HSK cũ: features/learning-path/vocabulary/components/radical-filter-panel.tsx), giữ nguyên giao diện 2 tầng:
// tầng 1 lọc nhanh theo số nét (chỉ thu hẹp lưới), tầng 2 chọn bộ thủ (gọi API). Dữ liệu 214 bộ thủ tĩnh (lib/dictionary/radical-data.ts).
// Khác bản cũ: mỗi thao tác đổi URL MỘT lần (bản cũ gọi hai handler liên tiếp nên URL có thể lệch với trạng thái).
import { useState } from "react";
import { RADICAL_MAP } from "@/lib/dictionary/radical-data";
import { RADICALS_BY_STROKE, STROKE_GROUPS } from "@/lib/dictionary/vocabulary-list-params";

export interface RadicalFilterValue {
  radical?: string;
  strokeFilter: number | null;
}

export function RadicalFilterPanel({ value, onChange }: { value: RadicalFilterValue; onChange: (next: RadicalFilterValue) => void }) {
  const { radical: selectedRadical, strokeFilter } = value;
  // Tự mở panel nếu đang có bộ thủ được chọn (khôi phục từ URL).
  const [isExpanded, setIsExpanded] = useState<boolean>(() => !!selectedRadical);
  const visibleGroups = strokeFilter !== null ? STROKE_GROUPS.filter((s) => s === strokeFilter) : STROKE_GROUPS;

  const selectStroke = (s: number | null) => {
    const next = s !== null && strokeFilter === s ? null : s;
    // Bộ thủ đang chọn không thuộc nhóm số nét mới => bỏ bộ thủ ("Tất cả" giữ nguyên bộ thủ như bản cũ).
    const keep = next === null || !selectedRadical || RADICAL_MAP[selectedRadical]?.strokeCount === next;
    onChange({ radical: keep ? selectedRadical : undefined, strokeFilter: next });
  };

  return (
    <div className="radical-filter-panel border rounded-3 bg-white shadow-sm" style={{ overflow: "hidden" }}>
      <div
        className="vocab-filter-header d-flex align-items-center justify-content-between px-3 py-2"
        style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", borderBottom: isExpanded ? "1px solid #d1fae5" : "none" }}
      >
        <button type="button" className="vocab-filter-toggle d-flex align-items-center gap-2 flex-grow-1" aria-expanded={isExpanded} onClick={() => setIsExpanded((v) => !v)}>
          <span className="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 28, height: 28, background: "#10b981", color: "#fff", fontSize: 14 }}>
            <i className="isax isax-text-block" aria-hidden="true" />
          </span>
          <span className="fw-bold text-dark" style={{ fontSize: 14 }}>
            Lọc theo Bộ thủ
          </span>
          {strokeFilter !== null && !selectedRadical && (
            <span className="badge rounded-pill px-2 py-1" style={{ background: "#6366f1", color: "#fff", fontSize: 12 }}>
              {strokeFilter} nét
            </span>
          )}
          {selectedRadical && (
            <span className="badge rounded-pill px-2 py-1" style={{ background: "#10b981", color: "#fff", fontSize: 13, fontWeight: 700 }}>
              {selectedRadical}
              <span className="ms-1 opacity-75" style={{ fontSize: 11 }}>
                {RADICAL_MAP[selectedRadical]?.nameVi}
              </span>
            </span>
          )}
        </button>
        <div className="d-flex align-items-center gap-2">
          {(selectedRadical || strokeFilter !== null) && (
            <button
              type="button"
              className="btn btn-sm btn-link text-danger p-0 text-decoration-none"
              style={{ fontSize: 12 }}
              onClick={() => onChange({ radical: undefined, strokeFilter: null })}
              title="Xóa toàn bộ bộ lọc bộ thủ"
            >
              <i className="isax isax-close-circle me-1" aria-hidden="true" />
              Xóa lọc
            </button>
          )}
          <i className={`isax isax-arrow-${isExpanded ? "up" : "down"}-1 text-muted`} style={{ fontSize: 16 }} aria-hidden="true" />
        </div>
      </div>

      {isExpanded && (
        <div className="p-3">
          <div className="d-flex flex-wrap gap-1 mb-3 align-items-center">
            <span className="text-muted me-1" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
              Số nét:
            </span>
            <button type="button" className={`btn btn-sm rounded-pill px-2 py-0 ${strokeFilter === null ? "btn-dark" : "btn-outline-secondary"}`} style={{ fontSize: 12, lineHeight: "1.6" }} aria-pressed={strokeFilter === null} onClick={() => selectStroke(null)}>
              Tất cả
            </button>
            {STROKE_GROUPS.map((s) => (
              <button key={s} type="button" className={`btn btn-sm rounded-pill px-2 py-0 ${strokeFilter === s ? "btn-dark" : "btn-outline-secondary"}`} style={{ fontSize: 12, lineHeight: "1.6" }} aria-pressed={strokeFilter === s} onClick={() => selectStroke(s)}>
                {s}
              </button>
            ))}
          </div>

          <div className="radical-grid" style={{ maxHeight: 280, overflowY: "auto" }}>
            {visibleGroups.map((strokeCount) => (
              <div key={strokeCount} className="mb-3">
                <div className="text-muted fw-bold mb-1" style={{ fontSize: 11, letterSpacing: "0.5px" }}>
                  {strokeCount} NÉT
                </div>
                <div className="d-flex flex-wrap gap-1">
                  {RADICALS_BY_STROKE[strokeCount].map((char) => {
                    const isSelected = selectedRadical === char;
                    const info = RADICAL_MAP[char];
                    return (
                      <button
                        key={char}
                        type="button"
                        className={`btn btn-sm d-flex align-items-center justify-content-center radical-btn ${isSelected ? "btn-success text-white shadow-sm" : "btn-outline-secondary"}`}
                        style={{ width: 36, height: 36, fontSize: 18, padding: 0, fontFamily: "serif", lineHeight: 1, transition: "all 0.15s ease", borderRadius: "8px" }}
                        title={`${char} – ${info?.nameVi} (${info?.name})`}
                        aria-label={`Bộ ${info?.nameVi} ${char}`}
                        aria-pressed={isSelected}
                        onClick={() => onChange({ radical: isSelected ? undefined : char, strokeFilter })}
                      >
                        {char}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 text-muted d-flex align-items-center gap-1" style={{ fontSize: 11 }}>
            <i className="isax isax-info-circle text-warning" aria-hidden="true" />
            Chọn số nét để thu hẹp danh sách, sau đó chọn bộ thủ để lọc từ vựng.
          </div>
        </div>
      )}
    </div>
  );
}
