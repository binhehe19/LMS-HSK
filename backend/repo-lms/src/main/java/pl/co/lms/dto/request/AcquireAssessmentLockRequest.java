package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotBlank;

public record AcquireAssessmentLockRequest(
        @NotBlank String sessionToken,
        boolean force
) {}
