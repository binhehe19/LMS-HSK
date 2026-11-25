package pl.co.lms.dto.response;

import java.time.Instant;

public record EditLockResponse(
        boolean acquired,
        String lockedByUserId,
        Instant lockExpiresAt,
        boolean saved
) {}
