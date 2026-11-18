"use client";

// Port của LMS_Frontend/src/features/admin/class-management/admin-class-students-page.tsx (cùng DOM, class CSS `acm-*` của class-management.css,
// style nội tuyến và chữ). View thuần: không gọi API, nhận dữ liệu qua props (container: admin-class-students-page-content.tsx). Chỉ ĐỌC.
//
// Khác bản cũ có chủ đích: (1) classId thiếu/không hợp lệ => dòng thông báo, không gọi API (bản cũ treo spinner mãi); (2) dịch vụ chưa cấu hình / gọi lỗi
// => FetchStateNotice (kèm "Thử lại" khi lỗi) thay vì "Không tìm thấy thông tin lớp học" / bảng rỗng; (3) cột "Số buổi đi học" hiện "x/y" khi nguồn có
// attendanceSummary (backend chung), vẫn "—" khi không có như bản cũ; (4) dải thông tin lớp thêm giáo trình / trợ giảng / quản lý học viên khi nguồn có
// (backend chung); (5) nút quay lại dùng next/link (prefetch tắt) thay cho <a href> tải lại trang; (6) phản hồi không phải mảng là lỗi hợp đồng.
import { ManagementBackButton } from "@/components/management/management-back-button";
import { Pagination, Spin } from "antd";
import { useState } from "react";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { STATUS_CONFIG, computeShift, computeStatus, display } from "@/lib/class-management/class-display";
import { STUDENTS_PAGE_SIZE, attendanceLabel, formatPercent, percentTone } from "@/lib/class-management/student-display";
import type { AdminClassInfo, AdminClassStudent } from "@/types/admin-class";

export type ClassStudentsParamNotice = { kind: "missing-class" } | { kind: "invalid-class" };

const PARAM_NOTICE_TEXT: Record<ClassStudentsParamNotice["kind"], string> = {
  "missing-class": "Thiếu mã lớp (classId) trong đường dẫn. Hãy quay lại \"Quản lý lớp học\" và chọn một lớp.",
  "invalid-class": "Mã lớp (classId) trong đường dẫn không hợp lệ. Hãy quay lại \"Quản lý lớp học\" và chọn một lớp.",
};

const WAITING_INFO = "Thông tin lớp học chưa được kết nối API (WAITING FOR BACKEND).";
const WAITING_STUDENTS = "Danh sách học viên chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị.";

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { color: "#6c757d", bg: "#f0f0f0" };
  return (
    <span className="acm-status-badge" style={{ color: cfg.color, background: cfg.bg }}>
      {status}
    </span>
  );
}

function PercentCell({ pct }: { pct: number | undefined }) {
  const text = formatPercent(pct);
  if (text === null || pct === undefined) return <span className="text-muted">—</span>;
  return <span className={`fw-medium ${percentTone(pct)}`}>{text}</span>;
}

function ClassInfoStrip({ info }: { info: AdminClassInfo }) {
  const status = computeStatus(info.startDate, info.endDate, info.actualEndDate);
  const shift = computeShift(info.startTime, info.duration);
  const assistant = info.mentorName ?? info.assistantName;
  return (
    <div className="acm-info-strip card mb-3" data-testid="acs-class-info" data-source={info.source}>
      <div className="card-body py-3">
        <div className="acm-modal-strip" style={{ padding: 0, background: "none", border: "none" }}>
          <div className="acm-strip-item">
            <i className="isax isax-code" />
            <span className="fw-bold" style={{ color: "#B00D0E" }}>{info.classCode}</span>
          </div>
          <div className="acm-strip-item">
            <i className="isax isax-book-1" />
            <span>{info.courseName || "—"}</span>
          </div>
          <div className="acm-strip-item">
            <i className="isax isax-teacher" />
            <span>{info.teacherName || "—"}</span>
          </div>
          <div className="acm-strip-item">
            <i className="isax isax-calendar-1" />
            <span>{display(info.scheduleDays)} · {shift}</span>
          </div>
          <div className="acm-strip-item">
            <i className="isax isax-profile-2user" />
            <span>{info.studentCount ?? "—"} học viên</span>
          </div>
          <div className="acm-strip-item">
            <StatusBadge status={status} />
          </div>
          {/* Chỉ có khi nguồn là backend chung (ClassDetailResponse): HSK cũ không có các trường này. */}
          {info.syllabusName && (
            <div className="acm-strip-item" data-testid="acs-syllabus">
              <i className="isax isax-book-saved" />
              <span>Giáo trình: {info.syllabusName}</span>
            </div>
          )}
          {assistant && (
            <div className="acm-strip-item" data-testid="acs-mentor">
              <i className="isax isax-user-tag" />
              <span>Trợ giảng: {assistant}</span>
            </div>
          )}
          {info.studentManagerName && (
            <div className="acm-strip-item" data-testid="acs-student-manager">
              <i className="isax isax-user-octagon" />
              <span>QL học viên: {info.studentManagerName}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface AdminClassStudentsViewProps {
  /** Có giá trị => không có lời gọi API; `info`/`students` bị bỏ qua. */
  paramNotice: ClassStudentsParamNotice | null;
  info: FetchState<AdminClassInfo | null>;
  students: FetchState<AdminClassStudent[]>;
  onRetry: () => void;
}

export function AdminClassStudentsView({ paramNotice, info, students, onRetry }: AdminClassStudentsViewProps) {
  const [page, setPage] = useState(1);
  const classInfo = !paramNotice && info.kind === "ok" ? info.data : null;
  const list = !paramNotice && students.kind === "ok" ? students.data : [];
  const studentsLoading = !paramNotice && students.kind === "loading";
  const studentsNotice = !paramNotice && (students.kind === "waiting" || students.kind === "error") ? students : null;
  const infoNotice = !paramNotice && (info.kind === "waiting" || info.kind === "error") ? info : null;
  // Danh sách tải lại ít dòng hơn => không để trang hiện tại vượt trang cuối.
  const lastPage = Math.max(1, Math.ceil(list.length / STUDENTS_PAGE_SIZE));
  const currentPage = Math.min(page, lastPage);
  const paged = list.slice((currentPage - 1) * STUDENTS_PAGE_SIZE, currentPage * STUDENTS_PAGE_SIZE);
  const countLabel: number | string = paramNotice || students.kind === "ok" ? list.length : students.kind === "loading" ? 0 : "—";

  return (
    <ManagementPageFrame contentClassName="acm-page-bg">
      {/* ─── Breadcrumb / return ─── */}
      <div className="d-flex align-items-center flex-wrap gap-3 mb-3">
        <ManagementBackButton href="/admin/class-management" label="Quay lại Quản lý lớp học" />
        {classInfo && (
          <h4 className="mb-0">Lớp {classInfo.classCode}</h4>
        )}
      </div>

      {/* ─── Class info strip ─── */}
      {paramNotice ? (
        <div className="alert alert-warning mb-3" role="status" data-testid="acs-param-notice" data-kind={paramNotice.kind}>
          {PARAM_NOTICE_TEXT[paramNotice.kind]}
        </div>
      ) : info.kind === "loading" ? (
        <div className="text-center py-3" data-testid="acs-info-loading">
          <Spin />
        </div>
      ) : infoNotice ? (
        <FetchStateNotice state={infoNotice} waitingText={WAITING_INFO} onRetry={onRetry} testId="acs-info-notice" className="mb-3" />
      ) : classInfo ? (
        <ClassInfoStrip info={classInfo} />
      ) : (
        <div className="alert alert-warning mb-3" role="status" data-testid="acs-info-missing">
          Không tìm thấy thông tin lớp học.
        </div>
      )}

      {/* ─── Student table ─── */}
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
          <span className="fw-bold">
            <i className="isax isax-people me-2" style={{ color: "rgba(255,255,255,0.85)" }} />
            Danh sách học viên ({countLabel})
          </span>
          <small style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>Admin · Chỉ xem</small>
        </div>
        <div className="card-body p-0">
          {paramNotice ? (
            <div className="text-center text-muted py-5">
              <i className="isax isax-people d-block mb-2" style={{ fontSize: 32 }} />
              Chọn một lớp ở &quot;Quản lý lớp học&quot; để xem danh sách học viên
            </div>
          ) : studentsLoading ? (
            <div className="text-center py-5">
              <Spin size="large" />
            </div>
          ) : studentsNotice ? (
            <div className="p-3">
              <FetchStateNotice state={studentsNotice} waitingText={WAITING_STUDENTS} onRetry={onRetry} testId="acs-students-notice" />
            </div>
          ) : list.length === 0 ? (
            <div className="text-center text-muted py-5" data-testid="acs-students-empty">
              <i className="isax isax-people d-block mb-2" style={{ fontSize: 32 }} />
              Chưa có dữ liệu học viên cho lớp này
            </div>
          ) : (
            <>
              <div className="table-responsive acm-scroll-x">
                <table className="acm-table acm-students-table table align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>STT</th>
                      <th>Email học viên</th>
                      <th>Tên học viên</th>
                      <th>SĐT</th>
                      <th className="text-center">Số buổi đi học</th>
                      <th className="text-center">CC BTVN</th>
                      <th className="text-center">% Chất lượng BT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((stu, i) => (
                      <tr key={stu.userId} className="acm-row" data-testid="acs-student-row">
                        <td className="text-muted">{(currentPage - 1) * STUDENTS_PAGE_SIZE + i + 1}</td>
                        <td>
                          <span className="badge bg-light text-secondary border" style={{ fontWeight: 500, fontSize: 12 }}>
                            {stu.email || "—"}
                          </span>
                        </td>
                        <td className="fw-medium">{display(stu.name)}</td>
                        <td className="text-muted">{display(stu.phone)}</td>
                        <td className={`text-center${attendanceLabel(stu) === "—" ? " text-muted" : ""}`}>{attendanceLabel(stu)}</td>
                        <td className="text-center">
                          <PercentCell pct={stu.homeworkCompletionPercent} />
                        </td>
                        <td className="text-center">
                          <PercentCell pct={stu.qualityPercent} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="acm-sticky-footer d-flex align-items-center justify-content-between">
                <span className="text-muted small">Tổng {list.length} học viên</span>
                <Pagination current={currentPage} pageSize={STUDENTS_PAGE_SIZE} total={list.length} showSizeChanger={false} onChange={setPage} />
              </div>
            </>
          )}
        </div>
      </div>
    </ManagementPageFrame>
  );
}
