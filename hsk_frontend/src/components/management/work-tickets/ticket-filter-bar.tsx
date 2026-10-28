"use client";

import { DatePicker } from "antd";
import { TICKET_MODULE_OPTIONS, TICKET_STATUS_LABELS, TICKET_STATUSES, type TicketFilters, type TicketScreen, type TicketStatusFilter } from "@/lib/work-tickets/ticket-model";

const { RangePicker } = DatePicker;

interface TicketFilterBarProps {
  screen: TicketScreen;
  filters: TicketFilters;
  onChange: (patch: Partial<TicketFilters>) => void;
  onReset: () => void;
}

/** Hai hàng bộ lọc trong card-header của hai màn cũ: tìm kiếm + tab trạng thái; module + khoảng ngày tạo + nút xoá lọc. Chỉ khác chữ giữa hai màn. */
export function TicketFilterBar({ screen, filters, onChange, onReset }: TicketFilterBarProps) {
  const statusTabs: { id: TicketStatusFilter; label: string }[] = [{ id: "ALL", label: "Tất cả" }, ...TICKET_STATUSES.map((s) => ({ id: s, label: TICKET_STATUS_LABELS[screen][s] }))];
  return (
    <div className="row g-3">
      <div className="col-lg-7">
        <div className="input-group shadow-sm rounded-pill overflow-hidden border">
          <span className="input-group-text bg-white border-0 ps-3">
            <i className="isax isax-search-normal-1 text-primary fs-18" />
          </span>
          <input
            type="text"
            className="form-control border-0 py-2 fs-14"
            placeholder={screen === "manager" ? "Tìm kiếm theo tên giảng viên, email hoặc mô tả công việc..." : "Tìm kiếm công việc theo mô tả..."}
            aria-label="Tìm kiếm ticket"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
          />
        </div>
      </div>
      <div className="col-lg-5 d-flex align-items-center justify-content-lg-end">
        <div className="d-flex bg-light p-1 rounded-pill" role="group" aria-label="Lọc theo trạng thái">
          {statusTabs.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`btn btn-xs rounded-pill px-3 py-1 fs-12 fw-600 transition-all ${filters.status === s.id ? "btn-primary text-white shadow-sm" : "btn-transparent text-gray-6"}`}
              aria-pressed={filters.status === s.id}
              onClick={() => onChange({ status: s.id })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="col-lg-4">
        <select className="form-select rounded-pill shadow-sm fs-13 border-gray-2" aria-label="Lọc theo module" value={filters.module} onChange={(e) => onChange({ module: e.target.value })}>
          <option value="ALL">{screen === "manager" ? "Tất cả Module nghiệp vụ" : "Tất cả Module"}</option>
          {TICKET_MODULE_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className="col-lg-6 d-flex gap-2 align-items-center">
        <div className="flex-grow-1">
          <RangePicker className="w-100 rounded-pill shadow-sm fs-13 py-2 border-gray-2" placeholder={["Từ ngày", "Đến ngày"]} value={filters.range} onChange={(dates) => onChange({ range: dates })} format="DD/MM/YYYY" />
        </div>
        <button
          type="button"
          className="btn btn-outline-danger btn-sm rounded-circle p-2 d-flex align-items-center justify-content-center"
          style={{ width: "38px", height: "38px" }}
          title="Xóa tất cả bộ lọc"
          aria-label="Xóa tất cả bộ lọc"
          onClick={onReset}
        >
          <i className="isax isax-refresh fs-18" />
        </button>
      </div>
    </div>
  );
}
