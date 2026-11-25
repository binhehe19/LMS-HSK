package pl.co.lms.dto.response;

import pl.co.lms.entity.AssessmentAttemptStatus;
import pl.co.lms.entity.AssessmentGradingStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

// Response cho GET /assessment-attempts: lịch sử các lần làm một bài trong một buổi (chỉ của người gọi), mới nhất trước.
public record AssessmentAttemptHistoryResponse(
        List<Item> attempts
) {

    public record Item(
            String attemptId,
            int attemptNo,
            AssessmentAttemptStatus status,
            AssessmentGradingStatus gradingStatus,
            Instant startedAt,
            Instant submittedAt,
            BigDecimal earnedPoints,
            BigDecimal totalPoints,
            BigDecimal percent,
            Long remainingSeconds
    ) {}
}
