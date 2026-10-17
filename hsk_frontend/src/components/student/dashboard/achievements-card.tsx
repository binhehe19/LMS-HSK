import { useStudentData, DataStatus } from '../student-data'
import React from 'react'
import { Link } from './preview-navigation'
import { useTranslation } from './translations'
import ImageWithBasePath from './image'
import { all_routes } from './preview-navigation'

// ----------------------------------------------------------------------------
// HARDCODED — no gamification/points endpoint yet (accumulated points, study
// stars, total study time, lessons completed). Replace `stats` below once a
// student achievements/gamification API is available.
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

const AchievementsCard = () => {
  const { t } = useTranslation();
  const { orbit } = useStudentData();
  const stats = { points: orbit.data?.achievement.earnedPoints ?? "—", stars: "—", studyTime: "—", lessonsCompleted: orbit.data?.achievement.completedAttempts ?? "—" };

  const tiles = [
    { icon: 'assets/hocba/dashboard/Icon1.png', bg: 'icon-box-secondary', label: 'Tổng điểm bài đã chấm', value: stats.points },
    { icon: 'assets/hocba/dashboard/Icon2.png', bg: 'icon-box-primary', label: t('student.studyStars'), value: stats.stars },
    { icon: 'assets/hocba/dashboard/Icon3.png', bg: 'icon-box-info', label: t('student.studyTime'), value: stats.studyTime },
    { icon: 'assets/hocba/dashboard/Icon4.png', bg: 'icon-box-success', label: 'Lượt làm đã hoàn thành', value: stats.lessonsCompleted },
  ];

  return (
    <div className="premium-card h-100 achievements-card">
      <div className="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom">
        <h4 className="modern-title mb-0 text-dark d-flex align-items-center gap-2">
          <span className="widget-head-icon is-badge-image"><ImageWithBasePath src="assets/hocba/dashboard/Overlay5.png" alt="" /></span> {t('student.achievements')}
        </h4>
        <Link to={all_routes.studentQuiz} className="mini-card-link">{t('student.detail')} &gt;</Link>
      </div>

      <DataStatus state={orbit} />
      <div className="row g-3">
        {tiles.map((tile, index) => (
          <div className="col-6" key={index}>
            <div className="achievement-tile">
              <div className={`icon-box-modern ${tile.bg} mb-2 achievement-icon-box`}>
                <ImageWithBasePath src={tile.icon} alt="" />
              </div>
              <p className="achievement-label">{tile.label}</p>
              <h5 className="achievement-value">{tile.value}</h5>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AchievementsCard
