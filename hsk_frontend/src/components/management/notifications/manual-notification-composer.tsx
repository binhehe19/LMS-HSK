"use client";

// Port của LMS_Frontend/src/features/notifications/components/manual-notification-composer.tsx (cùng DOM, class và chữ). Logic trong
// use-campaign-composer.ts; hai modal con là recipient-selector-modal.tsx và campaign-preview-modal.tsx (đặt trong thẻ như bản cũ).
//
// Khác bản cũ có chủ đích: khi thao tác gửi chưa được bật (backend chưa xác nhận hợp đồng — lib/api/campaign-send-gate.ts) hiện khối cảnh báo
// "WAITING FOR BACKEND" và khoá nút "Xem trước & Gửi" (không có đường nào tới request gửi). Thêm aria cho nút đóng và các trường.
import { CampaignPreviewModal } from "@/components/management/notifications/campaign-preview-modal";
import { RecipientSelectorModal } from "@/components/management/notifications/recipient-selector-modal";
import { useCampaignComposer } from "@/components/management/notifications/use-campaign-composer";
import { MAX_RECIPIENT_CHIPS } from "@/lib/notifications/recipient-selection";

export function ManualNotificationComposer({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const composer = useCampaignComposer(onSuccess);
  const { recipients } = composer;
  const chips = [...recipients.entries()];

  return (
    <div className="card border-0 shadow-sm mb-4 overflow-hidden animate__animated animate__fadeInDown" data-testid="notification-composer">
      <div className="card-header bg-primary py-3 d-flex justify-content-between align-items-center">
        <h5 className="mb-0 text-white fw-bold">
          <i className="isax isax-send-2 me-2"></i>Gửi Thông Báo Hệ Thống
        </h5>
        <button type="button" className="btn-close btn-close-white" aria-label="Đóng form gửi thông báo" onClick={onCancel}></button>
      </div>
      <div className="card-body p-4">
        {composer.sendAvailability === "waiting" && (
          <div className="alert alert-warning mb-3" role="status" data-testid="campaign-send-notice">
            Chức năng gửi thông báo chưa được kết nối API (WAITING FOR BACKEND). Bạn có thể xem form nhưng chưa thể gửi.
          </div>
        )}
        <form className="row g-3" onSubmit={(e) => e.preventDefault()}>
          <div className="col-md-12">
            <label className="form-label fw-bold text-dark" htmlFor="campaign-title">
              Tiêu đề thông báo <span className="text-danger">*</span>
            </label>
            <input
              id="campaign-title"
              type="text"
              className="form-control form-control-lg fs-16 border-2"
              placeholder="VD: Cập nhật tài liệu khóa học mới..."
              value={composer.form.title}
              onChange={(e) => composer.setTitle(e.target.value)}
              required
            />
          </div>
          <div className="col-md-12">
            <label className="form-label fw-bold text-dark" htmlFor="campaign-message">
              Nội dung thông báo <span className="text-danger">*</span>
            </label>
            <textarea
              id="campaign-message"
              className="form-control form-control-lg fs-15 border-2"
              rows={4}
              placeholder="Nhập nội dung thông báo gửi đến người dùng..."
              value={composer.form.message}
              onChange={(e) => composer.setMessage(e.target.value)}
              required
            />
          </div>

          <div className="col-md-12 mt-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="form-label fw-bold text-dark mb-0">
                Người nhận ({recipients.size}) <span className="text-danger">*</span>
              </label>
              <button type="button" className="btn btn-sm btn-outline-primary rounded-pill px-3" onClick={() => composer.setShowUserModal(true)}>
                <i className="isax isax-profile-add me-1"></i> Chọn người nhận
              </button>
            </div>

            <div className="border rounded-3 p-3 bg-light" style={{ minHeight: "80px", maxHeight: "150px", overflowY: "auto" }}>
              {recipients.size === 0 ? (
                <div className="text-muted text-center py-3 fs-14">Chưa có người dùng nào được chọn.</div>
              ) : (
                <div className="d-flex flex-wrap gap-2">
                  {chips.slice(0, MAX_RECIPIENT_CHIPS).map(([id, name]) => (
                    <span key={id} className="badge bg-white text-primary border border-primary border-opacity-25 rounded-pill px-3 py-2 fs-13 d-flex align-items-center" data-testid="recipient-chip">
                      {name}
                      <i
                        className="isax isax-close-circle ms-2 cursor-pointer text-muted hover-text-danger"
                        role="button"
                        aria-label={`Bỏ chọn ${name}`}
                        onClick={() => composer.toggle(id)}
                      ></i>
                    </span>
                  ))}
                  {recipients.size > MAX_RECIPIENT_CHIPS && (
                    <span className="badge bg-secondary bg-opacity-10 text-secondary rounded-pill px-3 py-2">... và {recipients.size - MAX_RECIPIENT_CHIPS} người khác</span>
                  )}
                </div>
              )}
            </div>
            {recipients.size > 0 && (
              <div className="mt-2 text-end">
                <button type="button" className="btn btn-link btn-sm text-danger text-decoration-none p-0" onClick={composer.clearRecipients}>
                  <i className="isax isax-trash me-1"></i> Xóa tất cả
                </button>
              </div>
            )}
          </div>

          <div className="col-12 mt-4 d-flex gap-2 justify-content-center">
            <button type="button" className="btn btn-light rounded-pill px-5 py-2 fw-bold" onClick={onCancel}>
              Hủy
            </button>
            <button type="button" className="btn btn-primary rounded-pill px-5 py-2 fw-bold" onClick={composer.openPreview} disabled={composer.isSubmitting || composer.sendAvailability === "waiting"}>
              Xem trước & Gửi
            </button>
          </div>
        </form>
      </div>

      <RecipientSelectorModal show={composer.showUserModal} onClose={() => composer.setShowUserModal(false)} selected={recipients} onToggleUser={composer.toggle} onAddMany={composer.addMany} />

      <CampaignPreviewModal
        show={composer.showPreview}
        onClose={composer.closePreview}
        onSend={composer.confirmSend}
        title={composer.form.title}
        message={composer.form.message}
        recipientCount={recipients.size}
        isSubmitting={composer.isSubmitting}
      />
    </div>
  );
}
