import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from './preview-navigation'
import { useTranslation } from './translations'
import { useStudentData, useStudentIdentity, DataStatus } from '../student-data'
import { courseStats } from '../student-model'
import dayjs from 'dayjs'
import ImageWithBasePath from './image'
import { all_routes } from './preview-navigation'
import { StudentTimetableItem } from './sample-data'

interface CourseProgressRingProps {
  percent: number;
  size?: number;
  label?: string;
}

const CourseProgressRing: React.FC<CourseProgressRingProps> = ({ percent, size = 100, label = 'hoàn thành' }) => {
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="course-progress-ring">
      <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} className="ring-track" fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} className="ring-value" fill="none"
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        transform={`translate(${size / 2} ${size / 2}) scale(-1 1) rotate(-90) translate(${-size / 2} ${-size / 2})`}
      />
      <text x="50%" y="44%" textAnchor="middle" dominantBaseline="central" className="ring-text">
        {percent % 1 === 0 ? percent : percent.toFixed(1)}%
      </text>
      <text x="50%" y="62%" textAnchor="middle" dominantBaseline="central" className="ring-subtext">
        {label}
      </text>
    </svg>
  );
};

interface DashboardHeroHeaderProps {
  timetableData?: StudentTimetableItem[];
  courseNameMap?: Record<string, string>;
  onContinueLearning?: () => void;
}

interface TruncatedTextProps {
  as: 'h3' | 'h4';
  className: string;
  text: string;
  tooltipText: string;
}

const TruncatedText: React.FC<TruncatedTextProps> = ({ as: Element, className, text, tooltipText }) => {
  const textRef = useRef<HTMLElement | null>(null);
  const tooltipId = useId();
  const [isTruncated, setIsTruncated] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  const openTooltip = () => {
    const bounds = textRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const maxTooltipWidth = Math.min(340, window.innerWidth - 24);
    setTooltipPosition({
      top: bounds.top - 8,
      left: Math.max(12, Math.min(bounds.left, window.innerWidth - maxTooltipWidth - 12)),
    });
    setIsTooltipOpen(true);
  };

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element) return;

    const measure = () => {
      setIsTruncated(element.scrollWidth > element.clientWidth + 1);
    };

    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : undefined;
    observer?.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [text]);

  useEffect(() => {
    if (!isTooltipOpen) return;
    const reposition = () => {
      const bounds = textRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const maxTooltipWidth = Math.min(340, window.innerWidth - 24);
      setTooltipPosition({
        top: bounds.top - 8,
        left: Math.max(12, Math.min(bounds.left, window.innerWidth - maxTooltipWidth - 12)),
      });
    };
    const dismissOnOutsideTap = (event: PointerEvent) => {
      if (!textRef.current?.contains(event.target as Node)) setIsTooltipOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsTooltipOpen(false);
    };
    document.addEventListener('pointerdown', dismissOnOutsideTap);
    document.addEventListener('keydown', dismissOnEscape);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('pointerdown', dismissOnOutsideTap);
      document.removeEventListener('keydown', dismissOnEscape);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [isTooltipOpen]);

  return (
    <Element
      ref={(node) => { textRef.current = node; }}
      className={`hero-overflow-tooltip-target ${className}`}
      data-truncated={isTruncated || undefined}
      data-tooltip-open={isTooltipOpen || undefined}
      tabIndex={isTruncated ? 0 : undefined}
      aria-describedby={isTruncated ? tooltipId : undefined}
      onPointerEnter={(event) => {
        if (isTruncated && event.pointerType === 'mouse') openTooltip();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setIsTooltipOpen(false);
      }}
      onPointerDown={(event) => {
        if (isTruncated && event.pointerType === 'touch') {
          if (isTooltipOpen) setIsTooltipOpen(false);
          else openTooltip();
        }
      }}
      onFocus={() => { if (isTruncated) openTooltip(); }}
      onBlur={() => setIsTooltipOpen(false)}
    >
      {text}
      {isTruncated && isTooltipOpen && createPortal(
        <span
          id={tooltipId}
          className="hero-overflow-tooltip"
          role="tooltip"
          style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
        >
          {tooltipText}
        </span>,
        document.querySelector('.student-dashboard-wrapper') ?? document.body,
      )}
    </Element>
  );
};

const DashboardHeroHeader: React.FC<DashboardHeroHeaderProps> = ({ onContinueLearning }) => {
  const { t } = useTranslation();
  const { classes } = useStudentData();
  const identity = useStudentIdentity();
  const userInfo = { name: identity.name, username: identity.name, avatarUrl: identity.avatarUrl, avatar_url: "", avatar: "" };
  const fullName = userInfo?.name?.trim() || userInfo?.username?.trim() || '';
  const displayName = fullName || t('student.defaultStudentName');
  const givenName = displayName;
  const greeting = t('student.welcomeGreeting', { name: givenName });
  const DEFAULT_AVATAR = 'assets/figma-home/0e447.png';
  const rawAvatar = userInfo?.avatarUrl || userInfo?.avatar_url || userInfo?.avatar;
  const avatarSrc = rawAvatar && rawAvatar.trim() !== '' ? rawAvatar : DEFAULT_AVATAR;

  const active = classes.data?.find(course => course.lifecycleStatus !== "COMPLETED") ?? classes.data?.[0];
  const stats = courseStats(active);
  const sessionDates = (active?.sessions ?? []).map(session => session.startAt).filter((date): date is string => !!date).sort();
  const courseData = { name: active?.code || active?.syllabusName || "Chưa có lớp học", startDate: active?.startDate ? dayjs(active.startDate).format("DD/MM/YYYY") : "—", endDate: sessionDates.length ? dayjs(sessionDates[sessionDates.length - 1]).format("DD/MM/YYYY") : "—", completedSessions: stats.completed, totalSessions: stats.total, percent: stats.percent, remainingSessions: stats.total - stats.completed, currentLevel: active?.educationLevelCode || "—" };

  const levelTrack = {
    entry: '—',
    current: courseData.currentLevel,
    target: '—'
  };

  return (
    <div className="student-hero-card">
      {(classes.loading || classes.error) && <div style={{ gridColumn: "1 / -1" }}><DataStatus state={classes} /></div>}
      <div className="student-hero-left">
        <span className="student-hero-avatar">
          <ImageWithBasePath src={avatarSrc} alt={displayName} />
        </span>
        <div className="student-hero-left-text">
          <TruncatedText as="h3" className="student-hero-greeting" text={greeting} tooltipText={displayName} />
          <div className="student-hero-level-track">
            <span className="level-track-line" />
            <div className="level-point">
              <span className="level-point-marker"><ImageWithBasePath src="assets/hocba/dashboard/hero-level-entry.png" alt="" /></span>
              <span className="level-label">{t('student.levelEntry')}</span>
              <span className="level-value">{levelTrack.entry}</span>
            </div>
            <div className="level-point">
              <span className="level-point-marker"><ImageWithBasePath src="assets/hocba/dashboard/level-middle.png" alt="" /></span>
              <span className="level-label">{t('student.levelCurrent')}</span>
              <span className="level-value">{levelTrack.current}</span>
            </div>
            <div className="level-point">
              <span className="level-point-marker"><ImageWithBasePath src="assets/hocba/dashboard/hero-level-target.png" alt="" /></span>
              <span className="level-label">{t('student.levelTarget')}</span>
              <span className="level-value">{levelTrack.target}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="student-hero-right">
        <div className="student-hero-mini-card student-hero-course-card">
          <div className="mini-card-title">
            <i aria-hidden="true" className="isax isax-play5" /> {t('student.currentCourse', 'Khoá Đang Học')}
          </div>
          <TruncatedText as="h4" className="mini-card-value" text={courseData.name} tooltipText={courseData.name} />
          <div className="student-hero-course-dates">
            <span><i aria-hidden="true" className="isax isax-flag5" /> {t('student.courseStart', { date: courseData.startDate, defaultValue: `Khai giảng: ${courseData.startDate}` })}</span>
            <span><i aria-hidden="true" className="isax isax-flag-2" /> {t('student.courseEnd', { date: courseData.endDate, defaultValue: `Kết thúc: ${courseData.endDate}` })}</span>
          </div>
        </div>

        <div className="student-hero-mini-card student-hero-progress-card">
          <CourseProgressRing percent={courseData.percent} label={t('student.courseComplete', 'hoàn thành')} />
          <div className="mini-card-progress-info">
          <div className="mini-card-title">
              {t('student.courseProgress', 'Tiến Độ Khoá')}
          </div>
            <span className="mini-card-fraction">
              {courseData.completedSessions}<small> / {courseData.totalSessions}</small>
            </span>
            <span className="mini-card-sessions-left">
              <i aria-hidden="true" className="isax isax-arrow-right-1" /> {t('student.sessionsLeft', { count: courseData.remainingSessions, defaultValue: `Còn ${courseData.remainingSessions} buổi kết thúc` })}
            </span>
            <Link to={all_routes.studentTimetable} className="mini-card-detail-btn">
              {t('student.detail')} <i aria-hidden="true" className="isax isax-arrow-right-3" />
            </Link>
          </div>
        </div>
      </div>
      <Link
        to={all_routes.studentTimetable}
        className="student-hero-continue-btn"
        onClick={(event) => {
          if (!onContinueLearning) return;
          event.preventDefault();
          onContinueLearning();
        }}
      >
        {t('student.dashboardContinueLearning', 'Tiếp tục luyện')}
        <i aria-hidden="true" className="isax isax-arrow-right-3" />
      </Link>
    </div>
  )
}

export default DashboardHeroHeader
