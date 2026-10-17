import React from 'react'
import { Link } from './preview-navigation'
import { useTranslation } from './translations'
import ImageWithBasePath from './image'
import { all_routes } from './preview-navigation'

// ----------------------------------------------------------------------------
// HARDCODED — no mentor-feedback endpoint yet (mentor quote + suggested task
// with reward stars). Replace `mentorQuote` / `mentorTask` once a mentor
// advice API is available.
// ----------------------------------------------------------------------------
const mentorQuote = {
  intro: '"Dựa trên kết quả học tập của bạn cùng feedback từ bài kiểm tra mình nhận thấy bạn đang yếu ở kỹ năng ',
  highlight: 'Nghe và Nói!',
  outro: '"',
};

const mentorTask = {
  title: 'Luyện nghe bài 5 - Ngữ âm',
  durationMinutes: 15,
  rewardStars: 6,
};
// ----------------------------------------------------------------------------

const MentorAdviceCard = () => {
  const { t } = useTranslation();

  return (
    <div className="premium-card h-100 mentor-advice-card">
      <div className="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom">
        <h4 className="modern-title mb-0 text-dark d-flex align-items-center gap-2">
          <span className="widget-head-icon is-badge-image"><ImageWithBasePath src="assets/hocba/dashboard/Overlay4.png" alt="" /></span> {t('student.mentorCorner')}
        </h4>
        <Link to={all_routes.studentQuiz} className="mini-card-link">{t('student.mentorReviewDetail')} &gt;</Link>
      </div>

      <div className="mentor-quote-box">
        <p className="mentor-quote-text">
          {mentorQuote.intro}
          <strong>{mentorQuote.highlight}</strong>
          {mentorQuote.outro}
        </p>
      </div>

      <div className="mentor-task-box">
        <div className="mentor-task-top">
          <span className="mentor-task-icon"><ImageWithBasePath src="assets/hocba/dashboard/Micro.png" alt="" /></span>
          <div className="mentor-task-info">
            <p className="mentor-task-title">{mentorTask.title}</p>
            <span className="mentor-task-duration">{t('student.mentorMinutes', { count: mentorTask.durationMinutes })}</span>
          </div>
          <span className="mentor-task-reward">
            +{mentorTask.rewardStars} <i aria-hidden="true" className="isax isax-star5" />
          </span>
        </div>
        <Link to={all_routes.studentQuiz} className="mentor-task-start-btn">
          <ImageWithBasePath src="assets/hocba/dashboard/start-now.png" alt="" className="mentor-task-start-icon" /> {t('student.mentorStartNow')}
        </Link>
      </div>
    </div>
  )
}

export default MentorAdviceCard
