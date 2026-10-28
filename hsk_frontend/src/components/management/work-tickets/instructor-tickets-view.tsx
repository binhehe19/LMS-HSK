"use client";

// Port của LMS_Frontend/src/features/instructor/instructor-tickets/instructor-tickets.tsx (màn "Danh sách Phân công công việc" của giảng viên).
// View thuần: không gọi API (container: instructor-tickets-page-content.tsx). Giữ DOM/class/chữ: tiêu đề, 4 thẻ, card bộ lọc + bảng, khối lưu ý cuối trang.
//
// Khác bản cũ có chủ đích: (1) chưa cấu hình / lỗi => dòng thông báo (kèm Thử lại) và thẻ "—" thay vì bảng rỗng + số 0 giả; (2) công tắc ghi đóng =>
// WriteLockedNotice + khoá nút "Báo cáo hoàn thành"; (3) bảng rỗng ghi tiếng Việt thay "No data" của antd; (4) aria-label cho nút hành động.
import type { TableColumnsType } from "antd";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { TicketFilterBar } from "@/components/management/work-tickets/ticket-filter-bar";
import { TicketStatCards } from "@/components/management/work-tickets/ticket-stat-cards";
import { DataTable } from "@/components/shared/data-table";
import { FetchStateNotice, WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import { EMPTY_TICKET_FILTERS, TICKET_STATUS_BADGE, TICKET_STATUS_LABELS, countTicketsByStatus, ticketModuleLabel, type TicketFilters } from "@/lib/work-tickets/ticket-model";
import type { TicketResponse } from "@/types/ticket";

interface InstructorTicketsViewProps {
  state: FetchState<TicketResponse[]>;
  /** Ticket của CHÍNH người dùng đã qua bộ lọc. */
  filtered: TicketResponse[];
  filters: TicketFilters;
  writeEnabled: boolean;
  /** Đang gửi "Báo cáo hoàn thành" (bản cũ khoá mọi nút trong lúc gửi). */
  busy: boolean;
  onFiltersChange: (patch: Partial<TicketFilters>) => void;
  onResetFilters: () => void;
  onRetry: () => void;
  onMarkDone: (ticket: TicketResponse) => void;
}

const STAT_LABELS = { total: "Tổng cộng", open: "Đang thực hiện", done: "Đã báo cáo", closed: "Đã đóng" } as const;

const hasActiveFilter = (f: TicketFilters) => f.search.trim() !== "" || f.module !== EMPTY_TICKET_FILTERS.module || f.status !== EMPTY_TICKET_FILTERS.status || f.range !== null;

export function InstructorTicketsView({ state, filtered, filters, writeEnabled, busy, onFiltersChange, onResetFilters, onRetry, onMarkDone }: InstructorTicketsViewProps) {
  const loading = state.kind === "loading";
  const blocked = state.kind === "waiting" || state.kind === "error";
  const counts = blocked ? null : countTicketsByStatus(filtered);

  const columns: TableColumnsType<TicketResponse> = [
    {
      title: "Module được giao",
      dataIndex: "module",
      render: (module: TicketResponse["module"]) => (
        <span className="badge badge-soft-info px-2 py-1" style={{ fontSize: "12px" }}>
          {ticketModuleLabel(module)}
        </span>
      ),
      sorter: (a, b) => (a.module ?? "").localeCompare(b.module ?? ""),
    },
    { title: "Mô tả công việc", dataIndex: "description", render: (text: string | undefined) => <span className="fs-14 fw-medium text-gray-9">{text}</span> },
    {
      title: "Trạng thái",
      dataIndex: "status",
      render: (status: TicketResponse["status"]) => (
        <span className={`badge badge-sm ${TICKET_STATUS_BADGE[status] ?? "bg-gray-500"} d-inline-flex align-items-center text-white px-3 py-1 rounded-pill`}>
          <i className="fa-solid fa-circle dot-xs me-1 fs-8" />
          {TICKET_STATUS_LABELS.instructor[status] ?? status}
        </span>
      ),
      sorter: (a, b) => a.status.localeCompare(b.status),
    },
    {
      title: "Hành động",
      key: "actions",
      render: (_: unknown, record) => (
        <div className="d-flex align-items-center">
          {record.status === "OPEN" ? (
            <button type="button" className="btn btn-sm btn-soft-primary rounded-pill px-3 fw-600" aria-label={`Báo cáo hoàn thành ${ticketModuleLabel(record.module)}`} disabled={busy || !writeEnabled} onClick={() => onMarkDone(record)}>
              <i className="isax isax-tick-circle me-1" />
              Báo cáo hoàn thành
            </button>
          ) : (
            <span className="text-muted fs-12 italic opacity-75">Không có hành động</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <ManagementPageFrame>
      <div className="tickets">
        <div className="d-flex align-items-center page-title mb-4">
          <div className="bg-soft-primary p-2 rounded-circle me-3 d-flex align-items-center justify-content-center" style={{ width: "42px", height: "42px" }}>
            <i className="isax isax-ticket-2 text-primary fs-24" />
          </div>
          <div>
            <h4 className="fw-bold mb-0">Danh sách Phân công công việc</h4>
            <p className="text-gray-5 fs-14 mb-0">Theo dõi các module bạn đã được phân công quyền hạn và báo cáo tiến độ.</p>
          </div>
        </div>

        {!writeEnabled && <WriteLockedNotice what="Báo cáo hoàn thành công việc" className="mb-3" />}

        <TicketStatCards counts={counts} labels={STAT_LABELS} />

        <div className="card shadow-sm border-0 mt-4 rounded-4 overflow-hidden">
          <div className="card-header bg-white border-0 pt-4 pb-0 px-4">
            <TicketFilterBar screen="instructor" filters={filters} onChange={onFiltersChange} onReset={onResetFilters} />
          </div>
          <div className="card-body p-0 mt-3 px-4 pb-4">
            {blocked ? (
              <FetchStateNotice state={state} waitingText="Danh sách công việc chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị." onRetry={onRetry} testId="ticket-list-notice" />
            ) : (
              <DataTable<TicketResponse>
                columns={columns}
                dataSource={filtered}
                rowKey="id"
                search={false}
                loading={loading}
                locale={{ emptyText: loading ? " " : hasActiveFilter(filters) ? "Không có công việc phù hợp bộ lọc" : "Bạn chưa được phân công công việc nào" }}
              />
            )}
          </div>
        </div>

        <div className="mt-4 bg-soft-info p-3 rounded-3 d-flex align-items-start border border-info border-opacity-10">
          <i className="isax isax-info-circle fs-20 me-2 text-info" />
          <div className="fs-13 text-gray-9">
            <strong>Lưu ý:</strong> Toàn bộ các module quản lý luôn hiển thị trên Sidebar để bạn có thể theo dõi dữ liệu. Tuy nhiên, bạn chỉ có quyền <strong>Thêm/Sửa/Xóa (CUD)</strong> khi Ticket tương ứng của module đó đang ở
            trạng thái <strong>Đang mở</strong> hoặc <strong>Đã báo cáo</strong>. Khi Manager đóng ticket, module đó sẽ chuyển sang <strong>Chế độ Xem duy nhất</strong>.
          </div>
        </div>
      </div>
    </ManagementPageFrame>
  );
}
