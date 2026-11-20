"use client";

import { FetchErrorNotice } from "@/components/shared/fetch-state-notice";

// Giao diện thuần của màn /admin/class-management: nhận state qua props, không gọi API (dữ liệu do
// class-management-page-content + use-admin-classes cung cấp). Port từ LMS_Frontend admin-class-management-page.tsx,
// giữ nguyên bố cục, class CSS (class-management.css, nạp qua styles/page-styles.ts) và hành vi lọc/phân trang.
import React, { useMemo, useState } from "react";
import { Pagination, Spin } from "antd";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { ClassListState } from "@/components/management/class-management/use-admin-classes";
import {
  STATUS_CONFIG,
  computeLateDays,
  computeShift,
  computeStatus,
  display,
  fmtDate,
} from "@/lib/class-management/class-display";
import type { GradingClassResponse } from "@/types/grading";

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { color: "#6c757d", bg: "#f0f0f0" };
  return (
    <span className="acm-status-badge" style={{ color: cfg.color, background: cfg.bg }}>
      {status}
    </span>
  );
};

const PAGE_SIZE = 10;

interface ClassManagementViewProps {
  state: ClassListState;
  onRetry?: () => void;
  onOpenClass: (cls: GradingClassResponse) => void;
}

export function ClassManagementView({ state, onRetry, onOpenClass }: ClassManagementViewProps) {
  const classes = useMemo(() => (state.kind === "ok" ? state.classes : []), [state]);
  const loading = state.kind === "loading";
  const ready = state.kind === "ok";
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const goToStudents = onOpenClass;

  const filtered = useMemo(() => {
    let list = classes;
    if (statusFilter !== "all") {
      list = list.filter(
        (c) => computeStatus(c.startDate, c.endDate, c.actualEndDate) === statusFilter
      );
    }
    const k = keyword.trim().toLowerCase();
    if (k) {
      list = list.filter(
        (c) =>
          (c.classCode || "").toLowerCase().includes(k) ||
          (c.courseName || "").toLowerCase().includes(k) ||
          (c.teacherName || "").toLowerCase().includes(k)
      );
    }
    return list;
  }, [classes, keyword, statusFilter]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const totalClasses  = classes.length;
  const activeClasses = classes.filter((c) => computeStatus(c.startDate, c.endDate, c.actualEndDate) === "Đang học").length;
  const endedClasses  = classes.filter((c) => computeStatus(c.startDate, c.endDate, c.actualEndDate) === "Đã kết thúc").length;
  const totalStudents = classes.reduce((s, c) => s + (c.studentCount ?? 0), 0);

  return (
    <ManagementPageFrame contentClassName="acm-page-bg">

            {/* ─── Hero banner ─── */}
            <div className="acm-hero mb-3">
              <div className="acm-hero-content">
                <span className="acm-hero-badge">Admin · Chỉ xem</span>
                <h2 className="acm-hero-title">Quản lý lớp học</h2>
                <p className="acm-hero-sub">Theo dõi tiến độ, chuyên cần và chất lượng toàn bộ lớp học</p>
              </div>
              <i className="isax isax-teacher acm-hero-icon" />
            </div>

            {/* ─── Stat cards ─── */}
            <div className="row g-3 mb-3">
              {[
                { label: "Tổng lớp",      value: totalClasses,  icon: "isax-teacher",      color: "#B00D0E" },
                { label: "Đang học",       value: activeClasses, icon: "isax-people",        color: "#0d6efd" },
                { label: "Đã kết thúc",   value: endedClasses,  icon: "isax-tick-circle",   color: "#198754" },
                { label: "Tổng học viên", value: totalStudents, icon: "isax-profile-2user", color: "#fd7e14" },
              ].map((s) => (
                <div className="col-6 col-md-3" key={s.label}>
                  <div className="acm-stat-card">
                    <div className="acm-stat-icon" style={{ background: s.color + "18", color: s.color }}>
                      <i className={`isax ${s.icon}`} />
                    </div>
                    <div>
                      <div className="acm-stat-value">{loading || ready ? s.value : "—"}</div>
                      <div className="acm-stat-label">{s.label}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ─── Filter bar ─── */}
            <div className="card acm-filter-card mb-3">
              <div className="card-body py-3">
                <div className="row g-3 align-items-end">
                  <div className="col-md-5">
                    <label className="form-label fw-bold mb-1" style={{ color: "#B00D0E" }}>Tìm kiếm</label>
                    <div className="input-group">
                      <span className="input-group-text bg-white" style={{ borderColor: "#e0c8cc" }}>
                        <i className="isax isax-search-normal text-muted" />
                      </span>
                      <input
                        className="form-control border-start-0"
                        style={{ borderColor: "#e0c8cc" }}
                        placeholder="Mã lớp, khóa học, giáo viên..."
                        value={keyword}
                        onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                      />
                    </div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold mb-1" style={{ color: "#B00D0E" }}>Trạng thái</label>
                    <select
                      className="form-select"
                      style={{ borderColor: "#e0c8cc" }}
                      value={statusFilter}
                      onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="Đang học">Đang học</option>
                      <option value="Sắp khai giảng">Sắp khai giảng</option>
                      <option value="Đã kết thúc">Đã kết thúc</option>
                    </select>
                  </div>
                  <div className="col-md-3">
                    <button className="btn acm-btn-export w-100">
                      <i className="isax isax-export me-1" />
                      Xuất Excel
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Class table ─── */}
            <div className="card acm-table-card">
              <div
                className="d-flex align-items-center justify-content-between"
                style={{
                  background: "linear-gradient(125deg, #B00D0E 0%, #860707 100%)",
                  borderRadius: "16px 16px 0 0",
                  padding: "14px 18px",
                  color: "#fff",
                }}
              >
                <span className="fw-bold">Danh sách lớp học ({filtered.length})</span>
                <small style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>
                  Chỉ xem — Admin không có quyền chỉnh sửa
                </small>
              </div>
              <div className="card-body p-0">
                {loading ? (
                  <div className="text-center py-5"><Spin size="large" /></div>
                ) : state.kind === "error" ? (
                    <FetchErrorNotice title="Không thể tải danh sách lớp học" description={state.message} onRetry={onRetry} testId="acm-state-error" />
                  ) : !ready ? (
                  <div className="text-center text-muted py-5" role="status" data-testid={`acm-state-${state.kind}`}>
                    <i
                      className="isax isax-link-21 d-block mb-2"
                      style={{ fontSize: 32 }}
                    />
                    <div className="fw-semibold mb-1">
                      Chưa kết nối dữ liệu
                    </div>
                    <div className="small mb-3">{state.message}</div>
                  </div>
                ) : (
                  <div className="table-responsive acm-scroll-x">
                    <table className="acm-table table align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="acm-col-stt">STT</th>
                          <th className="acm-col-code">Mã lớp</th>
                          <th>Khóa học</th>
                          <th>Họ tên GV</th>
                          <th>Trợ giảng</th>
                          <th>Lương GV/h</th>
                          <th>Lịch học</th>
                          <th>Ca học</th>
                          <th>Ngày khai giảng</th>
                          <th>Ngày KT dự kiến</th>
                          <th>Ngày KT thực tế</th>
                          <th className="text-center">Số ngày trễ</th>
                          <th className="text-center">Số HV</th>
                          <th className="text-center">Số giờ học</th>
                          <th className="text-center">Số buổi khoá</th>
                          <th className="text-center">Buổi GV điểm danh</th>
                          <th className="text-center">Buổi còn lại</th>
                          <th className="text-center">Trạng thái</th>
                          <th className="text-center">Chuyên cần</th>
                          <th className="text-center">CC BTVN</th>
                          <th className="text-center">Điểm QC</th>
                          <th>Link QC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paged.map((cls, i) => {
                          const status   = computeStatus(cls.startDate, cls.endDate, cls.actualEndDate);
                          const shift    = computeShift(cls.startTime, cls.duration);
                          const lateDays = computeLateDays(cls.endDate, cls.actualEndDate);
                          const initial  = cls.teacherName
                            ? cls.teacherName.trim().split(" ").slice(-1)[0][0]
                            : "?";
                          return (
                            <tr key={cls.classId} className="acm-row">
                              <td className="text-muted">{(page - 1) * PAGE_SIZE + i + 1}</td>
                              <td>
                                <button
                                  className="acm-class-link btn btn-link p-0 fw-semibold"
                                  onClick={() => goToStudents(cls)}
                                >
                                  {display(cls.classCode)}
                                </button>
                              </td>
                              <td>{display(cls.courseName)}</td>
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <span className="acm-avatar">{initial}</span>
                                  <span className="text-truncate" style={{ maxWidth: 130 }}>
                                    {display(cls.teacherName)}
                                  </span>
                                </div>
                              </td>
                              <td className="text-muted">—</td>
                              <td className="text-muted">—</td>
                              <td className="text-nowrap">{display(cls.scheduleDays)}</td>
                              <td className="text-nowrap">{shift}</td>
                              <td className="text-nowrap">{fmtDate(cls.startDate)}</td>
                              <td className="text-nowrap">{fmtDate(cls.endDate)}</td>
                              <td className="text-nowrap">{fmtDate(cls.actualEndDate)}</td>
                              <td className="text-center">
                                {lateDays === null ? (
                                  <span className="text-muted">—</span>
                                ) : lateDays <= 0 ? (
                                  <span className="badge bg-success-subtle text-success">Đúng hạn</span>
                                ) : (
                                  <span className="badge bg-danger-subtle text-danger">+{lateDays}</span>
                                )}
                              </td>
                              <td className="text-center fw-medium">{cls.studentCount ?? "—"}</td>
                              <td className="text-center text-muted">—</td>
                              <td className="text-center text-muted">—</td>
                              <td className="text-center text-muted">—</td>
                              <td className="text-center text-muted">—</td>
                              <td className="text-center">
                                <StatusBadge status={status} />
                              </td>
                              <td className="text-center text-muted">—</td>
                              <td className="text-center text-muted">—</td>
                              <td className="text-center text-muted">—</td>
                              <td className="text-muted">—</td>
                            </tr>
                          );
                        })}
                        {filtered.length === 0 && (
                          <tr>
                            <td colSpan={22} className="text-center text-muted py-5">
                              <i className="isax isax-document-text d-block mb-2" style={{ fontSize: 32 }} />
                              Không tìm thấy lớp học phù hợp
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="acm-sticky-footer d-flex align-items-center justify-content-between">
                  <span className="text-muted small">Tổng {filtered.length} lớp</span>
                  <Pagination
                    current={page}
                    pageSize={PAGE_SIZE}
                    total={filtered.length}
                    showSizeChanger={false}
                    onChange={setPage}
                  />
                </div>
              </div>
            </div>
    </ManagementPageFrame>
  );
}
