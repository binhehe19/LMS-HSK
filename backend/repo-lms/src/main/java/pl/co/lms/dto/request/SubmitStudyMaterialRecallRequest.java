package pl.co.lms.dto.request;

import jakarta.validation.constraints.*;
import java.util.Map;

public record SubmitStudyMaterialRecallRequest(
        @NotBlank @Size(max = 26) String versionId,
                         @NotNull @Size(min = 1, max = 500) Map<@NotBlank @Size(max = 26) String, @NotNull @Size(max = 2000) String> answers
) {}
