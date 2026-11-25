package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotBlank;

public record AcquireEditLockRequest(
        @NotBlank(message = "sessionToken is required")
        String sessionToken
) {}
