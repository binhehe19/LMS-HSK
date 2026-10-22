import { useStudentData, DataStatus } from '../student-data'
import React from 'react'
import { Link } from './preview-navigation'
import { useTranslation } from './translations'
import ImageWithBasePath from './image'
import { all_routes } from './preview-navigation'

const SkillProgressCard = () => {
  const { t } = useTranslation();
  const { orbit } = useStudentData();
  const activeCourseId = true;
  const isLoading = orbit.loading;
  const names: Record<string, string> = { LISTENING: "skillListening", SPEAKING: "skillSpeaking", READING: "skillReading", WRITING: "skillWriting" };
  const icons: Record<string, string> = { LISTENING: "listen", SPEAKING: "talk", READING: "read", WRITING: "write" };
  const skills = (orbit.data?.band.skills ?? []).flatMap(skill => {
   const result = skill.results[0];
   if (!names[skill.key] || !result || result.total <= 0) return [];
   return [{ key: names[skill.key], icon: `assets/hocba/dashboard/${icons[skill.key]}.png`, percent: Math.round(result.earned / result.total * 100), provisional: result.provisional }];
  });

  return (
    <div className="premium-card h-100 skill-progress-card">
      <div className="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom">
        <h4 className="modern-title mb-0 text-dark d-flex align-items-center gap-2">
          <span className="widget-head-icon"><ImageWithBasePath src="assets/hocba/dashboard/Overlay2.png" alt="" /></span> Kết quả kỹ năng gần nhất
        </h4>
        <Link to={all_routes.studentQuiz} className="mini-card-link">{t('student.detail')} &gt;</Link>
      </div>

      <p className="text-muted small">Tỷ lệ điểm bài đã chấm; không phải tiến độ hoàn thành khóa học.</p>
      <DataStatus state={orbit} />
      {isLoading ? (
        <div className="text-center py-4">
          <div className="spinner-border spinner-border-sm text-primary" role="status" />
        </div>
      ) : !activeCourseId ? (
        <p className="text-muted mb-0">{t('student.noCourses')}</p>
      ) : skills.length === 0 ? (
        <p className="text-muted mb-0">{t('student.noDataToShow')}</p>
      ) : (
        <div className="d-flex flex-column gap-4">
          {skills.map((skill) => (
            <div key={skill.key} className="skill-progress-row">
              <div className="skill-progress-top">
                <span className="skill-progress-label">
                  <ImageWithBasePath src={skill.icon} alt="" className="skill-progress-icon" /> {t(`student.${skill.key}`)}
                </span>
                <span className={`skill-progress-percent ${skill.percent >= 100 ? 'is-complete' : ''}`}>{skill.percent}%{skill.provisional ? " (tạm tính)" : ""}</span>
              </div>
              <div className="skill-progress-bar-track">
                <div
                  className={`skill-progress-bar-fill ${skill.percent >= 100 ? 'is-complete' : ''}`}
                  style={{ width: `${skill.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SkillProgressCard
