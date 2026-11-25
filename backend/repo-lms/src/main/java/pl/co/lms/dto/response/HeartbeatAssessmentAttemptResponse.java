package pl.co.lms.dto.response;

import pl.co.lms.entity.AssessmentAttemptStatus;

import java.time.Instant;
import java.util.List;

public record HeartbeatAssessmentAttemptResponse(
        boolean lockRenewed,
        Instant lockExpiresAt,
        Instant serverNow,
        Instant endsAt,
        Long remainingSeconds,
        AssessmentAttemptStatus effectiveStatus,
        List<String> savedAnswerIds
) {}
