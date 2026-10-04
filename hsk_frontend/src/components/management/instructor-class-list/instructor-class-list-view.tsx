"use client";

import { Table, type TableColumnsType } from "antd";
import Link from "next/link";
import type { ClassListState } from "@/components/management/class-management/use-admin-classes";
import { FetchErrorNotice } from "@/components/shared/fetch-state-notice";
import { CatalogPagination } from "@/components/management/content-flat/catalog-pagination";
import { CatalogToolbar } from "@/components/management/content-flat/catalog-toolbar";
import styles from "@/components/management/content-flat/content-catalog.module.css";
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { TimeFilterMode } from "@/lib/class-list/class-list-filters";
import { display, initials, lessonHref, type ClassListFilters } from "@/lib/class-list/class-list-model";
import type { GradingClassResponse } from "@/types/grading";

interface InstructorClassListViewProps {
  state: ClassListState;
  total: number;
  filters: ClassListFilters;
  courseOptions: [string, string][];
  classOptions: { id: string; label: string; code: string }[];
  filtered: GradingClassResponse[];
  page: number;
  size: number;
  onCourseChange: (course: string) => void;
  onClassChange: (classId: string) => void;
  onTimeModeChange: (mode: TimeFilterMode) => void;
  onExactDateChange: (date: string) => void;
  onPageChange: (page: number, size: number) => void;
  onClearFilters: () => void;
  onRetry: () => void;
}

export function InstructorClassListView({
  state, total, filters, courseOptions, classOptions, filtered, page, size,
  onCourseChange, onClassChange, onTimeModeChange, onExactDateChange, onPageChange, onClearFilters, onRetry,
}: InstructorClassListViewProps) {
  const loading = state.kind === "loading";
  const offset = (page - 1) * size;
  const filterClass = `form-select form-select-sm w-auto ${styles.filter}`;
  const columns: TableColumnsType<GradingClassResponse> = [
    { title: "STT", key: "number", width: 64, align: "center", render: (_, __, index) => <span className={styles.rowNumber}>{offset + index + 1}</span> },
    {
      title: "Mã lớp", key: "code", width: 110,
      render: (_, cls) => <Link href={lessonHref(cls)} prefetch={false} className={styles.name}>{display(cls.classCode)}</Link>,
    },
    { title: "Khóa học", key: "course", render: (_, cls) => display(cls.courseName) },
    {
      title: "Giáo viên", key: "teacher", width: 210,
      render: (_, cls) => (
        <div className="d-flex align-items-center gap-2">
          <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary-subtle text-primary fw-bold flex-shrink-0" style={{ width: 28, height: 28, fontSize: 11 }}>
            {initials(cls.teacherName)}
          </span>
          <div className="text-truncate">
            <div title={cls.teacherName} className="fw-medium text-truncate">{display(cls.teacherName)}</div>
            <div title={cls.teacherEmail} className="small text-muted text-truncate">{display(cls.teacherEmail)}</div>
          </div>
        </div>
      ),
    },
    { title: "Ngày bắt đầu", key: "start", width: 116, render: (_, cls) => display(cls.startDate) },
    { title: "Ngày kết thúc dự kiến", key: "end", width: 133, render: (_, cls) => display(cls.endDate) },
    { title: "Số học viên", key: "students", width: 100, align: "center", render: (_, cls) => display(cls.studentCount) },
    {
      title: "Bài chưa chấm", key: "pending", width: 115, align: "center",
      render: (_, cls) => cls.hasPendingGrading
        ? <span className="cm-dot-badge" role="img" aria-label="Có bài chưa chấm">*</span>
        : <span className="badge bg-light text-muted" role="img" aria-label="Không có bài chưa chấm">✓</span>,
    },
  ];

  return (
    <ManagementPageFrame>
      <div className={`${styles.catalog} p-3`}>
        <CatalogToolbar
          label="Bộ lọc chấm bài"
          heading="Chấm bài"
          icon="isax-edit-2"
          description="Chọn lớp để xem các buổi học và bài cần chấm."
          onReload={onRetry}
          onClearFilters={onClearFilters}
          loading={loading}
        >
          <select aria-label="Khóa học" className={filterClass} value={filters.course} onChange={e => onCourseChange(e.target.value)}>
            <option value="">Tất cả khóa học</option>
            {courseOptions.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
          </select>
          <select aria-label="Mã lớp" className={filterClass} value={filters.classId} onChange={e => onClassChange(e.target.value)}>
            <option value="">Tất cả lớp</option>
            {classOptions.map(cls => <option key={cls.id} value={cls.id}>{cls.code && cls.code !== cls.label ? `${cls.label} (${cls.code})` : cls.label}</option>)}
          </select>
          <select aria-label="Thời gian" className={filterClass} value={filters.timeMode} onChange={e => onTimeModeChange(e.target.value as TimeFilterMode)}>
            <option value="">Mọi thời gian</option>
            <option value="EXACT">Ngày chính xác</option>
            <option value="TODAY">Hôm nay</option>
            <option value="TOMORROW">Ngày mai</option>
            <option value="YESTERDAY">Hôm qua</option>
            <option value="PAST_7_DAYS">Trong 7 ngày qua</option>
            <option value="NEXT_7_DAYS">Trong 7 ngày tới</option>
          </select>
          {filters.timeMode === "EXACT" && (
            <input type="date" className={`form-control form-control-sm w-auto ${styles.filter}`} aria-label="Chọn ngày chính xác" value={filters.exactDate} onChange={e => onExactDateChange(e.target.value)} />
          )}
        </CatalogToolbar>

        <section className={styles.panel} aria-label="Danh sách lớp học">
          {state.kind === "not-integrated" ? (
            <div className="alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2 mb-0" role="status" data-testid="class-list-notice" data-kind={state.kind}>
              <span>Danh sách lớp chưa được kết nối API (WAITING FOR BACKEND). Chưa có dữ liệu để hiển thị.</span>
            </div>
          ) : (
            <Table
              className={styles.table}
              rowKey="classId"
              columns={columns}
              dataSource={state.kind === "error" ? [] : filtered.slice(offset, offset + size)}
              onRow={() => ({ className: "align-middle", "data-testid": "class-row" })}
              loading={loading}
              pagination={false}
              scroll={{ x: 920 }}
              locale={{ emptyText: state.kind === "error"
                ? <FetchErrorNotice title="Không thể tải danh sách lớp học" description={state.message} onRetry={onRetry} testId="class-list-notice" />
                : loading ? null : total ? "Không có lớp phù hợp bộ lọc" : "Chưa có lớp được phân công" }}
            />
          )}
          {state.kind !== "error" && <CatalogPagination page={page} size={size} total={filtered.length} onChange={onPageChange} showQuickJumper={false} />}
        </section>
      </div>
    </ManagementPageFrame>
  );
}
