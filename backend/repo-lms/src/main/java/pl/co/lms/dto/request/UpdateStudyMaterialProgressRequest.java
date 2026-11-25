package pl.co.lms.dto.request;

import jakarta.validation.constraints.*;

public record UpdateStudyMaterialProgressRequest(
        @NotBlank @Size(max = 26) String versionId, @NotNull @DecimalMin("0") Double position, boolean completed
) {}
