package pl.co.lms.entity;

// Trạng thái chấm cấp TỪNG CÂU trả lời (khác AssessmentGradingStatus - trạng thái chấm cấp cả attempt).
// AI_GRADED: điểm AI đã tính vào tổng, chờ admin duyệt (admin lưu điểm thì thành MANUAL_GRADED).
// SCORE_UPDATED: admin sửa điểm câu đã chốt (điểm cũ nằm ở AssessmentAnswerGradingHistory).
public enum AssessmentAnswerGradingStatus {
    UNGRADED,
    AUTO_GRADED,
    AI_PENDING,
    AI_GRADED,
    MANUAL_PENDING,
    MANUAL_GRADED,
    SCORE_UPDATED
}
