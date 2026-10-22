import { useStudentData, DataStatus } from '../student-data'
import React from 'react'
import { useTranslation } from './translations'
import dayjs from 'dayjs'
import ImageWithBasePath from './image'

const WEEK_DAY_SHORT_KEYS = ["student.mon", "student.tue", "student.wed", "student.thu", "student.fri", "student.sat", "student.sun"];

interface StreakWidgetProps {
  weekDays: dayjs.Dayjs[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

const StreakWidget: React.FC<StreakWidgetProps> = ({ weekDays, onPrevWeek, onNextWeek }) => {
  const { t } = useTranslation();
  // weekDays (từ student-dashboard.tsx) là tuần Chủ Nhật->Thứ 7 chứa ngày hiện tại -- đúng
  // chuẩn, không sai. Nhưng chỉ XOAY mảng đó (đẩy Chủ Nhật xuống cuối) để hiện Thứ 2->CN thì
  // cột "CN" cuối cùng lại thành CHỦ NHẬT TUẦN TRƯỚC (ngày nhỏ hơn mọi cột trước nó) -- cả
  // hàng không tăng dần theo ngày, nhìn như "ngược". Tính lại 1 tuần Thứ 2->CN thật (tìm đúng
  // Thứ 2 trong weekDays rồi cộng dồn 7 ngày) để luôn tăng dần, không phụ thuộc thứ tự gốc.
  const monday = weekDays.find((d) => d.day() === 1) ?? weekDays[1] ?? dayjs();
  const orderedDays = Array.from({ length: 7 }, (_, i) => monday.add(i, 'day'));

  const { orbit, history } = useStudentData();
  const submissionDates = history.data?.items.map(item => item.submittedAt).filter(Boolean) ?? [];
  const orderedCompleted = orderedDays.map(day => submissionDates.some(date => day.isSame(dayjs(date), 'day')));
  const currentStreak = orbit.data?.achievement.currentStreak ?? "—";
  const longestStreak = "—";

  return (
    <div className="premium-card h-100 streak-widget-card">
      <div className="d-flex align-items-center justify-content-between flex-nowrap gap-2 mb-3">
        <h4 className="modern-title mb-0 text-dark d-flex align-items-center gap-2 streak-title">
          <span className="widget-head-icon is-badge-image"><ImageWithBasePath src="assets/hocba/dashboard/Overlay.png" alt="" /></span> Chuỗi ngày nộp bài
        </h4>
        <div className="streak-date-range">
          <button type="button" aria-label="Tuần trước" onClick={onPrevWeek}><i aria-hidden="true" className="fa-solid fa-chevron-left fa-xs" /></button>
          <span>{orderedDays[0].format('DD/MM/YYYY')} - {orderedDays[6].format('DD/MM/YYYY')}</span>
          <button type="button" aria-label="Tuần sau" onClick={onNextWeek}><i aria-hidden="true" className="fa-solid fa-chevron-right fa-xs" /></button>
        </div>
      </div>

      <DataStatus state={orbit} />
      <div className="streak-summary-row">
        <div>
          <span className="streak-count streak-count-current">{currentStreak}</span>
          <span className="streak-count-label">{t('student.daysInARowLabel')}</span>
          <p className="streak-sub-label">Lịch bên dưới chỉ hiển thị lượt tự luyện đã tải.</p>
        </div>
        <div className="text-end">
          <span className="streak-count streak-count-record">{longestStreak}</span>
          <p className="streak-sub-label">Kỷ lục: chưa có dữ liệu</p>
        </div>
      </div>

      <DataStatus state={history} />
      {history.data?.warnings.map(warning => <p key={warning} className="text-danger small">{warning}</p>)}
      <div className="streak-days-row">
        {orderedDays.map((day, index) => {
          const isToday = day.isSame(dayjs(), 'day');
          return (
            <div key={index} className="streak-day-col">
              <span
                className={`streak-day-icon ${orderedCompleted[index] ? 'is-done' : ''}${isToday ? ' is-today' : ''}`}
              >
                {orderedCompleted[index] ? (
                  <ImageWithBasePath src="assets/hocba/dashboard/streak-fire.png" alt="" />
                ) : (
                  <ImageWithBasePath src="assets/hocba/dashboard/Border.png" alt="" />
                )}
              </span>
              <span className="streak-day-label">{t(WEEK_DAY_SHORT_KEYS[index])}</span>
            </div>
          );
        })}
      </div>
    </div>
  )
}

export default StreakWidget
