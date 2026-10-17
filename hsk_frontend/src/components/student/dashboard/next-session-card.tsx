import React from 'react'
import { Link, useNavigate } from './preview-navigation'
import { useTranslation } from './translations'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import ImageWithBasePath from './image'
import { all_routes } from './preview-navigation'
import { StudentTimetableItem } from './sample-data'

dayjs.locale('vi');

interface NextSessionCardProps {
  session: StudentTimetableItem | null;
  loading?: boolean;
  onJoin: (session: StudentTimetableItem | null) => void;
}

const formatDateText = (session: StudentTimetableItem) => {
  const dateVal = session.date || session.session_date;
  if (!dateVal) return "Chưa có ngày";
  const d = dayjs(dateVal);
  return d.isValid() ? d.format('dddd, D [tháng] M YYYY') : String(dateVal);
};

const formatTimeText = (session: StudentTimetableItem) => {
  let start = session.start_time || "";
  let end = session.end_time || "";
  if (start.includes("T")) start = dayjs(start).format("HH:mm");
  else if (start.length >= 5) start = start.slice(0, 5);

  if (end.includes("T")) end = dayjs(end).format("HH:mm");
  else if (end.length >= 5) end = end.slice(0, 5);

  if (start && end) return `${start} - ${end}`;
  if (start) return start;
  return "Chưa xếp giờ";
};

const NextSessionCard: React.FC<NextSessionCardProps> = ({ session, loading, onJoin }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleButtonClick = () => {
    if (session) {
      onJoin(session);
    } else {
      navigate(all_routes.studentTimetable);
    }
  };

  return (
    <div className="premium-card h-100 next-session-card">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h4 className="modern-title mb-0 text-dark d-flex align-items-center gap-2">
          <span className="widget-head-icon is-badge-image">
            <ImageWithBasePath src="assets/hocba/dashboard/Overlay6.png" alt="" />
          </span>{" "}
          {t('student.nextSession', 'Buổi học tiếp theo')}
        </h4>
        <Link to={all_routes.studentTimetable} className="mini-card-link">
          {t('student.detail', 'Chi tiết')} &gt;
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="spinner-border spinner-border-sm text-danger" role="status" />
        </div>
      ) : session ? (
        <div className="d-flex flex-column justify-content-between flex-grow-1">
          <div className="next-session-info-panel">
            <p className="next-session-title">{session.title || session.class_name || `Buổi ${session.session_no || ''}`}</p>
            <div className="next-session-meta">
              <span>
                <i aria-hidden="true" className="fa-regular fa-calendar me-2" />
                {formatDateText(session)}
              </span>
              <span>
                <i aria-hidden="true" className="fa-regular fa-clock me-2" />
                {formatTimeText(session)}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-danger w-100 rounded-pill py-2.5 fw-bold next-session-btn mt-3"
            onClick={handleButtonClick}
          >
            <i aria-hidden="true" className="isax isax-arrow-circle-right me-2" /> {t('student.joinClassNow', 'Vào lớp ngay!')}
          </button>
        </div>
      ) : (
        <div className="d-flex flex-column justify-content-between flex-grow-1">
          <div className="text-center py-4 text-muted next-session-empty">
            <i aria-hidden="true" className="fa-regular fa-calendar-xmark fs-2 d-block mb-2 opacity-50 text-danger" />
            {t('student.noUpcomingSession', 'Chưa có buổi học tiếp theo')}
          </div>
          <button
            type="button"
            className="btn btn-danger w-100 rounded-pill py-2.5 fw-bold next-session-btn mt-auto"
            onClick={() => navigate(all_routes.studentTimetable)}
          >
            <i aria-hidden="true" className="isax isax-calendar me-2" /> {t('student.viewTimetable', 'Xem thời khóa biểu')}
          </button>
        </div>
      )}
    </div>
  )
}

export default NextSessionCard
