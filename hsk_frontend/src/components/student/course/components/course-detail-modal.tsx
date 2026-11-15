/* eslint-disable @next/next/no-img-element */
import React, { useRef, useState } from 'react';
import Modal from '../../native-modal';
import { useNavigate } from '../../dashboard/preview-navigation';
import { all_routes } from '../../dashboard/preview-navigation';
import { stripHtml } from '../html-utils';
import { fallbackCourseImage, type CourseDetailData, type CourseVM, type DetailMaterial, type DetailSession } from '@/lib/student-course/course-view-model';

export type { CourseDetailData, DetailMaterial, DetailSession };

/** Thư mục icon export từ Figma */
const IC = '/assets/hocba/courses';

/** Khu học viên chưa có trang Thời khoá biểu riêng (route trỏ về chính trang Khoá học) thì ẩn nút "Vào thời khoá biểu". */
const HAS_TIMETABLE_PAGE = all_routes.studentTimetable !== all_routes.studentCourses;

interface Props {
    show: boolean;
    onHide: () => void;
    course: CourseVM | null;
    detail: CourseDetailData | null;
    isLoading?: boolean;
    /** Lỗi tải chi tiết (đã gọi API nhưng thất bại) */
    error?: string | null;
    onRetry?: () => void;
    /** Trang đăng ký/mở khoá (NEXT_PUBLIC_STUDENT_COURSE_UNLOCK_URL); trống thì nút mở hộp thông báo như bản xem trước */
    unlockUrl?: string;
    onViewClasses?: () => void;
}

const LockIcon = ({ size = 18 }: { size?: number }) => (
    <svg viewBox="0 0 14 16" width={size} height={size} fill="none" aria-hidden="true">
        <path
            d="M3.5 6.5V4.5a3.5 3.5 0 117 0M2.5 6.5h9a1 1 0 011 1v6a1 1 0 01-1 1h-9a1 1 0 01-1-1v-6a1 1 0 011-1z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

/** Số buổi hiển thị dạng khoá khi học viên chưa sở hữu khoá học. */
const LOCKED_PREVIEW_SESSIONS = 5;

/**
 * Cho phép giữ chuột kéo ngang danh sách buổi học thay vì phải dùng thanh cuộn.
 * Dùng Pointer Events + pointer capture để con trỏ đi ra ngoài phần tử vẫn kéo tiếp,
 * và để thao tác chạm trên tablet dùng chung một đường code.
 */
const useDragScroll = () => {
    const ref = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);
    const origin = useRef({ x: 0, scrollLeft: 0 });

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        const el = ref.current;
        // Chỉ nhận chuột trái; bỏ qua touch để trình duyệt giữ quán tính cuộn gốc.
        if (!el || e.pointerType === 'touch' || e.button !== 0) return;
        origin.current = { x: e.clientX, scrollLeft: el.scrollLeft };
        setDragging(true);
        el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const el = ref.current;
        if (!el || !dragging) return;
        e.preventDefault();
        el.scrollLeft = origin.current.scrollLeft - (e.clientX - origin.current.x);
    };

    const stop = (e: React.PointerEvent<HTMLDivElement>) => {
        const el = ref.current;
        if (!el || !dragging) return;
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        setDragging(false);
    };

    return {
        ref,
        className: `hb-course-modal__sessions${dragging ? ' hb-course-modal__sessions--dragging' : ''}`,
        onPointerDown,
        onPointerMove,
        onPointerUp: stop,
        onPointerCancel: stop,
    };
};

const CourseDetailModal: React.FC<Props> = ({ show, onHide, course, detail, isLoading, error, onRetry, unlockUrl, onViewClasses }) => {
    const navigate = useNavigate();
    const [tab, setTab] = useState<'syllabus' | 'materials'>('syllabus');
    const syllabusDrag = useDragScroll();
    const lockedDrag = useDragScroll();

    if (!course) return null;

    const owned = course.owned;
    const progress = course.progress;
    const progressLabel = progress >= 100 ? 'Hoàn thành' : progress > 0 ? 'Đang học' : 'Chưa học';

    const title = stripHtml(detail?.title || course.title);
    const description = stripHtml(detail?.description || course.description || "");
    const totalSessions = detail?.totalSessions || course.totalSessions;

    // Chưa sở hữu: chỉ hiện tên các buổi đầu (backend không trả nội dung), không có thì vài ô khoá trống.
    const previewTopics = detail?.previewTopics ?? [];
    const lockedSessions = (previewTopics.length > 0 ? previewTopics : Array.from({ length: Math.min(LOCKED_PREVIEW_SESSIONS, totalSessions || LOCKED_PREVIEW_SESSIONS) }, () => ''))
        .map((topic, i) => ({ id: `locked-${i}`, label: `Buổi ${i + 1}`, topic: topic || 'Nội dung bị khoá' }));

    const syllabusEmptyText = detail?.syllabusStatus === 'UNAVAILABLE'
        ? 'Không tải được lộ trình từ hệ thống đào tạo, vui lòng thử lại sau.'
        : 'Chưa có dữ liệu lộ trình cho khoá học này.';
    const errorBlock = error ? (
        <div className="hb-course__empty" role="alert">
            {error}
            {onRetry && (
                <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={onRetry}>
                    Thử lại
                </button>
            )}
        </div>
    ) : null;
    const loadingBlock = (
        <div className="hb-course__loading">
            <div className="spinner-border text-danger" role="status" aria-label="Đang tải" />
        </div>
    );

    return (
        <Modal
            show={show}
            onHide={onHide}
            // Không dùng `centered`: khi modal cao hơn viewport, kiểu căn giữa làm nó
            // tràn cả lên trên — phần tràn đó không cuộn tới được nên ảnh bị cắt.
            size="xl"
            // Style toàn cục của repo có z-index tới 999999 (header, mega menu…),
            // modal mặc định của Bootstrap chỉ 1055 nên bị đè. Nâng lên qua 2 class này.
            className="hb-course-modal-root"
            dialogClassName="hb-course-modal"
            backdrop
        >
            <div className="hb-course-modal__head">
                <button type="button" className="hb-course-modal__dismiss" onClick={onHide} aria-label="Đóng chi tiết khóa học">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
                        <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                </button>
                <div className="hb-course-modal__head-copy">
                    <div className="hb-course-modal__tags">
                        <span className="hb-course-modal__tag">{course.category === 'hsk' ? 'HSK' : course.cardLabel}</span>
                        <span className={`hb-course__status hb-course__status--${owned ? 'owned' : 'locked'}`}>
                            {owned ? (
                                <>
                                    <img src="/assets/hocba/courses/ic-check.svg" alt="" width={13} height={13} />
                                    Đã sở hữu
                                </>
                            ) : (
                                <>
                                    <svg viewBox="0 0 16 16" width={13} height={13} fill="none" aria-hidden="true">
                                        <circle cx="8" cy="8" r="8" fill="#fff" fillOpacity=".9" />
                                        <path d="M5.5 5.5l5 5m0-5l-5 5" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" />
                                    </svg>
                                    {course.registered===null?"Chưa xác định đăng ký":course.registered?"Đã đăng ký":"Chưa đăng ký"}
                                </>
                            )}
                        </span>
                    </div>

                    <h2 className="hb-course-modal__title">{title}</h2>
                    <p className="hb-course-modal__desc">{description}</p>

                    <div className="hb-course-modal__levels">
                        <span className="hb-course-modal__level">
                            <svg viewBox="0 0 16 16" width={16} height={16} fill="none" aria-hidden="true">
                                <circle cx="8" cy="8" r="6.6" stroke="currentColor" strokeWidth="1.4" />
                                <circle cx="8" cy="8" r="1.8" fill="currentColor" />
                            </svg>
                            Đầu vào
                            <span className="hb-course-modal__level-pill">{course.levelIn || '—'}</span>
                        </span>
                        <span className="hb-course-modal__level">
                            <svg viewBox="0 0 16 16" width={16} height={16} fill="none" aria-hidden="true">
                                <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                                <circle cx="8" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.4" />
                            </svg>
                            Đầu ra
                            <span className="hb-course-modal__level-pill">{course.levelOut || '—'}</span>
                        </span>
                    </div>

                    <div className="hb-course-modal__meta">
                        {/* Icon export thẳng từ Figma, giữ nguyên tỉ lệ gốc từng cái */}
                        <span className="hb-course-modal__meta-item">
                            <img src={`${IC}/ic-meta-sessions.svg`} alt="" width={27} height={27} />
                            {totalSessions} buổi học
                        </span>
                        <span className="hb-course-modal__meta-item">
                            <img src={`${IC}/ic-meta-months.svg`} alt="" width={24} height={27} />
                            {course.months ? `${course.months} tháng` : 'Chưa có thời lượng'}
                        </span>
                        <span className="hb-course-modal__meta-item">
                            <img src={`${IC}/ic-meta-hours.svg`} alt="" width={26.667} height={26.667} />
                            {course.hoursPerSession ? `${course.hoursPerSession}h/buổi` : 'Chưa có số giờ/buổi'}
                        </span>
                    </div>
                </div>

                <img className="hb-course-modal__thumb" src={course.image} alt={course.title} onError={(e) => fallbackCourseImage(e, course.category)} />
            </div>

            <div className="hb-course-modal__body">
                {owned ? (
                    <>
                        <div className="hb-course-modal__tabs">
                            <button
                                type="button"
                                className={`hb-course-modal__tab${tab === 'syllabus' ? ' hb-course-modal__tab--active' : ''}`}
                                onClick={() => setTab('syllabus')}
                            >
                                <svg viewBox="0 0 16 18" width={16} height={18} fill="none" aria-hidden="true">
                                    <path d="M8 1c3 0 5.5 2.4 5.5 5.4C13.5 10.6 8 17 8 17S2.5 10.6 2.5 6.4C2.5 3.4 5 1 8 1z" stroke="currentColor" strokeWidth="1.5" />
                                    <circle cx="8" cy="6.4" r="1.9" fill="currentColor" />
                                </svg>
                                Lộ trình học tập
                            </button>
                            <button
                                type="button"
                                className={`hb-course-modal__tab${tab === 'materials' ? ' hb-course-modal__tab--active' : ''}`}
                                onClick={() => setTab('materials')}
                            >
                                <svg viewBox="0 0 18 16" width={18} height={16} fill="none" aria-hidden="true">
                                    <path d="M1 3a2 2 0 012-2h3.2l1.6 2H15a2 2 0 012 2v8a2 2 0 01-2 2H3a2 2 0 01-2-2V3z" fill="currentColor" />
                                </svg>
                                Tài liệu khoá học
                            </button>
                        </div>

                        {tab === 'syllabus' ? (
                            <>
                                <div className="hb-course-modal__progress-bar">
                                    <div className="hb-course-modal__progress-info">
                                        <div className="hb-course-modal__progress-label">
                                            <span>{progressLabel}</span>
                                            <span>{progress}%</span>
                                        </div>
                                        <div className="hb-course__progress-track">
                                            <div
                                                className={`hb-course__progress-fill${progress >= 100 ? ' hb-course__progress-fill--done' : ''}`}
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>
                                    {HAS_TIMETABLE_PAGE && (
                                    <button
                                        type="button"
                                        className="hb-course-modal__timetable-btn"
                                        onClick={() => navigate(all_routes.studentTimetable)}
                                    >
                                        <svg viewBox="0 0 20 20" width={20} height={20} fill="none" aria-hidden="true">
                                            <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" />
                                            <path d="M7 10h6m-2.4-2.6L13.2 10l-2.6 2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        Vào thời khoá biểu
                                    </button>
                                    )}
                                </div>

                                {isLoading ? loadingBlock : errorBlock ?? (
                                    <div {...syllabusDrag}>
                                        {(detail?.sessions ?? []).map((s) => (
                                            <article className="hb-course-modal__session" key={s.id}>
                                                <header className="hb-course-modal__session-head">
                                                    <span className="hb-course-modal__session-no">{s.label}</span>
                                                    <span className="hb-course-modal__session-topic">{stripHtml(s.topic)}</span>
                                                </header>
                                                <div className="hb-course-modal__session-body">{stripHtml(s.content)}</div>
                                            </article>
                                        ))}
                                        {(detail?.sessions ?? []).length === 0 && (
                                            <div className="hb-course__empty">{syllabusEmptyText}</div>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            isLoading ? loadingBlock : errorBlock ?? (
                            <div className="hb-course-modal__materials">
                                {(detail?.materials ?? []).map((m) => (
                                    <div className="hb-course-modal__material" key={m.id}>
                                        {m.url ? (
                                            <a href={m.url} target="_blank" rel="noopener noreferrer">• {m.title}</a>
                                        ) : (
                                            <span>• {m.title}</span>
                                        )}
                                    </div>
                                ))}
                                {(detail?.materials ?? []).length === 0 && (
                                    <div className="hb-course__empty">Khoá học chưa có tài liệu đính kèm.</div>
                                )}
                            </div>
                            )
                        )}
                    </>
                ) : (
                    <>
                        {course.registered && onViewClasses ? <button type="button" className="hb-course-modal__unlock-banner" onClick={onViewClasses}>Xem các lớp của tôi</button> : unlockUrl ? (
                            <a className="hb-course-modal__unlock-banner text-decoration-none" href={unlockUrl} target="_blank" rel="noopener noreferrer">
                                <LockIcon />
                                Mở khoá ngay!
                            </a>
                        ) : (
                            <button type="button" className="hb-course-modal__unlock-banner" onClick={() => navigate("Đăng ký khóa học")}>
                                <LockIcon />
                                Mở khoá ngay!
                            </button>
                        )}

                        <div {...lockedDrag}>
                            {lockedSessions.map((s) => (
                                <article className="hb-course-modal__session hb-course-modal__session--locked" key={s.id}>
                                    <header className="hb-course-modal__session-head">
                                        <span className="hb-course-modal__session-no">{s.label}</span>
                                        <span className="hb-course-modal__session-topic">{s.topic}</span>
                                    </header>
                                    <div className="hb-course-modal__session-body">
                                        <img src="/assets/hocba/courses/ic-lock-lg.svg" alt="" width={52} height={52} />
                                    </div>
                                </article>
                            ))}
                        </div>
                    </>
                )}

                <div className="hb-course-modal__foot">
                    <button type="button" className="hb-course-modal__close" onClick={onHide}>
                        Đóng
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default CourseDetailModal;
