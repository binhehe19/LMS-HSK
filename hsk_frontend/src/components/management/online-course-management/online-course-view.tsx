"use client";

// Port của LMS_Frontend/src/features/learning-path/online-course/manage/online-course-management-page.tsx (cùng DOM/class `onl-*`, chữ, biểu tượng;
// SCSS ở online-course-management.scss nạp qua styles/page-styles.ts). View thuần: không gọi API; dữ liệu/thao tác qua props từ
// online-course-management-page-content.tsx + use-online-courses.ts.
//
// Khác bản cũ có chủ đích: (1) dịch vụ chưa cấu hình / lỗi tải => FetchStateNotice (bản cũ: toast rồi lưới rỗng "Không tìm thấy khóa học");
// (2) nút ghi (Đồng bộ/Sửa/Xoá) khoá + WriteLockedNotice khi công tắc ghi "online-course" đóng; (3) nút "Tạo mới khóa học" bản cũ ẩn bằng
// `{false && …}` — ở đây KHÔNG render (hợp đồng POST /courses chỉ ghi trong docs); (4) card có nút "Sửa"/"Xoá" dùng CSS `.btn-edit/.btn-delete`
// sẵn có (bản cũ khai báo openEdit/handleDelete nhưng không nối vào nút nào); (5) Alert "Chế độ Xem duy nhất" cho giảng viên không chuyển vì
// route chỉ dành cho ADMIN ở app mới; (6) react-bootstrap Button/Form => phần tử Bootstrap thuần.
import { ManagementPageFrame } from "@/components/management/management-page-frame";
import type { FetchState } from "@/components/management/notifications/use-keyed-fetch";
import { AssetImage } from "@/components/shared/asset-image";
import { FetchStateNotice, WriteLockedNotice } from "@/components/shared/fetch-state-notice";
import { PageHeader } from "@/components/shared/page-header";
import {
  COURSE_FALLBACK_THUMBNAIL,
  courseCode,
  courseName,
  courseStats,
  courseThumbnail,
  courseTypeBadge,
  formatPrice,
  formatRating,
  hasActiveCourseFilters,
  type CourseFilters,
  type CoursePriceSort,
  type CourseSyncFilter,
  type CourseTypeFilter,
} from "@/lib/online-course/online-course-model";
import type { OnlineCourseSummary } from "@/types/online-course";

export const ONLINE_COURSE_WAITING_TEXT = "Danh sách khóa học trực tuyến chưa được kết nối API (WAITING FOR BACKEND).";

export interface OnlineCourseViewProps {
  state: FetchState<OnlineCourseSummary[]>;
  /** Toàn bộ khoá học đang hiển thị (để thống kê). */
  courses: OnlineCourseSummary[];
  /** Kết quả sau bộ lọc phía client. */
  filtered: OnlineCourseSummary[];
  refreshing: boolean;
  writeEnabled: boolean;
  busy: boolean;
  syncing: boolean;
  filters: CourseFilters;
  onFiltersChange: (next: CourseFilters) => void;
  onClearFilters: () => void;
  onSync: () => void;
  onOpenDetail: (course: OnlineCourseSummary) => void;
  onEdit: (course: OnlineCourseSummary) => void;
  onDelete: (course: OnlineCourseSummary) => void;
  onRetry: () => void;
}

export function OnlineCourseView(props: OnlineCourseViewProps) {
  const { state, courses, filtered, refreshing, writeEnabled, busy, syncing, filters } = props;
  const loading = state.kind === "loading" && !refreshing;
  const hasData = state.kind === "ok" || refreshing;
  const stats = courseStats(courses);
  const statValue = (value: number) => (hasData || loading ? value : "—");
  const canWrite = writeEnabled && !busy;
  const set = <K extends keyof CourseFilters>(key: K, value: CourseFilters[K]) => props.onFiltersChange({ ...filters, [key]: value });

  return (
    <ManagementPageFrame contentClassName="online-course-mgmt-container">
      <div className="row onl-stats-row g-3">
        {[
          { tone: "blue", icon: "isax-status-up", value: stats.total, label: "Tổng số lượng" },
          { tone: "green", icon: "isax-cloud-connection", value: stats.synced, label: "Khóa đã đồng bộ" },
          { tone: "orange", icon: "isax-people", value: stats.group, label: "Nhóm" },
          { tone: "purple", icon: "isax-user", value: stats.oneToOne, label: "1-1" },
        ].map((card) => (
          <div className="col-md-3" key={card.label}>
            <div className="stat-card" data-testid="onl-stat-card">
              <div className={`stat-icon ${card.tone}`}>
                <i className={`isax ${card.icon}`} />
              </div>
              <div className="stat-info">
                <div className="stat-value">{statValue(card.value)}</div>
                <div className="stat-label">{card.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card onl-header-card">
        <PageHeader
          icon="isax-medal-star"
          title="Quản lý Khóa học Trực tuyến"
          subtitle="Nền tảng quản trị khóa học cao cấp, đồng bộ dữ liệu thông minh"
          actions={
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-outline-primary rounded-pill px-4" onClick={props.onSync} disabled={syncing || !writeEnabled}>
                <i className={`isax isax-refresh me-2 ${syncing ? "fa-spin" : ""}`} />
                {syncing ? "Đang đồng bộ..." : "Đồng bộ dữ liệu"}
              </button>
            </div>
          }
        />
        {!writeEnabled && (
          <div className="px-3 pb-3">
            <WriteLockedNotice what="Thao tác với khóa học (đồng bộ CMS, sửa, xóa)" />
          </div>
        )}
      </div>

      <div className="onl-filters-toolbar">
        <div className="search-wrapper">
          <i className="isax isax-search-normal-1" />
          <input className="form-control" placeholder="Tìm theo tên hoặc mã khóa học..." value={filters.search} onChange={(e) => set("search", e.target.value)} aria-label="Tìm theo tên hoặc mã khóa học" />
        </div>
        <div className="filter-group">
          <select className="form-select" value={filters.type} onChange={(e) => set("type", e.target.value as CourseTypeFilter)} aria-label="Loại khóa học">
            <option value="all">Loại: Tất cả</option>
            <option value="group">Học nhóm</option>
            <option value="1-1">Học 1-1</option>
          </select>
          <select className="form-select" value={filters.sync} onChange={(e) => set("sync", e.target.value as CourseSyncFilter)} aria-label="Nguồn quản lý">
            <option value="all">Q.Lý: Tất cả</option>
            <option value="synced">Đã đồng bộ</option>
            <option value="local">Nội bộ</option>
          </select>
          <select className="form-select" value={filters.priceSort} onChange={(e) => set("priceSort", e.target.value as CoursePriceSort)} aria-label="Sắp xếp theo giá">
            <option value="none">Sắp xếp: Giá</option>
            <option value="asc">Giá: Thấp → Cao</option>
            <option value="desc">Giá: Cao → Thấp</option>
          </select>
          {hasActiveCourseFilters(filters) && (
            <button type="button" className="btn btn-link btn-clear" onClick={props.onClearFilters}>
              Xóa tất cả
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 text-muted small px-1">
        Tìm thấy <strong>{filtered.length}</strong> / <strong>{courses.length}</strong> khóa học
      </div>

      {loading ? (
        <div className="text-center py-5" data-testid="onl-loading">
          <span className="spinner-border text-primary" role="status" />
          <p className="mt-3 text-muted fw-semibold">Đang tải dữ liệu khóa học...</p>
        </div>
      ) : state.kind === "waiting" || state.kind === "error" ? (
        <FetchStateNotice state={state} waitingText={ONLINE_COURSE_WAITING_TEXT} onRetry={props.onRetry} testId="onl-notice" />
      ) : filtered.length === 0 ? (
        <div className="text-center py-5 card rounded-4 border-0 shadow-sm" data-testid="onl-empty">
          <div className="py-4">
            <i className="isax isax-folder-open text-muted" style={{ fontSize: "64px" }} />
            <p className="mt-3 text-muted">Không tìm thấy khóa học nào phù hợp.</p>
            {filters.search && (
              <button type="button" className="btn btn-link" onClick={() => set("search", "")}>
                Xóa tìm kiếm
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="onl-course-grid">
          {filtered.map((course) => {
            const thumb = courseThumbnail(course);
            const badge = courseTypeBadge(course);
            const name = courseName(course);
            return (
              <div className="onl-course-card shadow-sm" key={course.id} data-testid="onl-course-card">
                <div className="course-card-top">
                  <AssetImage
                    src={thumb || COURSE_FALLBACK_THUMBNAIL}
                    alt={name}
                    className={thumb ? "" : "is-fallback"}
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.src = COURSE_FALLBACK_THUMBNAIL;
                      target.classList.add("is-fallback");
                    }}
                  />
                  <span className={`status-badge ${course.cmsSynced ? "synced" : "local"}`}>{course.cmsSynced ? "Đã đồng bộ" : "Nội bộ"}</span>
                  {badge && <span className="type-badge">{badge}</span>}
                </div>
                <div className="course-card-body">
                  {course.level && <span className="level-tag">{String(course.level)}</span>}
                  <h5 className="course-title">{name}</h5>
                  <div className="course-meta">
                    <span>
                      <i className="isax isax-book" /> {course.totalLessons || 0} bài học
                    </span>
                    <span>
                      <i className="isax isax-personalcard" /> ID: {courseCode(course) || "-"}
                    </span>
                  </div>
                  <div className="course-footer">
                    <div className="price-tag">
                      <span className="label">Học phí</span>
                      <span className="value">{formatPrice(course.price)}</span>
                    </div>
                    <div className="rating-info">
                      <i className="isax isax-star1" /> {formatRating(course.rating)}
                    </div>
                  </div>
                  <div className="course-actions">
                    <button type="button" className="btn btn-view shadow-sm" onClick={() => props.onOpenDetail(course)} aria-label={`Chi tiết ${name}`}>
                      <i className="isax isax-eye" /> Chi tiết
                    </button>
                    <button type="button" className="btn btn-edit shadow-sm" onClick={() => props.onEdit(course)} disabled={!canWrite} aria-label={`Sửa ${name}`}>
                      <i className="isax isax-edit-2" /> Sửa
                    </button>
                    <button type="button" className="btn btn-delete shadow-sm" onClick={() => props.onDelete(course)} disabled={!canWrite} aria-label={`Xóa ${name}`}>
                      <i className="isax isax-trash" /> Xóa
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ManagementPageFrame>
  );
}
