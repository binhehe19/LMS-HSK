package pl.co.lms.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/** Full replacement: null clears an assessment rather than silently assigning the lowest level. */
public record UpdateLearningOrbitSpaceRequest(
        @Min(1) @Max(4) Integer scope,
        @Min(1) @Max(4) Integer probe,
        @Min(1) @Max(4) Integer assemble,
        @Min(1) @Max(4) Integer communicate,
        @Min(1) @Max(4) Integer evaluate,
        @Size(max = 1000) String recommendation) { }
