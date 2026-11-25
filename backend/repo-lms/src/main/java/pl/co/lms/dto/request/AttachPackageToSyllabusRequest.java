package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotBlank;

public record AttachPackageToSyllabusRequest(
        @NotBlank(message = "syllabusId is required")
        String syllabusId,
        @NotBlank(message = "syllabusVersionId is required")
        String syllabusVersionId
) {}
