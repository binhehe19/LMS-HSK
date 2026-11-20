"use client";

// Port của LMS_Frontend/src/features/notifications/components/notification-list-content.tsx (cùng DOM, class, style nội tuyến và chữ;
// chữ lấy từ locales/vi/student.ts). View thuần: không gọi API, nhận dữ liệu qua props (container: instructor-notifications-page-content.tsx).
//
// Khác bản cũ có chủ đích: khi dịch vụ chưa cấu hình / gọi lỗi, vùng danh sách hiện một khối thông báo (kèm nút "Thử lại" khi lỗi)
// thay vì trạng thái rỗng "Không tìm thấy thông báo nào" (nó sẽ nói sai rằng người dùng không có thông báo). Các trạng thái còn lại giống bản cũ.
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import type { NotificationPageState } from "@/components/management/notifications/use-notification-page";
import type { NotificationFilters, NotificationResponse } from "@/types/notification";

const { RangePicker } = DatePicker;

interface NotificationListViewProps {
  title: string;
  state: NotificationPageState;
  items: NotificationResponse[];
  unreadCount: number;
  totalElements: number;
  filters: NotificationFilters;
  headerActions?: ReactNode;
  onMarkAllRead: () => void;
  onOpen: (noti: NotificationResponse) => void;
  onChangeFilters: (patch: Partial<Pick<NotificationFilters, "readStatus" | "fromDate" | "toDate">>) => void;
  onGoToPage: (page: number) => void;
  onRetry: () => void;
}

export function NotificationListView({
  title,
  state,
  items,
  unreadCount,
  totalElements,
  filters,
  headerActions,
  onMarkAllRead,
  onOpen,
  onChangeFilters,
  onGoToPage,
  onRetry,
}: NotificationListViewProps) {
  const loading = state.kind === "loading";
  const size = filters.size || 10;
  const page = filters.page || 0;
  const totalPages = Math.ceil(totalElements / size);

  return (
    <div className="card shadow-sm border-0 mb-4">
      <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center">
          <h4 className="mb-0 fw-bold me-3">{title}</h4>
          {unreadCount > 0 && <span className="badge bg-danger rounded-pill">{`${unreadCount} chưa đọc`}</span>}
        </div>
        <div className="d-flex gap-2 align-items-center">
          {headerActions}
          <button type="button" className="btn btn-outline-primary btn-sm rounded-pill px-3" onClick={onMarkAllRead} disabled={unreadCount === 0 || loading}>
            Đánh dấu tất cả là đã đọc
          </button>
        </div>
      </div>
      <div className="card-body p-0">
        {/* Filters */}
        <div className="p-3 border-bottom bg-light-50 d-flex flex-wrap gap-3 align-items-center">
          <div className="d-flex align-items-center">
            <label className="me-2 fs-14 text-muted">Trạng thái:</label>
            <select
              className="form-select form-select-sm border-0 shadow-sm"
              style={{ width: "150px" }}
              value={filters.readStatus}
              onChange={(e) => onChangeFilters({ readStatus: e.target.value as NotificationFilters["readStatus"] })}
            >
              <option value="ALL">Tất cả</option>
              <option value="UNREAD">Chưa đọc</option>
              <option value="READ">Đã đọc</option>
            </select>
          </div>
          <div className="d-flex align-items-center">
            <label className="me-2 fs-14 text-muted">Từ ngày - Đến ngày:</label>
            <RangePicker
              className="shadow-sm"
              format="DD/MM/YYYY"
              placeholder={["Từ ngày", "Đến ngày"]}
              value={filters.fromDate && filters.toDate ? [dayjs(filters.fromDate), dayjs(filters.toDate)] : null}
              onChange={(dates) => {
                if (dates?.[0] && dates?.[1]) {
                  onChangeFilters({ fromDate: dates[0].startOf("day").toISOString(), toDate: dates[1].endOf("day").toISOString() });
                  return;
                }
                onChangeFilters({ fromDate: undefined, toDate: undefined });
              }}
            />
          </div>
        </div>

        {/* List */}
        <div className="notification-list-items">
          {loading ? (
            <div className="p-5 text-center">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="mt-2 text-muted">Đang tải...</p>
            </div>
          ) : state.kind === "waiting" || state.kind === "error" ? (
            <div className="p-4">
              <FetchStateNotice state={state} waitingText="Dịch vụ thông báo chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị." onRetry={onRetry} testId="notifications-data-notice" />
            </div>
          ) : items.length > 0 ? (
            items.map((noti) => (
              <div
                key={noti.id}
                className={`p-4 border-bottom d-flex align-items-start transition-all hover-bg-light ${!noti.read ? "bg-light-primary border-start border-primary border-4" : ""}`}
                style={{ cursor: "pointer" }}
                onClick={() => onOpen(noti)}
              >
                <div className="flex-shrink-0 me-4">
                  <div className={`p-3 rounded-circle ${!noti.read ? "bg-primary text-white" : "bg-light text-muted"}`}>
                    <i className="isax isax-notification-status5 fs-24"></i>
                  </div>
                </div>
                <div className="flex-grow-1">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <h5 className={`mb-0 ${!noti.read ? "fw-bold text-primary" : "fw-semibold text-dark"}`}>{noti.title}</h5>
                    <span className="text-muted fs-13">
                      <i className="isax isax-clock me-1"></i>
                      {dayjs(noti.createdAt).format("HH:mm DD/MM/YYYY")}
                    </span>
                  </div>
                  <p className="mb-0 text-muted fs-15 lh-base" style={{ maxWidth: "800px" }}>
                    {noti.message}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-5 text-center">
              <div className="mb-3">
                <i className="isax isax-notification-bing fs-56 text-muted-light"></i>
              </div>
              <h5 className="text-muted">Không tìm thấy thông báo nào</h5>
              <p className="text-muted-light">Thử thay đổi bộ lọc hoặc quay lại sau nhé!</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && totalElements > size && (
          <div className="card-footer bg-white py-3 border-top d-flex justify-content-center">
            <nav>
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${page === 0 ? "disabled" : ""}`}>
                  <button type="button" className="page-link" onClick={() => onGoToPage(page - 1)}>
                    Trước
                  </button>
                </li>
                {Array.from({ length: totalPages }, (_, idx) => (
                  <li key={idx} className={`page-item ${page === idx ? "active" : ""}`}>
                    <button type="button" className="page-link" onClick={() => onGoToPage(idx)}>
                      {idx + 1}
                    </button>
                  </li>
                ))}
                <li className={`page-item ${page >= totalPages - 1 ? "disabled" : ""}`}>
                  <button type="button" className="page-link" onClick={() => onGoToPage(page + 1)}>
                    Sau
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}
