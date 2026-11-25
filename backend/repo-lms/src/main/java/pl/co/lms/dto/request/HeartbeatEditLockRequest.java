package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotBlank;

public record HeartbeatEditLockRequest(
        @NotBlank(message = "sessionToken is required")
        String sessionToken,
        String versionId,
        String title,
        String description,
        String level,
        String topic,
        Integer sessionCount
) {}
