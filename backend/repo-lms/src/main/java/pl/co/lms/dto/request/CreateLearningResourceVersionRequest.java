package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotNull;

public record CreateLearningResourceVersionRequest(
        @NotNull(message = "Content payload is required")
        Object content,
        Boolean publishImmediately
) {}
