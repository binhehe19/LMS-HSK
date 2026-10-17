import { useStudentData, DataStatus } from '../student-data'
import React from 'react'
import { Link } from './preview-navigation'
import { useTranslation } from './translations'
import ImageWithBasePath from './image'
import { all_routes } from './preview-navigation'

// ----------------------------------------------------------------------------
// Vẫn hardcode: chưa có API breakdown theo TỪNG study set (2 dòng dưới cùng
// "Từ vựng HSK4"/"Từ vựng Giao tiếp GT1") — phần donut + tổng số ở trên đã
// nối API thật (getMyCourseVocabularySummary), phần vocabSets này nằm ngoài
// scope yêu cầu hiện tại nên giữ nguyên tạm thời.
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------

interface DonutSegment {
  percent: number;
  className: string;
}

/** Doughnut built from stroked SVG circles (same approach as CourseProgressRing). */
const VocabularyDonut: React.FC<{ segments: DonutSegment[]; size?: number }> = ({ segments, size = 150 }) => {
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg width={size} height={size} className="vocab-donut-svg">
      {segments.map((seg, index) => {
        const length = (seg.percent / 100) * circumference;
        const dashOffset = -segments.slice(0, index).reduce((sum, previous) => sum + previous.percent / 100 * circumference, 0);
        return (
          <circle
            key={index}
            cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none"
            className={seg.className}
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
      })}
    </svg>
  );
};

const toPercent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

const VocabularyCard = () => {
  const { t } = useTranslation();
  const { orbit } = useStudentData();
  const activeCourseId = true;
  const isLoading = orbit.loading;
  const vocabulary = orbit.data?.vocabulary;
  const summary = vocabulary ? { total: vocabulary.total, learned: vocabulary.known, learning: vocabulary.learning, notLearned: Math.max(0, vocabulary.total - vocabulary.known - vocabulary.learning), courseName: "Toàn bộ kho" } : null;

  const vocabStats = (() => {
    const total = summary?.total || 0;
    const learned = summary?.learned || 0;
    const learning = summary?.learning || 0;
    const notLearned = summary?.notLearned || 0;
    return {
      total,
      courseBadge: summary?.courseName || '',
      remembered: { count: learned, percent: toPercent(learned, total) },
      learning: { count: learning, percent: toPercent(learning, total) },
      notStarted: { count: notLearned, percent: toPercent(notLearned, total) },
      // "Ôn tập ngay" trỏ tới các thẻ ĐANG HỌC (chưa nhớ hẳn) — cần ôn lại nhiều nhất.
      reviewCount: learning,
    };
  })();

  const legendRows = [
    { dotClass: 'is-remembered', label: t('student.vocabRemembered'), data: vocabStats.remembered },
    { dotClass: 'is-learning', label: t('student.vocabLearning'), data: vocabStats.learning },
    { dotClass: 'is-not-started', label: t('student.vocabNotStarted'), data: vocabStats.notStarted },
  ];

  return (
    <div className="premium-card h-100 vocabulary-card">
      <div className="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom">
        <h4 className="modern-title mb-0 text-dark d-flex align-items-center gap-2">
          <span className="widget-head-icon"><ImageWithBasePath src="assets/hocba/dashboard/Overlay3.png" alt="" /></span> {t('student.vocabTitle')}
        </h4>
        <Link to={all_routes.studentQuiz} className="mini-card-link">{t('student.detail')} &gt;</Link>
      </div>

      <DataStatus state={orbit} />
      {isLoading ? (
        <div className="text-center py-4">
          <div className="spinner-border spinner-border-sm text-primary" role="status" />
        </div>
      ) : !activeCourseId || !summary ? (
        <p className="text-muted mb-0">Chưa có dữ liệu từ vựng.</p>
      ) : (
        <>
          <div className="vocab-main">
            <div className="vocab-donut-wrap">
              <VocabularyDonut
                segments={[
                  { percent: vocabStats.remembered.percent, className: 'donut-remembered' },
                  { percent: vocabStats.learning.percent, className: 'donut-learning' },
                  { percent: vocabStats.notStarted.percent, className: 'donut-not-started' },
                ]}
              />
              <div className="vocab-donut-center">
                <span className="vocab-donut-total">{vocabStats.total}</span>
                <span className="vocab-donut-unit">{t('student.vocabTitle')}</span>
                <span className="vocab-donut-badge">{vocabStats.courseBadge}</span>
              </div>
            </div>

            <div className="vocab-side">
              <div className="vocab-legend">
                {legendRows.map((row) => (
                  <div key={row.dotClass} className="vocab-legend-row">
                    <span className="vocab-legend-label">
                      <span className={`vocab-legend-dot ${row.dotClass}`} /> {row.label}
                    </span>
                    <span className="vocab-legend-value">{row.data.count} ({row.data.percent}%)</span>
                  </div>
                ))}
              </div>
              <Link to={all_routes.studentQuiz} className="btn btn-danger rounded-pill fw-bold vocab-review-btn">
                <i aria-hidden="true" className="isax isax-arrow-circle-right me-2" /> {t('student.vocabReviewCta', { count: vocabStats.reviewCount })}
              </Link>
            </div>
          </div>

          <p className="text-muted small mt-3">Chưa có thống kê riêng theo khóa HSK.</p>
        </>
      )}
    </div>
  )
}

export default VocabularyCard
