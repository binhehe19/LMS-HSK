package pl.co.lms.entity;

// Trạng thái CHẤM ĐIỂM cấp attempt (khác AssessmentAttemptStatus - vòng đời làm bài).
// NOT_SUBMITTED: chưa nộp/chưa đóng. PENDING: đã nộp hoặc đã đóng, chờ worker chấm tự động.
// GRADING: đã chấm phần tự động, còn câu chờ chấm bằng AI. MANUAL_GRADING: còn câu chờ admin chấm.
// GRADED: mọi câu đã có điểm (kể cả điểm AI chưa được admin duyệt).
public enum AssessmentGradingStatus {
    NOT_SUBMITTED,
    PENDING,
    GRADING,
    MANUAL_GRADING,
    GRADED
}
