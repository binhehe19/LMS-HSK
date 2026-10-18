"use client";

// Port của LMS_Frontend/src/features/notifications/components/campaign-preview-modal.tsx (cùng DOM, class, style và chữ). View thuần.
interface CampaignPreviewModalProps {
  show: boolean;
  onClose: () => void;
  onSend: () => void;
  title: string;
  message: string;
  recipientCount: number;
  isSubmitting: boolean;
}

export function CampaignPreviewModal({ show, onClose, onSend, title, message, recipientCount, isSubmitting }: CampaignPreviewModalProps) {
  if (!show) return null;

  return (
    <div className="modal show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="campaign-preview-title" data-testid="campaign-preview-modal" style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-warning border-0">
            <h5 className="modal-title text-white fw-bold" id="campaign-preview-title">Xác nhận gửi thông báo</h5>
            <button type="button" className="btn-close btn-close-white" aria-label="Đóng" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4">
            <div className="alert alert-soft-danger border-0 d-flex align-items-start mb-4">
              <i className="isax isax-info-circle me-3 fs-20 mt-1"></i>
              <div>
                Bạn sắp gửi thông báo này tới <strong>{recipientCount}</strong> người dùng. Hành động này không thể hoàn tác.
              </div>
            </div>
            <div className="p-3 rounded-3 bg-light border border-dashed text-break">
              <h6 className="fw-bold text-dark mb-2">{title}</h6>
              <p className="mb-0 text-muted fs-14 lh-base">{message}</p>
            </div>
          </div>
          <div className="modal-footer border-0 p-3 pt-0">
            <button type="button" className="btn btn-light rounded-pill px-4" onClick={onClose}>
              Quay lại
            </button>
            <button type="button" className="btn btn-danger rounded-pill px-4" onClick={onSend} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Đang gửi...
                </>
              ) : (
                "Xác nhận & Gửi"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
