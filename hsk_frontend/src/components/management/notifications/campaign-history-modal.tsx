"use client";

// Port của LMS_Frontend/src/features/notifications/components/campaign-history-modal.tsx (cùng DOM, class, style và chữ; `moment().format` => `dayjs().format`
// với cùng mẫu "DD/MM/YYYY HH:mm"). Dữ liệu qua hook use-campaign-history.ts (chỉ ĐỌC).
//
// Khác bản cũ có chủ đích: dịch vụ chưa cấu hình (WAITING FOR BACKEND) / gọi lỗi => dòng thông báo trong bảng (kèm "Thử lại" khi lỗi) thay vì
// "Chưa có thông báo nào được gửi." (sẽ nói sai rằng chưa từng gửi); thêm role/aria cho hộp thoại.
import dayjs from "dayjs";
import { useCampaignHistory } from "@/components/management/notifications/use-campaign-history";
import { campaignStatusClass } from "@/lib/notifications/recipient-selection";

const formatDate = (iso: string) => dayjs(iso).format("DD/MM/YYYY HH:mm");

export function CampaignHistoryModal({ show, onClose }: { show: boolean; onClose: () => void }) {
  const history = useCampaignHistory(show);
  if (!show) return null;

  const isLoading = history.state.kind === "loading";
  const { selected, campaigns } = history;

  return (
    <div className="modal show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="campaign-history-title" data-testid="campaign-history-modal" style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-white border-bottom py-3">
            <h5 className="modal-title fw-bold text-dark d-flex align-items-center" id="campaign-history-title">
              <i className="isax isax-receipt-item me-2 text-primary"></i>
              Lịch sử thông báo đã gửi
            </h5>
            <button type="button" className="btn-close shadow-none" aria-label="Đóng" onClick={onClose}></button>
          </div>

          <div className="modal-body p-0">
            {selected ? (
              <div className="p-4 animate__animated animate__fadeIn" data-testid="campaign-detail">
                <button type="button" className="btn btn-sm btn-light mb-3 rounded-pill px-3" onClick={() => history.select(null)}>
                  <i className="isax isax-arrow-left-2 me-1"></i> Quay lại danh sách
                </button>
                <div className="card border-0 bg-light rounded-3 p-4">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <h4 className="fw-bold text-dark mb-0">{selected.title}</h4>
                    <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-2 fs-12">{selected.status}</span>
                  </div>
                  <div className="text-muted fs-13 mb-4 d-flex align-items-center">
                    <i className="isax isax-calendar-edit me-1"></i>
                    Đã gửi lúc: {formatDate(selected.createdAt)}
                    <span className="mx-2">|</span>
                    <i className="isax isax-people me-1"></i>
                    Đối tượng: {selected.audienceType}
                  </div>
                  <hr className="my-3 opacity-10" />
                  <div className="notification-message-content fs-15 text-dark lh-base white-space-pre-wrap">{selected.message}</div>
                </div>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr className="fs-13 text-uppercase text-muted fw-bold">
                      <th className="ps-4 border-0">Tiêu đề</th>
                      <th className="border-0">Ngày gửi</th>
                      <th className="border-0">Đối tượng</th>
                      <th className="border-0 text-center">Trạng thái</th>
                      <th className="pe-4 border-0 text-end">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={5} className="text-center py-5">
                          <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                          Đang tải lịch sử...
                        </td>
                      </tr>
                    ) : history.state.kind === "waiting" || history.state.kind === "error" ? (
                      <tr>
                        <td colSpan={5} className="p-3">
                          <div className="alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2 mb-0" role="status" data-testid="campaign-data-notice" data-kind={history.state.kind}>
                            <span>
                              {history.state.kind === "error"
                                ? history.state.message
                                : "Lịch sử chiến dịch chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị."}
                            </span>
                            {history.state.kind === "error" && (
                              <button type="button" className="btn btn-sm btn-outline-danger" onClick={history.reload}>
                                Thử lại
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : campaigns.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-5 text-muted fs-14">
                          Chưa có thông báo nào được gửi.
                        </td>
                      </tr>
                    ) : (
                      campaigns.map((camp) => (
                        <tr key={camp.id} className="cursor-pointer" data-testid="campaign-row" onClick={() => history.select(camp)}>
                          <td className="ps-4">
                            <div className="fw-bold text-dark text-truncate" style={{ maxWidth: "250px" }}>
                              {camp.title}
                            </div>
                            <div className="text-muted small text-truncate" style={{ maxWidth: "250px" }}>
                              {camp.message}
                            </div>
                          </td>
                          <td className="fs-13 text-muted">{formatDate(camp.createdAt)}</td>
                          <td className="fs-13">
                            <span className="badge bg-secondary bg-opacity-10 text-secondary border-0">{camp.audienceType}</span>
                          </td>
                          <td className="text-center">
                            <span className={`badge rounded-pill fw-medium fs-11 ${campaignStatusClass(camp.status)}`}>{camp.status}</span>
                          </td>
                          <td className="pe-4 text-end">
                            <button type="button" className="btn btn-sm btn-outline-primary rounded-pill px-3">
                              Xem
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!selected && history.totalPages > 1 && (
            <div className="modal-footer border-top justify-content-between p-3 bg-light bg-opacity-50">
              <button type="button" className="btn btn-sm btn-outline-secondary border-0" disabled={history.page === 0 || isLoading} onClick={() => history.goToPage(history.page - 1)}>
                <i className="isax isax-arrow-left-2 me-1"></i> Trước
              </button>
              <span className="text-muted fs-13">
                Trang <strong>{history.page + 1}</strong> / {history.totalPages}
              </span>
              <button type="button" className="btn btn-sm btn-outline-secondary border-0" disabled={history.page >= history.totalPages - 1 || isLoading} onClick={() => history.goToPage(history.page + 1)}>
                Sau <i className="isax isax-arrow-right-3 ms-1"></i>
              </button>
            </div>
          )}

          <div className="modal-footer border-top p-3">
            <button type="button" className="btn btn-light rounded-pill px-4" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
