"use client";

// Panel "Lọc theo Trình độ HSK" (HSK cũ: features/learning-path/vocabulary/components/hsk-filter-panel.tsx), giữ nguyên giao diện.
// Khác bản cũ: danh sách cấp lấy từ GET /dictionary-hanzi/levels (một lời gọi) thay vì dò 9 lần search; header là <button> để dùng được bằng bàn phím.
import { useState } from "react";

export function HskFilterPanel({ selectedHsk, levels, onHskChange }: { selectedHsk?: number; levels: number[]; onHskChange: (hsk: number | undefined) => void }) {
  // Tự mở panel nếu đang có cấp được chọn (khôi phục từ URL).
  const [isExpanded, setIsExpanded] = useState<boolean>(() => selectedHsk !== undefined);

  return (
    <div className="hsk-filter-panel border rounded-3 bg-white shadow-sm" style={{ overflow: "hidden" }}>
      <div
        className="vocab-filter-header d-flex align-items-center justify-content-between px-3 py-2"
        style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", borderBottom: isExpanded ? "1px solid #d1fae5" : "none" }}
      >
        <button type="button" className="vocab-filter-toggle d-flex align-items-center gap-2 flex-grow-1" aria-expanded={isExpanded} onClick={() => setIsExpanded((v) => !v)}>
          <span className="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 28, height: 28, background: "#10b981", color: "#fff", fontSize: 14 }}>
            <i className="isax isax-medal-star" aria-hidden="true" />
          </span>
          <span className="fw-bold text-dark" style={{ fontSize: 14 }}>
            Lọc theo Trình độ HSK
          </span>
          {selectedHsk !== undefined && (
            <span className="badge rounded-pill px-2 py-1" style={{ background: "#10b981", color: "#fff", fontSize: 12, fontWeight: 700 }}>
              HSK {selectedHsk}
            </span>
          )}
        </button>
        <div className="d-flex align-items-center gap-2">
          {selectedHsk !== undefined && (
            <button type="button" className="btn btn-sm btn-link text-danger p-0 text-decoration-none" style={{ fontSize: 12 }} onClick={() => onHskChange(undefined)} title="Xóa lọc HSK">
              <i className="isax isax-close-circle me-1" aria-hidden="true" />
              Xóa lọc
            </button>
          )}
          <i className={`isax isax-arrow-${isExpanded ? "up" : "down"}-1 text-muted`} style={{ fontSize: 16 }} aria-hidden="true" />
        </div>
      </div>

      {isExpanded && (
        <div className="p-3">
          <div className="d-flex flex-wrap gap-1 align-items-center">
            <span className="text-muted me-1" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
              Cấp độ:
            </span>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-2 py-0 ${selectedHsk === undefined ? "btn-dark" : "btn-outline-secondary"}`}
              style={{ fontSize: 12, lineHeight: "1.6" }}
              aria-pressed={selectedHsk === undefined}
              onClick={() => onHskChange(undefined)}
            >
              Tất cả
            </button>
            {levels.map((level) => (
              <button
                key={level}
                type="button"
                className={`btn btn-sm rounded-pill px-2 py-0 ${selectedHsk === level ? "btn-success text-white shadow-sm" : "btn-outline-secondary"}`}
                style={{ fontSize: 12, lineHeight: "1.6" }}
                aria-pressed={selectedHsk === level}
                onClick={() => onHskChange(selectedHsk === level ? undefined : level)}
              >
                HSK {level}
              </button>
            ))}
          </div>
          <div className="mt-2 text-muted d-flex align-items-center gap-1" style={{ fontSize: 11 }}>
            <i className="isax isax-info-circle text-warning" aria-hidden="true" />
            Chọn một cấp HSK để lọc từ vựng theo trình độ.
          </div>
        </div>
      )}
    </div>
  );
}
