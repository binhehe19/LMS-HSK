package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

public record SaveShadowingRecordingRequest(
        @NotBlank String recordingFileId,
        @PositiveOrZero Long recordingDurationMillis
) {}
