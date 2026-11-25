package pl.co.lms.dto.request;

import jakarta.validation.constraints.*;

public record PublishStudyMaterialRequest(
        @NotBlank @Size(max = 26) String versionId
) {}
