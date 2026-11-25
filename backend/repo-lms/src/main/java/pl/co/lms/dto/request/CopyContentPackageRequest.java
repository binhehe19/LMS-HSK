package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotBlank;

public record CopyContentPackageRequest(
        @NotBlank(message = "syllabusId is required")
        String syllabusId,
        @NotBlank(message = "syllabusVersionId is required")
        String syllabusVersionId,
        String title
) {}
