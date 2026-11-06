"use client";
/* eslint-disable @next/next/no-img-element */
// Màn "Khoá học" học viên (/student/student-courses) — chuyển từ HSK cũ features/student/student-course/student-course.tsx.
// Dữ liệu thật từ repo-lms GET /hsk-courses (danh mục + sở hữu/tiến độ từ ERP HSK) và GET /hsk-courses/{id} (lộ trình, tài liệu).
// Khác bản cũ có chủ đích: không còn danh sách khoá mẫu khi API rỗng, không còn tiến độ minh hoạ 65% và trình độ cố định trên banner;
// lỗi tải có thông báo + "Thử lại"; ERP không trả được đăng ký thì báo cho học viên thay vì hiện "chưa sở hữu" lặng lẽ.
import { useMemo, useState } from "react";
import StudentShell from "./dashboard/student-shell";
import { useStudentIdentity } from "./student-data";
import CourseHero from "./course/components/course-hero";
import CourseFilterSidebar from "./course/components/course-filter-sidebar";
import { CourseSection } from "./course/components/course-card";
import CourseDetailModal from "./course/components/course-detail-modal";
import { COURSE_CATEGORIES } from "./course/data/catalog-courses";
import { FetchStateNotice } from "@/components/shared/fetch-state-notice";
import { useKeyedFetch } from "@/components/management/notifications/use-keyed-fetch";
import { getStudentCourse, listStudentCourses } from "@/lib/api/lms-course-client";
import { STUDENT_COURSE_PROMO, STUDENT_COURSE_UNLOCK_URL } from "@/lib/student-course/course-config";
import {
  activeFilterCount,
  currentCourse,
  DEFAULT_FILTERS,
  filterAndSort,
  heroLevels,
  priceCeiling,
  studyFormCounts,
  toCourseVM,
  toDetailData,
  type CourseFilterState,
  type CourseVM,
  type SortId,
  type ViewMode,
} from "@/lib/student-course/course-view-model";
import "./course/student-course.scss";

const MODES = [
  { id: "all", label: "Tất cả khoá học" },
  { id: "mine", label: "Khoá học của tôi" },
] as const;

export default function StudentCourses() {
  const identity = useStudentIdentity();
  const [mode, setMode] = useState<ViewMode>("all");
  const [filters, setFilters] = useState<CourseFilterState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortId>("newest");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<CourseVM | null>(null);

  const catalog = useKeyedFetch("student-courses", listStudentCourses);
  const detail = useKeyedFetch(selected ? `student-course:${selected.id}` : null, () => getStudentCourse(selected!.id));

  const allCourses = useMemo(() => (catalog.state.kind === "ok" ? catalog.state.data.items.map(toCourseVM) : []), [catalog.state]);
  const enrollmentSource = catalog.state.kind === "ok" ? catalog.state.data.enrollmentSource : "LIVE";
  const visibleCourses = useMemo(() => filterAndSort(allCourses, mode, filters, sort), [allCourses, mode, filters, sort]);
  const formCounts = useMemo(() => studyFormCounts(allCourses, mode), [allCourses, mode]);
  const priceMax = useMemo(() => priceCeiling(allCourses), [allCourses]);
  const levels = useMemo(() => heroLevels(allCourses), [allCourses]);
  const current = useMemo(() => currentCourse(allCourses), [allCourses]);
  const filterCount = activeFilterCount(filters);
  const detailData = detail.state.kind === "ok" ? toDetailData(detail.state.data) : null;

  return (
    <StudentShell fullWidth>
      <div className="hb-course">
        <div className="hb-course__container">
          <CourseHero
            studentName={identity.name}
            avatarUrl={identity.avatarUrl}
            levelIn={levels.levelIn}
            levelCurrent={levels.levelCurrent}
            levelGoal={levels.levelGoal}
            variant={mode}
            currentCourseCode={current?.cardLabel}
            promoLabel={STUDENT_COURSE_PROMO}
          />

          <div className="hb-course__layout">
            <button
              type="button"
              className={`hb-course__filter-backdrop${filterOpen ? " hb-course__filter-backdrop--open" : ""}`}
              aria-label="Đóng bộ lọc"
              onClick={() => setFilterOpen(false)}
            />
            <div className={`hb-course__filter-panel${filterOpen ? " hb-course__filter-panel--open" : ""}`}>
              <CourseFilterSidebar value={filters} onChange={setFilters} studyFormCounts={formCounts} priceMax={priceMax} onClose={() => setFilterOpen(false)} />
            </div>

            <main>
              <div className="hb-course__toolbar">
                <div className="hb-course__mode">
                  <div className="hb-course__mode-switch" role="tablist">
                    {MODES.map((item) => {
                      const active = mode === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          className={`hb-course__mode-btn${active ? " hb-course__mode-btn--active" : ""}`}
                          onClick={() => setMode(item.id)}
                        >
                          <span className="hb-course__mode-btn-label">
                            <img className="hb-course__mode-star" src="/assets/hocba/courses/ic-star-sm.svg" alt="" />
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <span className="hb-course__mode-hint">
                    <svg viewBox="0 0 18 18" width={16} height={16} fill="none" aria-hidden="true">
                      <circle cx="9" cy="9" r="7.6" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M9 8v5M9 5.6h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                    {mode === "all" ? "Đang hiển thị toàn bộ khoá học" : "Đang hiển thị khoá học đã sở hữu"}
                  </span>
                </div>

                <div className="hb-course__toolbar-actions">
                  <button type="button" className="hb-course__mobile-filter" aria-expanded={filterOpen} onClick={() => setFilterOpen(true)}>
                    <img src="/assets/hocba/courses/ic-filter.svg" alt="" width={12} height={12} />
                    Bộ lọc
                    {filterCount > 0 && <span className="hb-course__mobile-filter-count">{filterCount}</span>}
                  </button>
                  <select className="hb-course__sort" value={sort} onChange={(e) => setSort(e.target.value as SortId)} aria-label="Sắp xếp khoá học">
                    <option value="newest">Mới nhất</option>
                    <option value="oldest">Cũ nhất</option>
                    <option value="price-asc">Giá tăng dần</option>
                    <option value="price-desc">Giá giảm dần</option>
                  </select>
                </div>
              </div>

              {enrollmentSource === "UNAVAILABLE" && (
                <div className="hb-course__notice" role="status" data-testid="enrollment-unavailable">
                  Không tải được danh sách khoá học bạn đã đăng ký từ hệ thống quản lý đào tạo nên các khoá đang hiện &quot;Chưa sở hữu&quot;. Vui lòng
                  tải lại trang sau ít phút.
                </div>
              )}
              {enrollmentSource === "CACHED" && (
                <div className="hb-course__notice" role="status" data-testid="enrollment-cached">
                  Hệ thống quản lý đào tạo đang gián đoạn: trạng thái khoá học của bạn lấy theo lần cập nhật gần nhất, có thể chưa mới nhất.
                </div>
              )}

              <FetchStateNotice
                state={catalog.state}
                waitingText="Khoá học chưa được kết nối API (WAITING FOR BACKEND)."
                onRetry={catalog.reload}
                testId="student-courses-notice"
                className="mb-3"
              />

              {catalog.state.kind === "loading" ? (
                <div className="hb-course__loading">
                  <div className="spinner-border text-danger" role="status" aria-label="Đang tải khoá học" />
                </div>
              ) : catalog.state.kind !== "ok" ? null : visibleCourses.length === 0 ? (
                <div className="hb-course__section">
                  <div className="hb-course__empty" data-testid="student-courses-empty">
                    {allCourses.length === 0
                      ? "Chưa có khoá học nào."
                      : mode === "mine" && filterCount === 0
                        ? "Bạn chưa sở hữu khoá học nào."
                        : "Không có khoá học nào khớp với bộ lọc hiện tại."}
                  </div>
                </div>
              ) : (
                COURSE_CATEGORIES.map((category) => (
                  <CourseSection
                    key={category.id}
                    category={category}
                    courses={visibleCourses.filter((c) => c.category === category.id)}
                    onOpen={setSelected}
                    onExplore={() => setFilters({ ...filters, categories: [category.id] })}
                  />
                ))
              )}
            </main>
          </div>
        </div>

        {selected && (
          <CourseDetailModal
            key={selected.id}
            show
            onHide={() => setSelected(null)}
            course={selected}
            detail={detailData}
            isLoading={detail.state.kind === "loading"}
            error={detail.state.kind === "error" ? detail.state.message : detail.state.kind === "waiting" ? "Khoá học chưa được kết nối API (WAITING FOR BACKEND)." : null}
            onRetry={detail.reload}
            unlockUrl={STUDENT_COURSE_UNLOCK_URL}
          />
        )}
      </div>
    </StudentShell>
  );
}
