package pl.co.lms.dto.response;

import java.time.Instant;

// answersIgnored=true khi gọi sau grace period (ends_at + 2 phút): vẫn nộp thành công nhưng
// đáp án gửi kèm không được ghi.
public record SubmitAssessmentAttemptResponse(
        String attemptId,
        boolean answersIgnored,
        Instant submittedAt
) {}
