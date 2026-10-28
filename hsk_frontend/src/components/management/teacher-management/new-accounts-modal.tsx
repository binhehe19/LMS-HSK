"use client";

// Modal "Tài khoản vừa tạo" (antd Modal, class `tm-created-accounts-*` của bản cũ): tài khoản tạo trong 24 giờ kèm kết quả gửi email,
// nút "Gửi lại email", "Đổi email & gửi lại" (sửa tại chỗ), sao chép email. Danh sách tải từ GET /recently-created mỗi lần mở và sau mỗi thao tác
// (`version` đổi) — bản cũ gộp mảng cục bộ với kết quả tải về nên có thể trùng/lệch với máy chủ.
import { Modal, Tag, Tooltip } from "antd";
import { useState } from "react";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { ApiError } from "@/lib/api/api-client";
import { fetchRecentlyCreatedTeachers } from "@/lib/api/teacher-management-client";
import type { TeacherUser } from "@/types/teacher-management";

export interface NewAccountsModalProps {
  open: boolean;
  /** Tăng để tải lại danh sách (sau tạo/import/gửi lại email). */
  version: number;
  writeEnabled: boolean;
  busy: boolean;
  onClose: () => void;
  onResend: (teacher: TeacherUser) => void;
  onChangeEmailAndResend: (teacher: TeacherUser, email: string) => Promise<boolean>;
}

export function NewAccountsModal({ open, version, writeEnabled, busy, onClose, onResend, onChangeEmailAndResend }: NewAccountsModalProps) {
  const { state, reload } = useKeyedFetch<TeacherUser[]>(open ? `recent#${version}` : null, async () => {
    const data = await fetchRecentlyCreatedTeachers();
    if (!Array.isArray(data)) throw new ApiError("Dữ liệu trả về không đúng định dạng danh sách tài khoản mới.", 200, "CONTRACT");
    return data;
  });
  const [editing, setEditing] = useState<{ id: string; email: string } | null>(null);
  const teachers = state.kind === "ok" ? state.data : [];
  const canWrite = writeEnabled && !busy;

  const confirmEmailChange = async (teacher: TeacherUser) => {
    if (!editing) return;
    if (await onChangeEmailAndResend(teacher, editing.email)) setEditing(null);
  };

  return (
    <Modal title={`Tài khoản vừa tạo (${teachers.length} mới)`} open={open} centered destroyOnClose wrapClassName="tm-modal tm-created-accounts-modal" onCancel={onClose} footer={null} width={680}>
      <div className="tm-created-accounts-list" data-testid="new-accounts-list">
        {state.kind === "loading" ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status" />
          </div>
        ) : state.kind === "waiting" || state.kind === "error" ? (
          <FetchStateNotice state={state} waitingText="Danh sách tài khoản mới chưa được kết nối API (WAITING FOR BACKEND)." onRetry={reload} testId="new-accounts-notice" />
        ) : teachers.length === 0 ? (
          <div className="text-center py-4">
            <p className="mb-2">Không có tài khoản mới trong 24 giờ.</p>
            <small className="text-muted">Các tài khoản cũ hơn 24 giờ sẽ không hiển thị ở đây.</small>
          </div>
        ) : (
          teachers.map((teacher) => {
            const name = teacher.fullName || teacher.email;
            const isEditing = editing?.id === teacher.id;
            return (
              <div key={teacher.id} className="tm-created-account-item" data-testid="new-account-item">
                <div className="tm-created-account-header">
                  <div className="tm-created-account-info">
                    <p className="tm-created-account-name">{name}</p>
                    <p className="tm-created-account-email">
                      {teacher.email}
                      <Tooltip title="Sao chép email">
                        <button type="button" className="tm-copy-email-btn" aria-label={`Sao chép email ${teacher.email}`} onClick={() => void navigator.clipboard?.writeText(teacher.email)}>
                          <i className="isax isax-copy" />
                        </button>
                      </Tooltip>
                    </p>
                    <div className="tm-created-account-status">
                      {teacher.emailStatus === "SUCCESS" ? (
                        <Tag color="green">✓ Email gửi thành công</Tag>
                      ) : teacher.emailStatus === "FAILED" ? (
                        <>
                          <span className="tm-email-failed-row">
                            <Tag color="red">✗ Gửi email thất bại</Tag>
                            {teacher.emailStatusReason && <span className="tm-email-failed-reason">{teacher.emailStatusReason}</span>}
                          </span>
                          {isEditing && (
                            <div className="tm-edit-email-row">
                              <input
                                type="email"
                                className="form-control form-control-sm tm-edit-email-input"
                                value={editing.email}
                                onChange={(event) => setEditing({ id: teacher.id, email: event.target.value })}
                                placeholder="Nhập email mới"
                                aria-label={`Email mới cho ${name}`}
                                disabled={busy}
                              />
                              <button type="button" className="btn btn-sm btn-primary" onClick={() => void confirmEmailChange(teacher)} disabled={!canWrite}>
                                Xác nhận
                              </button>
                              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditing(null)} disabled={busy}>
                                Hủy
                              </button>
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="tm-created-account-actions">
                  <button type="button" className="btn btn-danger" onClick={() => onResend(teacher)} disabled={!canWrite} aria-label={`Gửi lại email cho ${name}`}>
                    Gửi lại email
                  </button>
                  {teacher.emailStatus === "FAILED" && !isEditing && (
                    <button type="button" className="btn btn-outline-primary" onClick={() => setEditing({ id: teacher.id, email: teacher.email })} disabled={!canWrite} aria-label={`Đổi email và gửi lại cho ${name}`}>
                      Đổi email & gửi lại
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}
