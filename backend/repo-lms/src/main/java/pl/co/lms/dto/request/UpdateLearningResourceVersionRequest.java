package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotNull;

public record UpdateLearningResourceVersionRequest(
        @NotNull(message = "Content payload is required")
        Object content
) {}
