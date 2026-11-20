"use client";

import { FetchErrorNotice } from "@/components/shared/fetch-state-notice";

// Port của LMS_Frontend/src/features/instructor/class-management/class-list-page.tsx (cùng DOM, class, style nội tuyến và chữ).
// View thuần: không gọi API, nhận dữ liệu và bộ lọc qua props (container: instructor-class-list-page-content.tsx). Chỉ ĐỌC — bản cũ không có thao tác ghi.
//
// Khác bản cũ có chủ đích: (1) dịch vụ chưa cấu hình / gọi lỗi => dòng thông báo trong bảng (kèm "Thử lại" khi lỗi) thay vì "Chưa có lớp được phân công"
// (sẽ nói sai rằng giảng viên không có lớp); (2) trạng thái đầu là "đang tải" ngay (bản cũ có một khung hình "Chưa có lớp được phân công" trước khi tải);
// (3) liên kết mã lớp dùng next/link (không tải lại trang, prefetch tắt); (4) thêm aria-label cho vòng tròn chữ cái đầu và nhãn trạng thái chấm bài.
import { Pagination } from "antd";
import Link from "next/link";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { ClassListState } from "@/components/management/class-management/use-admin-classes";
import type { TimeFilterMode } from "@/lib/class-list/class-list-filters";
import { CLASS_LIST_PAGE_SIZE, display, initials, lessonHref, type ClassListFilters } from "@/lib/class-list/class-list-model";
import type { GradingClassResponse } from "@/types/grading";

interface InstructorClassListViewProps {
  state: ClassListState;
  /** Toàn bộ lớp đã tải (để biết "Chưa có lớp" khác "Không có lớp phù hợp bộ lọc"). */
  total: number;
  filters: ClassListFilters;
  courseOptions: [string, string][];
  classOptions: { id: string; label: string; code: string }[];
  /** Lớp đã lọc + sắp xếp (toàn bộ, chưa cắt trang). */
  filtered: GradingClassResponse[];
  page: number;
  onCourseChange: (course: string) => void;
  onClassChange: (classId: string) => void;
  onTimeModeChange: (mode: TimeFilterMode) => void;
  onExactDateChange: (date: string) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}

export function InstructorClassListView({
  state,
  total,
  filters,
  courseOptions,
  classOptions,
  filtered,
  page,
  onCourseChange,
  onClassChange,
  onTimeModeChange,
  onExactDateChange,
  onPageChange,
  onRetry,
}: InstructorClassListViewProps) {
  const loading = state.kind === "loading";
  const paged = filtered.slice((page - 1) * CLASS_LIST_PAGE_SIZE, page * CLASS_LIST_PAGE_SIZE);

  return (
    <ManagementPageFrame>
      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-4">
              <label className="form-label text-primary fw-medium" htmlFor="grading-course-filter">
                Khóa học
              </label>
              <select id="grading-course-filter" className="form-select" value={filters.course} onChange={(e) => onCourseChange(e.target.value)}>
                <option value="">Tất cả khóa học</option>
                {courseOptions.map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label text-primary fw-medium" htmlFor="grading-class-filter">
                Mã lớp
              </label>
              <select id="grading-class-filter" className="form-select" value={filters.classId} onChange={(e) => onClassChange(e.target.value)}>
                <option value="">Tất cả lớp</option>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code && c.code !== c.label ? `${c.label} (${c.code})` : c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label text-primary fw-medium" htmlFor="grading-time-filter">
                Thời gian
              </label>
              <select id="grading-time-filter" className="form-select" value={filters.timeMode} onChange={(e) => onTimeModeChange(e.target.value as TimeFilterMode)}>
                <option value="">Mọi thời gian</option>
                <option value="EXACT">Ngày chính xác</option>
                <option value="TODAY">Hôm nay</option>
                <option value="TOMORROW">Ngày mai</option>
                <option value="YESTERDAY">Hôm qua</option>
                <option value="PAST_7_DAYS">Trong 7 ngày qua</option>
                <option value="NEXT_7_DAYS">Trong 7 ngày tới</option>
              </select>
              {filters.timeMode === "EXACT" && (
                <input type="date" className="form-control mt-2" aria-label="Chọn ngày chính xác" value={filters.exactDate} onChange={(e) => onExactDateChange(e.target.value)} />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-light fw-bold">Danh sách lớp học ({filtered.length})</div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="cm-table table align-middle mb-0" style={{ minWidth: 900 }}>
              <thead className="table-light">
                <tr>
                  <th>STT</th>
                  <th>Mã lớp</th>
                  <th>Khóa học</th>
                  <th>Giáo viên</th>
                  <th>Ngày bắt đầu</th>
                  <th>Ngày kết thúc dự kiến</th>
                  <th className="text-center">Số học viên</th>
                  <th className="text-center">Bài chưa chấm</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((c, i) => (
                  <tr key={c.classId} data-testid="class-row">
                    <td>{(page - 1) * CLASS_LIST_PAGE_SIZE + i + 1}</td>
                    <td>
                      <Link href={lessonHref(c)} prefetch={false} className="text-primary fw-semibold">
                        {display(c.classCode)}
                      </Link>
                    </td>
                    <td>{display(c.courseName)}</td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span
                          className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary-subtle text-primary fw-bold flex-shrink-0"
                          style={{ width: 36, height: 36, fontSize: 12 }}
                        >
                          {initials(c.teacherName)}
                        </span>
                        <div className="text-truncate" style={{ maxWidth: 180 }}>
                          <div className="fw-medium text-truncate">{display(c.teacherName)}</div>
                          <div className="small text-muted text-truncate">{display(c.teacherEmail)}</div>
                        </div>
                      </div>
                    </td>
                    <td>{display(c.startDate)}</td>
                    <td>{display(c.endDate)}</td>
                    <td className="text-center">{display(c.studentCount)}</td>
                    <td className="text-center">
                      {c.hasPendingGrading ? (
                        <span className="cm-dot-badge" role="img" aria-label="Có bài chưa chấm">
                          *
                        </span>
                      ) : (
                        <span className="badge bg-light text-muted" role="img" aria-label="Không có bài chưa chấm">
                          ✓
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {(state.kind === "not-integrated" || state.kind === "error") && (
                  <tr>
                    <td colSpan={8} className="p-3">
                      {state.kind === "error" ? (
                        <FetchErrorNotice title="Không thể tải danh sách lớp học" description={state.message} onRetry={onRetry} testId="class-list-notice" />
                      ) : (
                        <div className="alert alert-warning mb-0" role="status" data-testid="class-list-notice" data-kind={state.kind}>
                          Danh sách lớp chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị.
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                {state.kind === "ok" && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">
                      {total ? "Không có lớp phù hợp bộ lọc" : "Chưa có lớp được phân công"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {loading && (
            <div className="text-center py-4">
              <span className="spinner-border text-primary" />
            </div>
          )}
          <div className="cm-sticky-footer d-flex align-items-center justify-content-between">
            <span className="text-muted small">Tổng số {filtered.length}</span>
            <Pagination current={page} pageSize={CLASS_LIST_PAGE_SIZE} total={filtered.length} showSizeChanger={false} onChange={onPageChange} />
          </div>
        </div>
      </div>
    </ManagementPageFrame>
  );
}
