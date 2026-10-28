"use client";

import type { TicketCounts } from "@/lib/work-tickets/ticket-model";

const CARDS: { key: keyof TicketCounts; textClass: string; barClass: string }[] = [
  { key: "total", textClass: "", barClass: "bg-soft-primary" },
  { key: "open", textClass: " text-primary", barClass: "bg-primary" },
  { key: "done", textClass: " text-success", barClass: "bg-success" },
  { key: "closed", textClass: " text-gray-4", barClass: "bg-secondary" },
];

/** Bốn thẻ "Tổng cộng / … / Đã đóng" của hai màn cũ (cùng DOM, chỉ khác chữ). `counts = null` (chưa tích hợp/lỗi) => "—" thay vì số 0 giả. */
export function TicketStatCards({ counts, labels }: { counts: TicketCounts | null; labels: Readonly<Record<keyof TicketCounts, string>> }) {
  return (
    <div className="row g-3">
      {CARDS.map(({ key, textClass, barClass }) => (
        <div key={key} className="col-md-3">
          <div className={`card text-center border-0 shadow-sm overflow-hidden h-100${textClass}`}>
            <div className="card-body p-3">
              <span className="d-block text-gray-5 fs-13 mb-1">{labels[key]}</span>
              <h3 className="fw-bold mb-0" data-testid={`ticket-stat-${key}`}>
                {counts ? counts[key] : "—"}
              </h3>
              <div className={`mt-2 ${barClass} rounded-pill`} style={{ height: "3px" }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
