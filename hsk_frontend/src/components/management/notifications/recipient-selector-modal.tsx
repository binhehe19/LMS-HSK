"use client";

// Port của LMS_Frontend/src/features/notifications/components/recipient-selector-modal.tsx (cùng DOM, class, style và chữ).
// Dữ liệu và thao tác qua hook use-recipient-selector.ts (chỉ ĐỌC danh sách người dùng).
//
// Khác bản cũ có chủ đích: (1) dịch vụ chưa cấu hình (WAITING FOR BACKEND) / gọi lỗi => dòng thông báo trong bảng (kèm "Thử lại" khi lỗi) thay vì
// "Không tìm thấy người dùng"; (2) "Chọn tất cả …" báo lỗi nếu máy chủ chỉ trả một phần; (3) thêm role/aria cho hộp thoại.
import { useRecipientSelector } from "@/components/management/notifications/use-recipient-selector";
import { RECIPIENT_ROLE_OPTIONS, recipientName, selectAllLabel, stripRolePrefix, type RecipientMap } from "@/lib/notifications/recipient-selection";
import type { AdminUser } from "@/types/admin-user";

interface RecipientSelectorModalProps {
  show: boolean;
  onClose: () => void;
  selected: RecipientMap;
  onToggleUser: (userId: string, userName?: string) => void;
  onAddMany: (users: AdminUser[]) => void;
}

export function RecipientSelectorModal({ show, onClose, selected, onToggleUser, onAddMany }: RecipientSelectorModalProps) {
  const sel = useRecipientSelector(show, onAddMany);
  if (!show) return null;

  const isLoading = sel.state.kind === "loading";
  const { users } = sel;

  return (
    <div className="modal show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="recipient-selector-title" data-testid="recipient-selector-modal" style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-white border-bottom">
            <h5 className="modal-title fw-bold" id="recipient-selector-title">Chọn người dùng nhận thông báo</h5>
            <button type="button" className="btn-close" aria-label="Đóng" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4">
            <form className="row g-2 mb-4" onSubmit={sel.submitSearch}>
              <div className="col-md-5">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-light border-0">
                    <i className="isax isax-search-normal"></i>
                  </span>
                  <input type="text" className="form-control border-0 bg-light" placeholder="Tìm theo tên, email..." value={sel.searchInput} onChange={(e) => sel.setSearchInput(e.target.value)} />
                </div>
              </div>
              <div className="col-md-4">
                <select className="form-select form-select-sm border-0 bg-light shadow-none" aria-label="Lọc theo vai trò" value={sel.roleFilter} onChange={(e) => sel.changeRole(e.target.value)}>
                  {RECIPIENT_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <button type="submit" className="btn btn-primary btn-sm w-100 rounded-pill">
                  Tìm kiếm
                </button>
              </div>
            </form>

            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="text-muted fs-14">
                Đã chọn: <strong className="text-primary">{selected.size}</strong> người
              </span>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success border-0 bg-success bg-opacity-10 text-success rounded-pill px-3"
                  onClick={() => onAddMany(users)}
                  disabled={users.length === 0}
                >
                  Chọn tất cả trang này
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-success rounded-pill px-3"
                  onClick={sel.selectAllMatching}
                  disabled={sel.isSelectingAll || (users.length === 0 && sel.searchInput === "" && sel.roleFilter === "")}
                >
                  {sel.isSelectingAll ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1"></span>
                      Đang chọn...
                    </>
                  ) : (
                    selectAllLabel(sel.roleFilter)
                  )}
                </button>
              </div>
            </div>

            <div className="table-responsive border rounded-3 overflow-hidden">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="text-center">#</th>
                    <th>Họ tên</th>
                    <th>Email / Vai trò</th>
                    <th className="text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="text-center py-5">
                        <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                        Đang tải...
                      </td>
                    </tr>
                  ) : sel.state.kind === "waiting" || sel.state.kind === "error" ? (
                    <tr>
                      <td colSpan={4} className="p-3">
                        <div className="alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2 mb-0" role="status" data-testid="recipient-data-notice" data-kind={sel.state.kind}>
                          <span>
                            {sel.state.kind === "error"
                              ? sel.state.message
                              : "Danh sách người dùng chưa được kết nối API (WAITING FOR BACKEND). Chưa thể chọn người nhận."}
                          </span>
                          {sel.state.kind === "error" && (
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={sel.reload}>
                              Thử lại
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-5 text-muted">
                        Không tìm thấy người dùng
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      const isSelected = selected.has(user.id);
                      const name = recipientName(user);
                      return (
                        <tr key={user.id} className={isSelected ? "bg-light-primary" : ""} data-testid="recipient-row">
                          <td className="text-center">
                            <div className="form-check d-flex justify-content-center">
                              <input className="form-check-input" type="checkbox" checked={isSelected} readOnly aria-label={`Chọn ${name}`} onClick={() => onToggleUser(user.id, name)} />
                            </div>
                          </td>
                          <td>
                            <div className="fw-semibold">{user.fullName || "Chưa cập nhật"}</div>
                          </td>
                          <td>
                            <div className="fs-13">{user.email}</div>
                            <div className="mt-1">
                              {user.roles?.map((r) => (
                                <span key={r} className="badge bg-info bg-opacity-10 text-info border-0 me-1 py-1">
                                  {stripRolePrefix(r)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="text-center">
                            <button type="button" className={`btn btn-sm rounded-pill px-3 ${isSelected ? "btn-danger" : "btn-outline-primary"}`} onClick={() => onToggleUser(user.id, name)}>
                              {isSelected ? "Bỏ chọn" : "Chọn"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {sel.totalPages > 1 && (
              <div className="d-flex justify-content-between align-items-center mt-3 px-1">
                <button type="button" className="btn btn-sm btn-outline-secondary border-0" disabled={sel.page === 0} onClick={() => sel.goToPage(sel.page - 1)}>
                  <i className="isax isax-arrow-left-2 me-1"></i> Trang trước
                </button>
                <span className="text-muted fs-13">
                  Trang <strong>{sel.page + 1}</strong> / {sel.totalPages}
                </span>
                <button type="button" className="btn btn-sm btn-outline-secondary border-0" disabled={sel.page >= sel.totalPages - 1} onClick={() => sel.goToPage(sel.page + 1)}>
                  Trang sau <i className="isax isax-arrow-right-3 ms-1"></i>
                </button>
              </div>
            )}
          </div>
          <div className="modal-footer border-top p-3">
            <button type="button" className="btn btn-light rounded-pill px-4" onClick={onClose}>
              Hủy
            </button>
            <button type="button" className="btn btn-primary rounded-pill px-4" onClick={onClose}>
              Hoàn tất chọn ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
