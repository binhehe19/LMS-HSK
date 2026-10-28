"use client";

// Port của LMS_Frontend/src/features/teacher-manager/instructor/teacher-manager-tickets.tsx (màn "Phân công công việc & Quyền hạn" của Admin; HSK cũ dùng
// chung component cho Admin và Teacher-manager). View thuần: không gọi API; dữ liệu, bộ lọc và hành động qua props (container: admin-tickets-page-content.tsx).
// Giữ DOM/class/chữ của bản cũ: tiêu đề + nút tạo, 4 thẻ thống kê, card bộ lọc + bảng (DataTable dùng chung, Search=false).
//
// Khác bản cũ có chủ đích: (1) dịch vụ chưa cấu hình / gọi lỗi => dòng thông báo (kèm Thử lại khi lỗi) và thẻ "—" thay vì bảng rỗng + số 0 giả;
// (2) công tắc ghi đóng => WriteLockedNotice + khoá nút Tạo/Đóng/Sửa/Xoá (bản cũ không có khái niệm này); (3) modal Bootstrap => antd Modal
// (ticket-form-modal.tsx), xác nhận xoá => confirmAction; (4) bảng rỗng ghi tiếng Việt thay "No data" của antd; (5) aria-label cho nút biểu tượng.
import type { TableColumnsType } from "antd";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { TicketFilterBar } from "@/components/management/work-tickets/ticket-filter-bar";
import { TicketStatCards } from "@/components/management/work-tickets/ticket-stat-cards";
import { DataTable } from "@/components/shared/data-table";
import { FetchStateNotice, WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import {
  EMPTY_TICKET_FILTERS,
  TICKET_STATUS_BADGE,
  TICKET_STATUS_LABELS,
  countTicketsByStatus,
  formatTicketDate,
  ticketAssigneeName,
  ticketModuleLabel,
  type TicketFilters,
} from "@/lib/work-tickets/ticket-model";
import type { TicketResponse } from "@/types/ticket";

interface AdminTicketsViewProps {
  state: FetchState<TicketResponse[]>;
  /** Ticket đã qua bộ lọc (container lọc bằng filterTickets). */
  filtered: TicketResponse[];
  filters: TicketFilters;
  writeEnabled: boolean;
  onFiltersChange: (patch: Partial<TicketFilters>) => void;
  onResetFilters: () => void;
  onRetry: () => void;
  onCreate: () => void;
  onEdit: (ticket: TicketResponse) => void;
  onClose: (ticket: TicketResponse) => void;
  onDelete: (ticket: TicketResponse) => void;
}

const STAT_LABELS = { total: "Tổng cộng", open: "Đang mở", done: "Chờ duyệt", closed: "Đã đóng" } as const;

const hasActiveFilter = (f: TicketFilters) => f.search.trim() !== "" || f.module !== EMPTY_TICKET_FILTERS.module || f.status !== EMPTY_TICKET_FILTERS.status || f.range !== null;

export function AdminTicketsView({ state, filtered, filters, writeEnabled, onFiltersChange, onResetFilters, onRetry, onCreate, onEdit, onClose, onDelete }: AdminTicketsViewProps) {
  const loading = state.kind === "loading";
  const blocked = state.kind === "waiting" || state.kind === "error";
  // Đang tải: số 0 như bản cũ; chưa tích hợp/lỗi: "—"; có dữ liệu: đếm trên danh sách đã lọc.
  const counts = blocked ? null : countTicketsByStatus(filtered);
  const ticketLabel = (t: TicketResponse) => `${ticketModuleLabel(t.module)} của ${ticketAssigneeName(t) || t.assignedId}`;

  const columns: TableColumnsType<TicketResponse> = [
    {
      title: "Người được giao",
      dataIndex: "assignedName",
      render: (_: unknown, record) => {
        const name = ticketAssigneeName(record);
        return (
          <div className="d-flex align-items-center">
            <div className="flex-shrink-0 me-2">
              <span className="avatar avatar-sm rounded-circle bg-soft-primary d-flex align-items-center justify-content-center fw-bold" style={{ width: "32px", height: "32px" }}>
                {name.charAt(0) || "U"}
              </span>
            </div>
            <div>
              <h6 className="mb-0 fs-14 fw-bold">{name || "N/A"}</h6>
              <span className="fs-12 text-gray-5 d-block">{record.assignedEmail}</span>
            </div>
          </div>
        );
      },
      sorter: (a, b) => ticketAssigneeName(a).localeCompare(ticketAssigneeName(b)),
    },
    {
      title: "Module",
      dataIndex: "module",
      render: (module: TicketResponse["module"]) => (
        <span className="badge badge-soft-info px-2 py-1" style={{ fontSize: "11px" }}>
          {ticketModuleLabel(module)}
        </span>
      ),
      sorter: (a, b) => (a.module ?? "").localeCompare(b.module ?? ""),
    },
    {
      title: "Mô tả",
      dataIndex: "description",
      render: (text: string | undefined) => (
        <span className="text-truncate d-inline-block fs-13" style={{ maxWidth: "200px" }} title={text}>
          {text}
        </span>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      render: (status: TicketResponse["status"]) => (
        <span className={`badge badge-sm ${TICKET_STATUS_BADGE[status] ?? "bg-gray-500"} d-inline-flex align-items-center text-white px-2 py-1 rounded-pill`} style={{ fontSize: "11px" }}>
          <i className="fa-solid fa-circle dot-xs me-1 fs-8" />
          {TICKET_STATUS_LABELS.manager[status] ?? status}
        </span>
      ),
      sorter: (a, b) => a.status.localeCompare(b.status),
    },
    { title: "Ngày tạo", dataIndex: "createdAt", render: (date: string | undefined) => formatTicketDate(date) },
    {
      title: "Hành động",
      key: "actions",
      render: (_: unknown, record) => (
        <div className="d-flex align-items-center gap-2">
          {record.status !== "CLOSE" && (
            <button type="button" className="btn btn-sm btn-soft-danger px-2 py-1 fs-12 rounded-pill" title="Đóng Ticket & Thu hồi quyền" aria-label={`Đóng ticket ${ticketLabel(record)}`} disabled={!writeEnabled} onClick={() => onClose(record)}>
              <i className="isax isax-slash me-1" />
              Đóng
            </button>
          )}
          {record.status === "OPEN" && (
            <button type="button" className="btn btn-sm btn-icon btn-soft-primary rounded-circle" title="Chỉnh sửa (Chỉ khi đang mở)" aria-label={`Chỉnh sửa ticket ${ticketLabel(record)}`} disabled={!writeEnabled} onClick={() => onEdit(record)}>
              <i className="isax isax-edit-2" />
            </button>
          )}
          {record.status === "CLOSE" && (
            <button type="button" className="btn btn-sm btn-icon btn-soft-danger rounded-circle" title="Xóa Ticket (Chỉ khi đã đóng)" aria-label={`Xóa ticket ${ticketLabel(record)}`} disabled={!writeEnabled} onClick={() => onDelete(record)}>
              <i className="isax isax-trash" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <ManagementPageFrame>
      <div className="tickets">
        <div className="d-flex align-items-center justify-content-between flex-wrap page-title mb-4">
          <div className="d-flex align-items-center">
            <div className="bg-soft-primary p-2 rounded-circle me-3 d-flex align-items-center justify-content-center" style={{ width: "42px", height: "42px" }}>
              <i className="isax isax-ticket-2 text-primary fs-24" />
            </div>
            <div>
              <h4 className="fw-bold mb-0">Phân công công việc &amp; Quyền hạn</h4>
              <p className="text-gray-5 fs-14 mb-0">Quản lý và theo dõi việc phân bổ module cho giảng viên &amp; CTV</p>
            </div>
          </div>
          <button type="button" className="btn btn-primary rounded-pill d-flex align-items-center px-4" disabled={!writeEnabled || blocked} onClick={onCreate}>
            <i className="isax isax-add-circle me-2 fs-18" />
            Tạo Phân công mới
          </button>
        </div>

        {!writeEnabled && <WriteLockedNotice what="Phân công công việc (tạo/sửa/đóng/xoá ticket)" className="mb-3" />}

        <TicketStatCards counts={counts} labels={STAT_LABELS} />

        <div className="card shadow-sm border-0 mt-4 rounded-4 overflow-hidden">
          <div className="card-header bg-white border-0 pt-4 pb-0 px-4">
            <TicketFilterBar screen="manager" filters={filters} onChange={onFiltersChange} onReset={onResetFilters} />
          </div>
          <div className="card-body p-0 mt-3 px-4 pb-4">
            {blocked ? (
              <FetchStateNotice state={state} waitingText="Danh sách phân công chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị." onRetry={onRetry} testId="ticket-list-notice" />
            ) : (
              <DataTable<TicketResponse>
                columns={columns}
                dataSource={filtered}
                rowKey="id"
                search={false}
                loading={loading}
                locale={{ emptyText: loading ? " " : hasActiveFilter(filters) ? "Không có ticket phù hợp bộ lọc" : "Chưa có ticket nào" }}
              />
            )}
          </div>
        </div>
      </div>
    </ManagementPageFrame>
  );
}
