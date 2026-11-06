/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useRef, useState } from 'react';
import { CourseCategory } from '../data/catalog-courses';
import { fallbackCourseImage, type CourseVM } from '@/lib/student-course/course-view-model';

const IC = '/assets/hocba/courses';

export type { CourseVM };

const progressTone = (progress: number) => {
    if (progress >= 100) return { label: 'Hoàn thành', modifier: 'done' };
    if (progress > 0) return { label: 'Đang học', modifier: '' };
    return { label: 'Chưa học', modifier: 'idle' };
};

interface CourseCardProps {
    course: CourseVM;
    onOpen: (course: CourseVM) => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({ course, onOpen }) => {
    const tone = progressTone(course.progress);

    return (
        <article
            className={`hb-course__card${course.owned ? '' : ' hb-course__card--locked'}`}
            onClick={() => onOpen(course)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen(course);
                }
            }}
        >
            <div className="hb-course__card-media">
                <img src={course.image} alt={course.title} loading="lazy" onError={(e) => fallbackCourseImage(e, course.category)} />
                {/* Figma làm mờ ảnh bằng lớp phủ trắng 60%, không phải giảm opacity ảnh */}
                {!course.owned && <span className="hb-course__card-veil" aria-hidden="true" />}
            </div>

            <div className="hb-course__card-body">
                <div className="hb-course__card-head">
                    <h3 className="hb-course__card-title">
                        <span className="hb-course__card-title-prefix">KHOÁ</span>
                        <span>{course.cardLabel}</span>
                    </h3>

                    {course.owned ? (
                        <span className="hb-course__status hb-course__status--owned">
                            <img src={`${IC}/ic-check.svg`} alt="" width={13} height={13} />
                            Đã sở hữu
                        </span>
                    ) : (
                        <span className="hb-course__status hb-course__status--locked">
                            <svg viewBox="0 0 16 16" width={13} height={13} fill="none" aria-hidden="true">
                                <circle cx="8" cy="8" r="8" fill="#fff" fillOpacity=".9" />
                                <path d="M5.5 5.5l5 5m0-5l-5 5" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" />
                            </svg>
                            <img className="hb-course__mobile-lock-icon" src={`${IC}/ic-lock.svg`} alt="" />
                            <span className="hb-course__desktop-label">Chưa sở hữu</span>
                            <span className="hb-course__mobile-label">Mở khoá ngay!</span>
                        </span>
                    )}
                </div>

                {course.owned ? (
                    <>
                        <div className="hb-course__progress">
                            <div className={`hb-course__progress-row${tone.modifier ? ` hb-course__progress-row--${tone.modifier}` : ''}`}>
                                <span>{tone.label}</span>
                                <span>{course.progress}%</span>
                            </div>
                            <div className="hb-course__progress-track">
                                <div
                                    className={`hb-course__progress-fill${course.progress >= 100 ? ' hb-course__progress-fill--done' : ''}`}
                                    style={{ width: `${course.progress}%` }}
                                />
                            </div>
                        </div>

                        <div className="hb-course__card-foot">
                            <button
                                type="button"
                                className="hb-course__card-link"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpen(course);
                                }}
                            >
                                Chi tiết
                                {/* Hover đổi sang bản icon trắng (node 2890:9538) */}
                                <span className="hb-course__swap-icon" aria-hidden="true">
                                    <img className="hb-course__swap-icon-base" src={`${IC}/ic-arrow-right.svg`} alt="" />
                                    <img className="hb-course__swap-icon-hover" src={`${IC}/ic-arrow-right-w.svg`} alt="" />
                                </span>
                            </button>
                            <div className="hb-course__card-count">
                                <b>{course.doneSessions}</b>
                                <b>/</b>
                                <span>{course.totalSessions} Buổi học</span>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="hb-course__progress">
                            <div className="hb-course__progress-row hb-course__progress-row--idle">
                                <span>
                                    <span className="hb-course__desktop-label">Bạn chưa sở hữu khoá học này!</span>
                                    <span className="hb-course__mobile-label">Chưa học</span>
                                </span>
                                <span>0%</span>
                            </div>
                            <div className="hb-course__progress-track">
                                <div className="hb-course__progress-fill" style={{ width: '0%' }} />
                            </div>
                        </div>

                        <button
                            type="button"
                            className="hb-course__unlock"
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpen(course);
                            }}
                        >
                            {/* Figma có sẵn 2 variant: khoá đóng và khoá mở nghiêng -17.03°.
                                Xếp chồng rồi đổi opacity khi hover thay vì xoay 1 icon. */}
                            <span className="hb-course__lock" aria-hidden="true">
                                <img className="hb-course__lock-closed" src={`${IC}/ic-lock.svg`} alt="" />
                                <img className="hb-course__lock-open" src={`${IC}/ic-lock-open.svg`} alt="" />
                            </span>
                            Mở khoá ngay!
                        </button>
                        <div className="hb-course__card-foot hb-course__card-foot--mobile-locked">
                            <button type="button" className="hb-course__card-link" onClick={(e) => { e.stopPropagation(); onOpen(course); }}>
                                Chi tiết <img src={`${IC}/ic-arrow-right.svg`} alt="" width={10} height={10} />
                            </button>
                            <div className="hb-course__card-count">
                                <b>{course.doneSessions}</b><b>/</b><span>{course.totalSessions} Buổi học</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </article>
    );
};

interface CourseSectionProps {
    category: CourseCategory;
    courses: CourseVM[];
    onOpen: (course: CourseVM) => void;
    onExplore: () => void;
}

export const CourseSection: React.FC<CourseSectionProps> = ({ category, courses, onOpen, onExplore }) => {
    const gridRef = useRef<HTMLDivElement>(null);
    const [scrollProgress, setScrollProgress] = useState(0);

    useEffect(() => {
        const grid = gridRef.current;
        if (!grid) return;
        const update = () => setScrollProgress(grid.scrollLeft / Math.max(1, grid.scrollWidth - grid.clientWidth));
        grid.addEventListener('scroll', update, { passive: true });
        update();
        return () => grid.removeEventListener('scroll', update);
    }, [courses.length]);

    if (courses.length === 0) return null;

    return (
        <section className="hb-course__section">
            <div className="hb-course__section-head">
                <div className="hb-course__section-head-left">
                    <span className={`hb-course__section-badge hb-course__section-badge--${category.tone}`}>
                        {category.badgeLabel}
                    </span>
                    <h2 className={`hb-course__section-title hb-course__section-title--${category.tone}`}>
                        <span className="hb-course__desktop-label">{category.sectionTitle}</span>
                        <span className="hb-course__mobile-label">{category.mobileTitle}</span>
                    </h2>
                </div>
                <button type="button" className="hb-course__section-more" onClick={onExplore}>
                    {/* Hover đổi sang bản icon trắng (node 3429:17858) */}
                    <span className="hb-course__swap-icon" aria-hidden="true">
                        <img className="hb-course__swap-icon-base" src={`${IC}/ic-search.svg`} alt="" />
                        <img className="hb-course__swap-icon-hover" src={`${IC}/ic-search-w.svg`} alt="" />
                    </span>
                    Tìm hiểu
                </button>
            </div>

            <div className="hb-course__grid" ref={gridRef} aria-label={`Khoá học ${category.sectionTitle}`}>
                {courses.map((course) => (
                    <CourseCard key={course.id} course={course} onOpen={onOpen} />
                ))}
            </div>
            <div className="hb-course__scroll-track" aria-hidden="true">
                <span style={{ transform: `translateX(${scrollProgress * 124}px)` }} />
            </div>
        </section>
    );
};
