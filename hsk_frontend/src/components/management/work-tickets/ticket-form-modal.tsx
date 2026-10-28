"use client";

// Modal "Tạo Phân công Quyền hạn" / "Chỉnh sửa Phân công" của teacher-manager-tickets.tsx (HSK cũ): ba cột — chọn người (tìm tên/email, chip vai trò),
// chọn module, ghi chú — và chân modal tóm tắt lựa chọn. Khác bản cũ có chủ đích: modal Bootstrap (data-bs-toggle, bấm .btn-close để đóng) => antd
// Modal có state (destroyOnClose để ô tìm/chip vai trò về mặc định mỗi lần mở); danh sách người được giao đang tải/chưa cấu hình/lỗi hiện rõ trong
// cột 1 (bản cũ nuốt lỗi thành danh sách rỗng); các ô chọn có role="button" + aria-pressed.
import { Modal } from "antd";
import { useState } from "react";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import {
  ASSIGNEE_ROLE_FILTERS,
  TICKET_MODULE_OPTIONS,
  assigneeRoleLabel,
  filterAssignees,
  toggleSelection,
  type AssigneeRoleFilter,
  type TicketFormMode,
  type TicketFormState,
} from "@/lib/work-tickets/ticket-model";
import type { TicketAssigneeOptionResponse, TicketModule } from "@/types/ticket";

interface TicketFormModalProps {
  /** null = đóng. */
  mode: TicketFormMode | null;
  /** Giá trị ban đầu của lần mở này (container đổi `key` mỗi lần mở để form được tạo lại từ giá trị mới). */
  initial: TicketFormState;
  assignees: FetchState<TicketAssigneeOptionResponse[]>;
  onRetryAssignees: () => void;
  submitting: boolean;
  writeEnabled: boolean;
  onSubmit: (form: TicketFormState) => void;
  onCancel: () => void;
}

interface TicketFormBodyProps extends Omit<TicketFormModalProps, "mode" | "initial" | "onSubmit"> {
  mode: TicketFormMode;
  form: TicketFormState;
  onFormChange: (next: TicketFormState) => void;
  onSubmit: () => void;
}

/** Form sống TRONG modal (không ở container) để mỗi phím gõ không vẽ lại cả bảng ticket phía sau. */
export function TicketFormModal({ mode, initial, onSubmit, ...body }: TicketFormModalProps) {
  const [form, setForm] = useState<TicketFormState>(initial);
  return (
    <Modal open={mode !== null} footer={null} closable={false} centered width={1140} destroyOnClose maskClosable={!body.submitting} onCancel={body.onCancel} className="ticket-form-modal" styles={{ body: { padding: 0 } }}>
      {mode && <TicketFormBody mode={mode} form={form} onFormChange={setForm} onSubmit={() => onSubmit(form)} {...body} />}
    </Modal>
  );
}

function TicketFormBody({ mode, form, onFormChange, assignees, onRetryAssignees, submitting, writeEnabled, onSubmit, onCancel }: TicketFormBodyProps) {
  const isEdit = mode === "edit";
  const [searchUserQuery, setSearchUserQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AssigneeRoleFilter>("ALL");
  const assigneeList = assignees.kind === "ok" ? filterAssignees(assignees.data, searchUserQuery, roleFilter) : [];
  const canSubmit = !submitting && writeEnabled && form.assignedIds.length > 0 && form.modules.length > 0;

  const toggleAssignee = (id: string) => onFormChange({ ...form, assignedIds: toggleSelection(form.assignedIds, id, isEdit) });
  const toggleModule = (module: TicketModule) => onFormChange({ ...form, modules: toggleSelection(form.modules, module, isEdit) });

  return (
    <div className="modal-content border-0 rounded-4 overflow-hidden" data-testid="ticket-form-modal" data-mode={mode}>
      <div className="modal-header bg-primary text-white py-3 px-4 border-0 d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center">
          <div className="bg-white rounded-circle p-2 me-3 d-flex align-items-center justify-content-center" style={{ width: "36px", height: "36px" }}>
            <i className={`isax ${isEdit ? "isax-edit-2" : "isax-add-circle"} text-primary fs-18`} />
          </div>
          <div>
            <h5 className="modal-title fw-bold mb-0 text-white">{isEdit ? "Chỉnh sửa Phân công" : "Tạo Phân công Quyền hạn"}</h5>
            <span className="fs-11 text-white opacity-75">{isEdit ? "Cập nhật thông tin phân bổ module" : "Phân bổ module mới cho giảng viên/CTV"}</span>
          </div>
        </div>
        <button type="button" className="btn-close btn-close-white" aria-label="Đóng" disabled={submitting} onClick={onCancel} />
      </div>

      <div className="modal-body p-0">
        <div className="row g-0">
          {/* Cột 1: người được cấp quyền */}
          <div className="col-lg-4 border-end bg-light-gray-1">
            <div className="p-3" style={{ height: "420px" }}>
              <div className="mb-3">
                <label className="form-label fw-bold small text-uppercase text-gray-7 d-flex justify-content-between mb-2" htmlFor="ticket-assignee-search">
                  <span>
                    1. Người được cấp quyền <span className="text-danger">*</span>
                  </span>
                </label>
                <div className="input-group shadow-sm rounded-pill overflow-hidden bg-white border">
                  <span className="input-group-text bg-white border-0 ps-2">
                    <i className="isax isax-search-normal-1 text-primary fs-14" />
                  </span>
                  <input id="ticket-assignee-search" type="text" className="form-control border-0 py-1 fs-13" placeholder="Tìm tên/email..." value={searchUserQuery} onChange={(e) => setSearchUserQuery(e.target.value)} />
                </div>
              </div>

              <div className="mb-3 d-flex flex-wrap gap-1" role="group" aria-label="Lọc theo vai trò">
                {ASSIGNEE_ROLE_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`btn btn-xs rounded-pill px-2 py-1 fs-10 fw-600 transition-all ${roleFilter === f.id ? "btn-primary text-white shadow-sm" : "btn-light text-gray-6 border"}`}
                    aria-pressed={roleFilter === f.id}
                    onClick={() => setRoleFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="assignee-list custom-scrollbar" style={{ maxHeight: "260px", overflowY: "auto" }} data-testid="assignee-list">
                {assignees.kind === "loading" && (
                  <div className="text-center py-3">
                    <span className="spinner-border spinner-border-sm text-primary" /> <span className="fs-12 text-muted">Đang tải...</span>
                  </div>
                )}
                <FetchStateNotice state={assignees} waitingText="Danh sách người được giao chưa được kết nối API (WAITING FOR BACKEND)." onRetry={onRetryAssignees} testId="assignee-notice" className="fs-12" />
                {assignees.kind === "ok" && assigneeList.length === 0 && <div className="text-center text-muted fs-12 py-3">Không có người dùng phù hợp</div>}
                <div className="row g-2 pe-1">
                  {assigneeList.map((user) => {
                    const isSelected = form.assignedIds.includes(user.id);
                    return (
                      <div key={user.id} className="col-12">
                        <div
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                          aria-label={`Chọn ${user.fullName}`}
                          className={`user-select-card p-2 rounded-3 border-2 transition-all cursor-pointer d-flex align-items-center ${isSelected ? "border-primary bg-soft-primary" : "border-transparent bg-white shadow-sm"}`}
                          onClick={() => toggleAssignee(user.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleAssignee(user.id);
                            }
                          }}
                        >
                          <div className="avatar me-2 position-relative">
                            <span className={`avatar avatar-sm rounded-circle fw-bold d-flex align-items-center justify-content-center ${isSelected ? "bg-primary text-white" : "bg-soft-primary text-primary"}`} style={{ width: "28px", height: "28px", fontSize: "12px" }}>
                              {user.fullName?.charAt(0) || "U"}
                            </span>
                            {isSelected && (
                              <span className="position-absolute bottom-0 end-0 bg-success rounded-circle border border-white" style={{ width: "10px", height: "10px", marginBottom: "-1px", marginRight: "-1px" }}>
                                <i className="fa-solid fa-check text-white" style={{ fontSize: "6px", display: "block", textAlign: "center", lineHeight: "10px" }} />
                              </span>
                            )}
                          </div>
                          <div className="flex-grow-1 min-width-0">
                            <h6 className={`mb-0 fw-bold fs-12 text-truncate ${isSelected ? "text-primary" : "text-gray-9"}`}>{user.fullName}</h6>
                            <span className="text-gray-6 fs-10 d-block text-truncate" style={{ marginTop: "-2px" }}>
                              {user.email}
                            </span>
                          </div>
                          <div className="ms-2">
                            {(user.roles ?? []).map((r) => (
                              <span key={r} className="badge bg-light text-gray-6 fs-9 fw-normal ms-1">
                                {assigneeRoleLabel(r)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Cột 2: module nghiệp vụ */}
          <div className="col-lg-4 border-end">
            <div className="p-3" style={{ height: "420px" }}>
              <div className="form-label fw-bold small text-uppercase text-gray-7 mb-3" id="ticket-module-label">
                2. Module nghiệp vụ <span className="text-danger">*</span>
              </div>
              <div className="module-selector-grid custom-scrollbar" style={{ maxHeight: "350px", overflowY: "auto" }} role="group" aria-labelledby="ticket-module-label">
                <div className="row g-2 pe-1">
                  {TICKET_MODULE_OPTIONS.map((opt) => {
                    const isSelected = form.modules.includes(opt.value);
                    return (
                      <div key={opt.value} className="col-12">
                        <div
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                          aria-label={`Module ${opt.label}`}
                          className={`module-opt-card p-2 rounded-3 border transition-all cursor-pointer d-flex align-items-center ${isSelected ? "border-primary bg-soft-primary" : "border-gray-2 bg-white"}`}
                          onClick={() => toggleModule(opt.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleModule(opt.value);
                            }
                          }}
                        >
                          <div className={`icon-xs rounded-circle me-2 d-flex align-items-center justify-content-center ${isSelected ? "bg-primary text-white" : "bg-light text-primary"}`} style={{ width: "24px", height: "24px" }}>
                            <i className={isSelected ? "fa-solid fa-check" : "isax isax-box-1"} style={{ fontSize: isSelected ? "10px" : "12px" }} />
                          </div>
                          <span className={`fs-12 fw-semibold ${isSelected ? "text-primary" : "text-gray-7"}`}>{opt.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Cột 3: ghi chú */}
          <div className="col-lg-4">
            <div className="p-3 d-flex flex-column" style={{ height: "420px" }}>
              <div className="mb-3">
                <label className="form-label fw-bold small text-uppercase text-gray-7 mb-2" htmlFor="ticket-description">
                  3. Ghi chú công việc
                </label>
                <textarea
                  id="ticket-description"
                  className="form-control rounded-3 fs-13 flex-grow-1"
                  rows={6}
                  placeholder="Nhập yêu cầu chi tiết..."
                  value={form.description}
                  onChange={(e) => onFormChange({ ...form, description: e.target.value })}
                  style={{ resize: "none", background: "#fcfcfc", minHeight: "180px" }}
                />
              </div>
              <div className="bg-soft-warning p-3 rounded-3 fs-11 text-gray-9 border border-warning border-opacity-25 mt-auto">
                <div className="d-flex">
                  <i className="isax isax-info-circle me-2 text-warning fs-16" />
                  <span>
                    <strong>Lưu ý:</strong> Giảng viên/CTV sẽ thấy tên module xuất hiện trong danh sách công việc ngay khi được phân công.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="modal-footer bg-white p-3 border-top">
        <div className="d-flex justify-content-between w-100 align-items-center">
          <div className="text-muted fs-12">
            {form.assignedIds.length > 0 ? (
              <span className="text-success fw-600">
                <i className="isax isax-user-tick me-1" />
                Đã chọn {form.assignedIds.length} người &amp; {form.modules.length} module
              </span>
            ) : (
              <span className="text-danger">
                <i className="isax isax-info-circle me-1" /> Chưa chọn thông tin
              </span>
            )}
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary rounded-pill px-3 fs-13 fw-600" disabled={submitting} onClick={onCancel}>
              Hủy
            </button>
            <button type="button" className="btn btn-primary rounded-pill px-4 fs-13 shadow-sm fw-bold" disabled={!canSubmit} onClick={onSubmit}>
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Đang lưu...
                </>
              ) : isEdit ? (
                "Lưu thay đổi"
              ) : (
                "Xác nhận & Cấp quyền"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
