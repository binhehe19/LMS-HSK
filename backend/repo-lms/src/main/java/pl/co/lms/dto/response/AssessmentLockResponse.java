package pl.co.lms.dto.response;

import java.time.Instant;

// Response của POST /assessment-attempts/{id}/lock và DELETE /assessment-attempts/{id}/lock.
// acquired=false → holderUserId là người đang giữ khóa; client hiển thị "tab khác đang làm bài".
public record AssessmentLockResponse(
        boolean acquired,
        String holderUserId,
        Instant lockExpiresAt,
        Instant serverNow,
        Instant endsAt
) {}
