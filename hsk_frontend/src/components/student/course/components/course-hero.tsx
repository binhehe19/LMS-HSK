/* eslint-disable @next/next/no-img-element */
import React from 'react';

const IMG = '/assets/hocba/courses';

interface Props {
    /** Tên hiển thị của học viên, mặc định giữ nguyên placeholder trong Figma */
    studentName?: string;
    avatarUrl?: string;
    levelIn: string;
    levelCurrent: string;
    levelGoal: string;
    /**
     * Quyết định biến thể banner — bám theo chế độ đang chọn, KHÔNG bám theo việc
     * có tìm được khoá đang học hay không (node 3362:9524 vs 3484:13133).
     */
    variant: 'all' | 'mine';
    /** Mã khoá hiển thị trong pill ở biến thể "Khoá học của tôi" */
    currentCourseCode?: string;
    /** Nhãn ưu đãi trên banner (NEXT_PUBLIC_STUDENT_COURSE_PROMO), ví dụ "20%"; trống thì ẩn cả dòng ưu đãi */
    promoLabel?: string;
}

/** 3 vệt tròn mờ trang trí, dùng chung cho cả 2 biến thể panel mascot. */
const Blobs = () => (
    <>
        <img className="hb-course__hero-blob hb-course__hero-blob--lg" src={`${IMG}/hero-blob-lg.svg`} alt="" />
        <img className="hb-course__hero-blob hb-course__hero-blob--md" src={`${IMG}/hero-blob-md.svg`} alt="" />
        <img className="hb-course__hero-blob hb-course__hero-blob--sm" src={`${IMG}/hero-blob-sm.svg`} alt="" />
    </>
);

const CourseHero: React.FC<Props> = ({
    studentName,
    avatarUrl,
    levelIn,
    levelCurrent,
    levelGoal,
    variant,
    currentCourseCode,
    promoLabel,
}) => {
    const mine = variant === 'mine';

    // Panel mascot: chế độ "Tất cả khoá học" nằm cột 1-2, "Khoá học của tôi" nằm cột 3-4.
    const mascotPanel = (
        <div className={`hb-course__hero-promo${mine ? ' hb-course__hero-promo--right' : ''}`}>
            <div className="hb-course__hero-promo-inner">
                {/* Tầng "Frame 1000005069" — gốc toạ độ của 3 vệt tròn trang trí */}
                <div className="hb-course__hero-promo-stage">
                    <Blobs />
                    <div className="hb-course__hero-mascot">
                        <img src={`${IMG}/hero-mascot.png`} alt="" />
                    </div>
                    <div className="hb-course__hero-promo-copy">
                    {mine ? (
                        <>
                            <div className="hb-course__hero-current-copy">
                                <h2 className="hb-course__hero-headline">Bạn đang học khoá học</h2>
                                {currentCourseCode && (
                                    <span className="hb-course__hero-current-code">{currentCourseCode}</span>
                                )}
                            </div>
                            <p className="hb-course__hero-current-note">
                                {levelGoal === "—" ? "Theo dõi lớp học và tiến độ của bạn tại đây." : `Cố lên nào , đích đến ${levelGoal} đang rất gần!`}
                            </p>
                        </>
                    ) : (
                        <>
                            <h2 className="hb-course__hero-headline">
                                KHÁM PHÁ CÁC KHOÁ HỌC
                                <br />
                                TIẾNG TRUNG TẠI HỌC BÁ
                            </h2>
                            {promoLabel && (
                            <div className="hb-course__hero-offer">
                                <span className="hb-course__hero-offer-label">ƯU ĐÃI</span>
                                <span className="hb-course__hero-offer-pill">
                                    <span>{promoLabel}</span>
                                </span>
                                <span className="hb-course__hero-offer-note">Học phí tháng này*</span>
                            </div>
                            )}
                        </>
                    )}
                    </div>
                </div>
            </div>
        </div>
    );

    const userPanel = (
        <div className={`hb-course__hero-user${mine ? ' hb-course__hero-user--left' : ''}`}>
            <img
                className="hb-course__hero-avatar"
                src={avatarUrl || '/assets/figma-home/0e447.png'}
                onError={(event) => { event.currentTarget.src = '/assets/figma-home/0e447.png'; }}
                alt=""
            />
            <div className="hb-course__hero-user-body">
                <h2 className="hb-course__hero-greeting">Xin chào {studentName || 'Học Bá'}!</h2>
                <div className="hb-course__hero-levels">
                    <span className="hb-course__hero-levels-label">Trình độ cá nhân</span>
                    <div className="hb-course__hero-track">
                        <div className="hb-course__hero-milestone">
                            <img className="hb-course__hero-milestone-icon" src={`${IMG}/ic-level-in.svg`} alt="" width={16} height={22} />
                            <span className="hb-course__hero-milestone-name">Đầu vào</span>
                            <span className="hb-course__hero-milestone-value">{levelIn}</span>
                        </div>
                        <div className="hb-course__hero-milestone">
                            <span className="hb-course__hero-milestone-dot">
                                <svg viewBox="0 0 16 16" width={16} height={16} fill="none" aria-hidden="true">
                                    {/* Vòng ngoài đứng yên */}
                                    <circle cx="8" cy="8" r="6.7" stroke="#fff" strokeWidth="1.4" />
                                    {/* Chấm trong phình ra lấp đầy vòng rồi thu về tâm */}
                                    <circle className="hb-course__hero-dot-core" cx="8" cy="8" r="1.7" fill="#fff" />
                                </svg>
                                <svg viewBox="0 0 4 4" width={4} height={4} aria-hidden="true">
                                    <circle cx="2" cy="2" r="2" fill="#fff" />
                                </svg>
                            </span>
                            <span className="hb-course__hero-milestone-name">Hiện tại</span>
                            <span className="hb-course__hero-milestone-value">{levelCurrent}</span>
                        </div>
                        <div className="hb-course__hero-milestone">
                            <img className="hb-course__hero-milestone-icon" src={`${IMG}/ic-level-goal.svg`} alt="" width={16} height={22} />
                            <span className="hb-course__hero-milestone-name">Mục tiêu</span>
                            <span className="hb-course__hero-milestone-value">{levelGoal}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="hb-course__hero">
            {mine ? userPanel : mascotPanel}
            {mine ? mascotPanel : userPanel}
        </div>
    );
};

export default CourseHero;
