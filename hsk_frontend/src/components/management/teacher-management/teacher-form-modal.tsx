"use client";

// Modal "Tạo giảng viên mới" / "Cập nhật giảng viên" (hai antd Modal gần giống nhau của bản cũ gộp thành một component, cùng DOM/class `tm-*`).
// Không gọi API: `onSubmit(values)` do container xử lý. Giá trị khởi tạo lấy một lần lúc mount (container remount bằng `key` mỗi lần mở).
//
// Khác bản cũ có chủ đích: ảnh đại diện và video giới thiệu nhập bằng URL (có xem trước) thay cho nút chọn file tạo `blob:` URL — bản cũ gửi
// `blob:` URL (chỉ sống trong tab đang mở) lên máy chủ như địa chỉ ảnh/video, không dùng được; hợp đồng và file mẫu import đều là URL.
import { Modal } from "antd";
import { useState } from "react";
import { AssetImage } from "@/components/shared/asset-image";
import { TEACHER_FIELD_LIMITS, isValidEmail, validateTeacherForm, type TeacherFormMode, type TeacherFormValues } from "@/lib/teacher-management/teacher-form";

export interface TeacherFormModalProps {
  mode: TeacherFormMode;
  initialValues: TeacherFormValues;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: TeacherFormValues) => void;
}

export function TeacherFormModal({ mode, initialValues, submitting, onCancel, onSubmit }: TeacherFormModalProps) {
  const [values, setValues] = useState<TeacherFormValues>(initialValues);
  const set = (field: keyof TeacherFormValues) => (event: { target: { value: string } }) => setValues((prev) => ({ ...prev, [field]: event.target.value }));
  const id = (field: string) => `tm-${mode}-${field}`;

  const emailValid = isValidEmail(values.email);
  const nameValid = Boolean(values.fullName.trim());
  const formValid = validateTeacherForm(values, mode) === null;
  const isCreate = mode === "create";

  return (
    <Modal
      title={isCreate ? "Tạo giảng viên mới" : "Cập nhật giảng viên"}
      open
      centered
      wrapClassName="tm-modal"
      width={640}
      onCancel={onCancel}
      onOk={() => onSubmit(values)}
      okText={isCreate ? (submitting ? "Đang tạo..." : "Tạo giảng viên") : submitting ? "Đang cập nhật..." : "Lưu thay đổi"}
      cancelText="Hủy"
      okButtonProps={{ disabled: submitting || !formValid }}
      confirmLoading={submitting}
    >
      <div className="tm-form-grid" data-testid="teacher-form">
        <label htmlFor={id("email")}>
          Email <span className="text-danger">*</span>
        </label>
        <input
          id={id("email")}
          type="email"
          className={`form-control ${values.email && !emailValid ? "is-invalid" : ""}`}
          value={values.email}
          onChange={set("email")}
          placeholder="teacher@example.com"
          disabled={!isCreate}
        />

        {isCreate && (
          <div className="tm-auto-password-notice">
            <div style={{ background: "#fff7e6", border: "1px solid #ffd591", padding: "12px 16px", borderRadius: "8px", marginBottom: "12px" }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                <i className="isax isax-info-circle me-2" />
                Mật khẩu sẽ được tạo tự động
              </p>
              <small style={{ color: "#8c6d1f" }}>Hệ thống sẽ tự tạo mật khẩu ngẫu nhiên gồm chữ hoa, chữ thường và số, sau đó gửi về email của giảng viên.</small>
            </div>
          </div>
        )}

        <label htmlFor={id("fullName")}>
          Họ và tên <span className="text-danger">*</span>
        </label>
        <input id={id("fullName")} type="text" className="form-control" value={values.fullName} onChange={set("fullName")} placeholder="Nguyen Van A" />

        <div className="tm-validation-card">
          <p>Kiểm tra dữ liệu:</p>
          <ul>
            <li className={emailValid ? "ok" : "bad"}>{emailValid ? "✓" : "•"} Email đúng định dạng</li>
            <li className={nameValid ? "ok" : "bad"}>{nameValid ? "✓" : "•"} Họ và tên không để trống</li>
            {isCreate && <li className="ok">✓ Mật khẩu sẽ được tạo tự động và gửi qua email</li>}
          </ul>
        </div>

        <div className="tm-optional-section">
          <p className="tm-optional-title">
            Thông tin bổ sung <span className="tm-optional-badge">Tùy chọn</span>
          </p>
          {isCreate && <p className="tm-optional-desc">Các trường sau không bắt buộc, có thể bổ sung sau khi tạo tài khoản.</p>}

          <div className="tm-field-group">
            <label htmlFor={id("avatarUrl")}>Ảnh đại diện</label>
            <div className="tm-avatar-picker">
              {values.avatarUrl.trim() && <AssetImage src={values.avatarUrl.trim()} alt="preview" className="tm-avatar-preview" />}
              <input id={id("avatarUrl")} type="url" className="form-control" value={values.avatarUrl} onChange={set("avatarUrl")} placeholder="https://example.com/avatar.jpg" />
              <small className="text-muted d-block mt-1">URL ảnh PNG hoặc JPG đã tải lên kho lưu trữ.</small>
            </div>
          </div>

          <div className="tm-field-group">
            <label htmlFor={id("shortDescription")}>
              Mô tả ngắn <span className="tm-char-hint">(tối đa {TEACHER_FIELD_LIMITS.shortDescription} ký tự)</span>
            </label>
            <textarea
              id={id("shortDescription")}
              className="form-control"
              rows={2}
              maxLength={TEACHER_FIELD_LIMITS.shortDescription}
              value={values.shortDescription}
              onChange={set("shortDescription")}
              placeholder={isCreate ? "Giới thiệu ngắn gọn về giảng viên, hiển thị trên trang danh sách." : "Giới thiệu ngắn gọn về giảng viên..."}
            />
            <small className="text-muted d-block">
              {values.shortDescription.length}/{TEACHER_FIELD_LIMITS.shortDescription} ký tự
            </small>
          </div>

          <div className="tm-field-group">
            <label htmlFor={id("fullDescription")}>
              Mô tả chi tiết <span className="tm-char-hint">(tối đa {TEACHER_FIELD_LIMITS.fullDescription} ký tự)</span>
            </label>
            <textarea id={id("fullDescription")} className="form-control" rows={4} maxLength={TEACHER_FIELD_LIMITS.fullDescription} value={values.fullDescription} onChange={set("fullDescription")} placeholder="Kinh nghiệm, thành tích, lĩnh vực chuyên môn..." />
            <small className="text-muted d-block">
              {values.fullDescription.length}/{TEACHER_FIELD_LIMITS.fullDescription} ký tự
            </small>
          </div>

          <div className="tm-field-group">
            <label htmlFor={id("teachingStyle")}>
              Phong cách giảng dạy <span className="tm-char-hint">(tối đa {TEACHER_FIELD_LIMITS.teachingStyle} ký tự)</span>
            </label>
            <input
              id={id("teachingStyle")}
              type="text"
              className="form-control"
              maxLength={TEACHER_FIELD_LIMITS.teachingStyle}
              value={values.teachingStyle}
              onChange={set("teachingStyle")}
              placeholder={isCreate ? "VD: Tương tác, thực hành, lý thuyết kết hợp thực tiễn..." : "VD: Tương tác, thực hành..."}
            />
          </div>

          <div className="tm-field-group">
            <label htmlFor={id("qualification")}>
              Bằng cấp / Chứng chỉ <span className="tm-char-hint">(tối đa {TEACHER_FIELD_LIMITS.qualification} ký tự)</span>
            </label>
            <input
              id={id("qualification")}
              type="text"
              className="form-control"
              maxLength={TEACHER_FIELD_LIMITS.qualification}
              value={values.qualification}
              onChange={set("qualification")}
              placeholder={isCreate ? "VD: Thạc sĩ CNTT - ĐH Bách Khoa, Chứng chỉ JLPT N1..." : "VD: Thạc sĩ CNTT, JLPT N1..."}
            />
          </div>

          <div className="tm-field-group">
            <label htmlFor={id("videoIntroLink")}>Video giới thiệu</label>
            <div className="tm-video-picker">
              <input id={id("videoIntroLink")} type="url" className="form-control" value={values.videoIntroLink} onChange={set("videoIntroLink")} placeholder="https://youtube.com/watch?v=..." />
              {values.videoIntroLink.trim() ? (
                <small className="text-muted d-block mt-1">
                  <i className="isax isax-document me-1" />
                  <a href={values.videoIntroLink.trim()} target="_blank" rel="noreferrer noopener">
                    Mở video giới thiệu
                  </a>
                </small>
              ) : (
                <small className="text-muted d-block mt-1">URL video giới thiệu của giảng viên (YouTube hoặc file MP4/WebM đã tải lên).</small>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
