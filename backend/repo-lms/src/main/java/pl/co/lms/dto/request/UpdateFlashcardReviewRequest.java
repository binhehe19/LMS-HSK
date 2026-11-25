package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotNull;
import pl.co.lms.entity.FlashcardStatus;

public record UpdateFlashcardReviewRequest(
        @NotNull(message = "status is required")
        FlashcardStatus status
) {}
