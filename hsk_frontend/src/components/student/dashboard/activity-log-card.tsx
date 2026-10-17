import React, { useEffect, useState } from 'react'
import { Link } from './preview-navigation'
import { useTranslation } from './translations'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/vi'
import { Spinner } from './image'
import ImageWithBasePath from './image'
import { all_routes } from './preview-navigation'

dayjs.extend(relativeTime);
dayjs.locale('vi');

export interface ActivityLogEntry {
  id: string;
  title: string;
  icon: string;
  lastActivityAt?: string;
  timeLabel?: string;
  onResume: () => void;
}

interface ActivityLogCardProps {
  items: ActivityLogEntry[];
  loading?: boolean;
}

const ActivityLogCard: React.FC<ActivityLogCardProps> = ({ items, loading }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let wasMobile = false;
    const onResize = () => {
      const isMobile = window.innerWidth <= 767;
      if (isMobile === wasMobile) return;
      wasMobile = isMobile;
      setExpanded(!isMobile);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className={`modern-sidebar activity-log-card${expanded ? ' is-open' : ''}`}>
      <div className="activity-log-header">
        <h6>
          <button type="button" className="activity-log-toggle" aria-expanded={expanded} aria-controls="student-activity-log-content" onClick={() => setExpanded((value) => !value)}>
            <span className="widget-head-icon is-badge-image"><ImageWithBasePath src="assets/hocba/dashboard/history.png" alt="" /></span>
            <span>{t('student.activityLog')}</span>
            <span className="activity-log-chevron" aria-hidden="true">›</span>
          </button>
        </h6>
        {expanded && <Link to={all_routes.studentQuiz} className="activity-log-detail-link">{t('student.detail')} <span aria-hidden="true">›</span></Link>}
      </div>

      <div id="student-activity-log-content" hidden={!expanded}>
        {loading ? (
          <div className="text-center py-3"><Spinner /></div>
        ) : items.length === 0 ? (
          <p className="activity-log-empty">{t('student.noActivityYet')}</p>
        ) : (
          <div className="activity-log-scroll" role="region" aria-label={t('student.activityLog')}>
            {items.map((item) => (
              <div key={item.id} className="activity-log-item">
                <span className="activity-log-icon"><i aria-hidden="true" className={item.icon} /></span>
                <div className="activity-log-item-copy">
                  <p className="activity-log-time">{item.timeLabel ?? (item.lastActivityAt ? dayjs(item.lastActivityAt).fromNow() : '')}</p>
                  <p className="activity-log-title" title={item.title}>{item.title}</p>
                  <button type="button" className="activity-log-resume-btn" onClick={item.onResume}>{t('student.activityResume')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ActivityLogCard
