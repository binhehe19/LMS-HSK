"use client";
import RegisteredCourses from "./registered-courses";
import { useStudentIdentity, useStudentData } from "./student-data";
/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import StudentShell from "./dashboard/student-shell";
import CourseHero from "./course/components/course-hero";
import CourseFilterSidebar, { DEFAULT_FILTERS, type CourseFilterState } from "./course/components/course-filter-sidebar";
import { CourseSection, type CourseVM } from "./course/components/course-card";
import CourseDetailModal, { type CourseDetailData } from "./course/components/course-detail-modal";
import { CATALOG_COURSES, COURSE_CATEGORIES, type StudyFormId } from "./course/data/catalog-courses";
import "./course/student-course.scss";

type SortId = "newest" | "oldest" | "price-asc" | "price-desc";
const allCourses: CourseVM[] = CATALOG_COURSES.map(course => ({ ...course, owned: course.demoOwned, progress: course.demoProgress, doneSessions: course.demoDoneSessions }));
export default function StudentCourses() {
 const identity = useStudentIdentity();
 const { classes } = useStudentData();
 const registered = classes.data?.find(course => course.lifecycleStatus !== "COMPLETED") ?? classes.data?.[0];
 const [mode, setMode] = useState<"all" | "mine">("mine");
 const [filters, setFilters] = useState<CourseFilterState>(DEFAULT_FILTERS);
 const [sort, setSort] = useState<SortId>("newest");
 const [filterOpen, setFilterOpen] = useState(false);
 const [modalOpen, setModalOpen] = useState(false);
 const [selected, setSelected] = useState<CourseVM | null>(null);
 const [detail, setDetail] = useState<CourseDetailData | null>(null);
    // ── Lọc + sắp xếp ───────────────────────────────────────────────────────
    const visibleCourses = useMemo(() => {
        let list = allCourses;

        if (mode === 'mine') list = list.filter((c) => c.owned);
        if (filters.categories.length > 0) list = list.filter((c) => filters.categories.includes(c.category));
        if (filters.audience !== 'all') list = list.filter((c) => c.audiences.includes(filters.audience as Exclude<typeof filters.audience, "all">));
        if (filters.studyForms.length > 0) list = list.filter((c) => filters.studyForms.includes(c.studyForm));
        list = list.filter((c) => c.price <= filters.maxPrice);

        const sorted = [...list];
        switch (sort) {
            case 'oldest':
                sorted.sort((a, b) => a.releasedAt.localeCompare(b.releasedAt));
                break;
            case 'price-asc':
                sorted.sort((a, b) => a.price - b.price);
                break;
            case 'price-desc':
                sorted.sort((a, b) => b.price - a.price);
                break;
            default:
                sorted.sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
        }
        return sorted;
    }, [mode, filters, sort]);

    const studyFormCounts = useMemo(() => {
        const base = { 'online-tu-hoc': 0, 'online-ket-hop': 0, offline: 0 } as Record<StudyFormId, number>;
        const pool = mode === 'mine' ? allCourses.filter((c) => c.owned) : allCourses;
        pool.forEach((c) => {
            base[c.studyForm] += 1;
        });
        return base;
    }, [mode]);

    const activeFilterCount = filters.categories.length + filters.studyForms.length +
        (filters.audience === 'all' ? 0 : 1) + (filters.maxPrice === DEFAULT_FILTERS.maxPrice ? 0 : 1);

    /**
     * Khoá hiển thị trên hero ở chế độ "Khoá học của tôi".
     * Ưu tiên khoá đang học dở; nếu không có (API chỉ trả NOT_STARTED/COMPLETED)
     * thì lấy khoá đã sở hữu đầu tiên — nếu không panel sẽ không bao giờ hiện.
     */
    const currentCourse = useMemo(() => {
        const owned = allCourses.filter((c) => c.owned);
        return owned.find((c) => c.progress > 0 && c.progress < 100) ?? owned[0];
    }, []);


 const openCourse = (course: CourseVM) => {
  setSelected(course);
  setDetail({ sessions: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, label: `Buổi ${i + 1}`, topic: ["Chào hỏi và giới thiệu", "Gia đình và bạn bè", "Thời gian và sinh hoạt", "Mua sắm và giao tiếp"][i % 4], content: "Từ vựng theo chủ đề, mẫu câu giao tiếp và bài tập thực hành nghe, nói, đọc, viết." })), materials: [{ id: "sample-outline", title: "Giáo trình và đề cương khóa học" }, { id: "sample-practice", title: "Bài tập ôn luyện theo buổi" }] });
  setModalOpen(true);
 };
    return (
      <StudentShell fullWidth>
        <div className="hb-course">


            <div className="hb-course__container">
                <CourseHero
                    studentName={identity.name}
                    avatarUrl={identity.avatarUrl}
                    levelIn={mode === "all" ? "0" : "—"}
                    levelCurrent={mode === "all" ? "HSK2" : registered?.educationLevelCode || "—"}
                    levelGoal={mode === "all" ? "HSK5" : "—"}
                    variant={mode}
                    currentCourseCode={mode === "all" ? currentCourse?.cardLabel : registered?.code}
                />

                <div className="hb-course__layout" style={mode === "mine" ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}>
                    <button
                        type="button"
                        className={`hb-course__filter-backdrop${filterOpen ? ' hb-course__filter-backdrop--open' : ''}`}
                        aria-label="Đóng bộ lọc"
                        onClick={() => setFilterOpen(false)}
                    />
                    <div style={mode === "mine" ? { display: "none" } : undefined} className={`hb-course__filter-panel${filterOpen ? ' hb-course__filter-panel--open' : ''}`}>
                        <CourseFilterSidebar
                            value={filters}
                            onChange={setFilters}
                            studyFormCounts={studyFormCounts}
                            onClose={() => setFilterOpen(false)}
                        />
                    </div>

                    <main>
                        <div className="hb-course__toolbar">
                            <div className="hb-course__mode">
                                <div className="hb-course__mode-switch" role="tablist">
                                    {([
                                        { id: 'all', label: 'Tất cả khoá học' },
                                        { id: 'mine', label: 'Khoá học của tôi' },
                                    ] as const).map((item) => {
                                        const active = mode === item.id;
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                role="tab"
                                                aria-selected={active}
                                                className={`hb-course__mode-btn${active ? ' hb-course__mode-btn--active' : ''}`}
                                                onClick={() => setMode(item.id)}
                                            >
                                                <span className="hb-course__mode-btn-label">
                                                    {/* Ngôi sao bay từ trái chữ sang phải chữ khi hover/active */}
                                                    <img
                                                        className="hb-course__mode-star"
                                                        src="/assets/hocba/courses/ic-star-sm.svg"
                                                        alt=""
                                                    />
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
                                    {mode === 'all'
                                        ? 'Đang hiển thị toàn bộ khoá học'
                                        : 'Đang hiển thị khoá học đã sở hữu'}
                                </span>
                            </div>

                            <div className="hb-course__toolbar-actions" style={mode === "mine" ? { display: "none" } : undefined}>
                                <button
                                    type="button"
                                    className="hb-course__mobile-filter"
                                    aria-expanded={filterOpen}
                                    onClick={() => setFilterOpen(true)}
                                >
                                    <img src="/assets/hocba/courses/ic-filter.svg" alt="" width={12} height={12} />
                                    Bộ lọc
                                    {activeFilterCount > 0 && <span className="hb-course__mobile-filter-count">{activeFilterCount}</span>}
                                </button>
                                <select
                                    className="hb-course__sort"
                                    value={sort}
                                    onChange={(e) => setSort(e.target.value as SortId)}
                                    aria-label="Sắp xếp khoá học"
                                >
                                    <option value="newest">Mới nhất</option>
                                    <option value="oldest">Cũ nhất</option>
                                    <option value="price-asc">Giá tăng dần</option>
                                    <option value="price-desc">Giá giảm dần</option>
                                </select>
                            </div>
                        </div>

                        {mode === "mine" ? <RegisteredCourses /> : false ? (
                            <div className="hb-course__loading">
                                <div className="spinner-border text-danger" role="status" />
                            </div>
                        ) : visibleCourses.length === 0 ? (
                            <div className="hb-course__section">
                                <div className="hb-course__empty">Không có khoá học nào khớp với bộ lọc hiện tại.</div>
                            </div>
                        ) : (
                            COURSE_CATEGORIES.map((category) => (
                                <CourseSection
                                    key={category.id}
                                    category={category}
                                    courses={visibleCourses.filter((c) => c.category === category.id)}
                                    onOpen={openCourse}
                                    onExplore={() => setFilters({ ...filters, categories: [category.id] })}
                                />
                            ))
                        )}
                    </main>
                </div>
            </div>



            {selected && modalOpen && <CourseDetailModal key={selected.code}
                show={modalOpen}
                onHide={() => setModalOpen(false)}
                course={selected}
                detail={detail}
                isLoading={false}
            />}
        </div>
      </StudentShell>
    );
};
