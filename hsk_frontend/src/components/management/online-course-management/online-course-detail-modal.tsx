"use client";

// Modal "Thông Tin Chi Tiết" của khoá học (react-bootstrap Modal cũ => antd Modal, cùng DOM `.onl-detail-overlay` bên trong để SCSS cũ áp dụng).
// Khác bản cũ có chủ đích: mô tả giáo trình render bằng React (tách tiêu đề con bằng splitSyllabusDescription) thay cho dangerouslySetInnerHTML;
// lỗi/chưa cấu hình hiện FetchStateNotice trong modal thay vì toast rồi đóng modal.
import { Modal } from "antd";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { AssetImage } from "@/components/shared/asset-image";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { COURSE_FALLBACK_THUMBNAIL, courseCode, courseName, courseThumbnail, formatPrice, splitSyllabusDescription } from "@/lib/online-course/online-course-model";
import type { OnlineCourseDetail } from "@/types/online-course";

export interface OnlineCourseDetailModalProps {
  open: boolean;
  state: FetchState<OnlineCourseDetail>;
  onClose: () => void;
  onRetry: () => void;
}

export function OnlineCourseDetailModal({ open, state, onClose, onRetry }: OnlineCourseDetailModalProps) {
  return (
    <Modal
      open={open}
      centered
      width={800}
      wrapClassName="onl-modal-custom"
      title={
        <span>
          <i className="isax isax-info-circle me-2 text-primary" /> Thông Tin Chi Tiết
        </span>
      }
      onCancel={onClose}
      footer={
        <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={onClose}>
          Đóng
        </button>
      }
    >
      <div className="onl-detail-overlay" data-testid="onl-detail">
        {state.kind === "loading" ? (
          <div className="text-center py-5">
            <span className="spinner-grow text-primary" role="status" />
            <p className="mt-2 text-muted">Đang truy xuất dữ liệu...</p>
          </div>
        ) : state.kind === "ok" ? (
          <DetailBody detail={state.data} />
        ) : (
          <FetchStateNotice state={state} waitingText="Chi tiết khóa học chưa được kết nối API (WAITING FOR BACKEND)." onRetry={onRetry} testId="onl-detail-notice" />
        )}
      </div>
    </Modal>
  );
}

function DetailBody({ detail }: { detail: OnlineCourseDetail }) {
  const thumb = courseThumbnail(detail);
  const segments = detail.syllabus_description ? splitSyllabusDescription(detail.syllabus_description) : [];
  return (
    <div>
      <div className="d-flex align-items-center mb-4 gap-4">
        <AssetImage
          src={thumb || COURSE_FALLBACK_THUMBNAIL}
          alt={courseName(detail)}
          className={`rounded-4 shadow-sm ${thumb ? "" : "is-fallback"}`}
          style={{ width: 160, height: 100, objectFit: thumb ? "cover" : "contain", background: thumb ? "transparent" : "#f1f5f9", padding: thumb ? 0 : 5 }}
        />
        <div>
          <h4 className="fw-bold text-dark mb-1">{courseName(detail)}</h4>
          <div className="d-flex gap-3 text-muted small mt-2">
            <span>
              <i className="isax isax-barcode me-1" /> {courseCode(detail) || "-"}
            </span>
            <span>
              <i className="isax isax-user me-1" /> Syllabus: {detail.syllabusId || "-"}
            </span>
            <span className={detail.cmsSynced ? "text-success" : "text-warning"}>
              <i className="isax isax-refresh me-1" /> {detail.cmsSynced ? "Đã đồng bộ" : "Nội bộ"}
            </span>
          </div>
        </div>
      </div>

      <div className="section-title">Tổng quan khóa học</div>
      <div className="detail-info-grid">
        <div className="info-item">
          <span className="label">Loại hình học</span>
          <span className="value">{detail.courseType || "Chưa xác định"}</span>
        </div>
        <div className="info-item">
          <span className="label">Trình độ mục tiêu</span>
          <span className="value">{detail.level || "Tự do"}</span>
        </div>
        <div className="info-item">
          <span className="label">Tổng số bài học</span>
          <span className="value">{detail.totalLessons || 0} bài</span>
        </div>
        <div className="info-item">
          <span className="label">Học phí công bố</span>
          <span className="value text-danger">{formatPrice(detail.price)}</span>
        </div>
      </div>

      <div className="section-title">Thông tin Syllabus</div>
      {segments.length > 0 ? (
        <div className="p-4 bg-light rounded-4 text-dark shadow-sm lh-lg" style={{ whiteSpace: "pre-wrap", fontSize: 14 }} data-testid="onl-syllabus-description">
          {segments.map((segment, index) =>
            segment.kind === "heading" ? (
              <strong key={index} className="text-primary mt-2 d-inline-block">
                {segment.value}
              </strong>
            ) : (
              <span key={index}>{segment.value}</span>
            ),
          )}
        </div>
      ) : (
        <div className="text-center p-4 bg-light rounded-4 text-muted fst-italic">
          <i className="isax isax-info-circle me-2" /> Dữ liệu Syllabus chưa được tích hợp đầy đủ.
        </div>
      )}
    </div>
  );
}
