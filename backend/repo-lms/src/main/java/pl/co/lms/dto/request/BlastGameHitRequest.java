package pl.co.lms.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BlastGameHitRequest(@NotBlank @Size(max = 26) String questionCardId,
        @NotBlank @Size(max = 26) String cardId, @Min(0) int atMs) {}
