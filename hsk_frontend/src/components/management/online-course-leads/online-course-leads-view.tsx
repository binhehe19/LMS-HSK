"use client";

// Port của LMS_Frontend/src/features/learning-path/online-course/manage/online-course-lead-management-page.tsx (cùng DOM/class, chữ; dùng DataTable
// dùng chung như bản cũ với Search=false, pagination=false + nút Trước/Sau phân trang máy chủ). View thuần: không gọi API.
//
// Khác bản cũ có chủ đích: (1) "Xuất Excel" (GET /leads/export .xlsx) => "Xuất CSV" các dòng đang hiển thị, tạo phía trình duyệt; (2) lỗi/chưa cấu hình
// => FetchStateNotice thay vì toast + bảng rỗng; (3) thứ tự cột theo yêu cầu M5: Học viên, Liên hệ, Nội dung đăng ký, Loại khóa học, Ngày đăng ký,
// Trạng thái, Ghi chú; (4) Alert "Chế độ Xem duy nhất" cho giảng viên không chuyển (route chỉ ADMIN); (5) react-bootstrap Badge/Button/Form =>
// phần tử Bootstrap thuần, DatePicker.RangePicker của antd giữ nguyên.
import { DatePicker } from "antd";
import type { TableProps } from "antd";
import type { Dayjs } from "dayjs";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { DataTable } from "@/components/shared/data-table";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { formatLeadDate, LEAD_STATUS_OPTIONS, leadStatusBadgeClass, leadStatusLabel, resolveLeadCourseType, type LeadStatusFilter } from "@/lib/online-course/lead-model";
import type { OnlineCourseLead, OnlineCourseLeadPage } from "@/types/online-course";

const { RangePicker } = DatePicker;

export const LEADS_WAITING_TEXT = "Danh sách đăng ký khóa học chưa được kết nối API (WAITING FOR BACKEND).";

export type LeadDateRange = [Dayjs | null, Dayjs | null] | null;

export interface LeadsDraftFilters {
  courseCode: string;
  range: LeadDateRange;
  status: LeadStatusFilter;
}

export interface OnlineCourseLeadsViewProps {
  state: FetchState<OnlineCourseLeadPage>;
  /** Dòng đang hiển thị (trang hiện tại đã lọc trạng thái phía client). */
  rows: OnlineCourseLead[];
  totalElements: number;
  totalPages: number;
  /** Trang hiện tại (từ 0). */
  page: number;
  refreshing: boolean;
  courseTypes: Record<string, string>;
  draft: LeadsDraftFilters;
  onDraftChange: (next: LeadsDraftFilters) => void;
  onApply: () => void;
  onReset: () => void;
  onPrev: () => void;
  onNext: () => void;
  onExport: () => void;
  onRetry: () => void;
}

export function OnlineCourseLeadsView(props: OnlineCourseLeadsViewProps) {
  const { state, rows, totalElements, totalPages, page, refreshing, courseTypes, draft } = props;
  const loading = state.kind === "loading" && !refreshing;
  const notice = state.kind === "waiting" || state.kind === "error";

  const columns: TableProps<OnlineCourseLead>["columns"] = [
    {
      title: "Học viên",
      key: "fullName",
      render: (_: unknown, lead) => (
        <div>
          <div className="fw-semibold">{lead.fullName}</div>
          <small className="text-muted">{lead.email}</small>
        </div>
      ),
    },
    { title: "Liên hệ", dataIndex: "phone", key: "phone", render: (phone: string | undefined) => phone || "-" },
    { title: "Nội dung đăng ký", key: "courseName", render: (_: unknown, lead) => <div className="fw-semibold">{lead.courseName || lead.courseCode || "-"}</div> },
    { title: "Loại khóa học", key: "courseType", render: (_: unknown, lead) => resolveLeadCourseType(lead, courseTypes) },
    { title: "Ngày đăng ký", dataIndex: "registeredAt", key: "registeredAt", render: (value: string | undefined) => formatLeadDate(value) },
    { title: "Trạng thái", dataIndex: "status", key: "status", render: (status: string | undefined) => <span className={`badge ${leadStatusBadgeClass(status)}`}>{leadStatusLabel(status)}</span> },
    { title: "Ghi chú", dataIndex: "note", key: "note", render: (note: string | undefined) => note || "-" },
  ];

  return (
    <ManagementPageFrame>
      <div className="page-title d-flex align-items-center justify-content-between">
        <div>
          <h3 className="fw-bold mb-1">Quản lý đăng ký khóa học online</h3>
        </div>
        <button type="button" className="btn btn-outline-success" onClick={props.onExport} disabled={rows.length === 0}>
          Xuất CSV
        </button>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-4">
          <div className="row g-3 align-items-end">
            <div className="col-lg-4">
              <label className="form-label" htmlFor="leads-course-code">
                Mã khóa học
              </label>
              <div className="input-icon position-relative">
                <span className="input-icon-addon">
                  <i className="isax isax-search-normal-14" />
                </span>
                <input id="leads-course-code" className="form-control" placeholder="Tìm theo mã khóa học..." value={draft.courseCode} onChange={(e) => props.onDraftChange({ ...draft, courseCode: e.target.value })} />
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <label className="form-label" htmlFor="leads-range">
                Từ ngày - Đến ngày
              </label>
              <RangePicker id="leads-range" className="w-100" placeholder={["Từ ngày", "Đến ngày"]} format="DD/MM/YYYY" value={draft.range} onChange={(dates) => props.onDraftChange({ ...draft, range: dates })} />
            </div>
            <div className="col-lg-2 col-md-3">
              <label className="form-label" htmlFor="leads-status">
                Trạng thái
              </label>
              <select id="leads-status" className="form-select" value={draft.status} onChange={(e) => props.onDraftChange({ ...draft, status: e.target.value as LeadStatusFilter })}>
                {LEAD_STATUS_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-2 col-md-3 d-grid">
              <button type="button" className="btn btn-danger" onClick={props.onApply}>
                Lọc
              </button>
            </div>
          </div>
          <div className="d-flex justify-content-between align-items-center mt-3">
            <small className="text-muted">Tổng: {totalElements} bản ghi</small>
            <button type="button" className="btn btn-light border" onClick={props.onReset}>
              Xóa bộ lọc
            </button>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-4" data-testid="leads-loading">
              <span className="spinner-border" role="status" />
            </div>
          ) : notice ? (
            <div className="p-3">
              <FetchStateNotice state={state} waitingText={LEADS_WAITING_TEXT} onRetry={props.onRetry} testId="leads-notice" />
            </div>
          ) : (
            <div className="pt-3">
              <DataTable<OnlineCourseLead> columns={columns} dataSource={rows} rowKey="id" search={false} pagination={false} loading={refreshing} locale={{ emptyText: "Chưa có đăng ký nào" }} />
            </div>
          )}

          <div className="d-flex justify-content-end align-items-center mt-3 px-3 pb-3">
            <div className="d-flex align-items-center gap-2">
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page <= 0 || loading || notice} onClick={props.onPrev}>
                Trước
              </button>
              <span className="small text-muted">
                Trang {page + 1} / {Math.max(totalPages, 1)}
              </span>
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page + 1 >= totalPages || loading || notice} onClick={props.onNext}>
                Sau
              </button>
            </div>
          </div>
        </div>
      </div>
    </ManagementPageFrame>
  );
}
