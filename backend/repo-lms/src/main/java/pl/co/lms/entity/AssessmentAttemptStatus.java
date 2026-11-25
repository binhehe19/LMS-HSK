package pl.co.lms.entity;

// Vòng đời LÀM BÀI - tách biệt hoàn toàn khỏi AssessmentGradingStatus (trạng thái CHẤM ĐIỂM), đúng
// theo cách Exam_Backend tách ExamAttempt.status / ExamAttempt.gradingStatus thành 2 field độc lập.
public enum AssessmentAttemptStatus {
    IN_PROGRESS,
    // Hết giờ, chưa nộp - job đánh dấu khi now > ends_at + 1 phút. Vẫn được submit (nộp trễ).
    TIME_OUT,
    SUBMITTED
}
