package pl.co.lms.dto.request;

import jakarta.validation.constraints.*;
import jakarta.validation.Valid;
import pl.co.lms.entity.json.StudyMaterialContent;
import java.util.List;

public record SaveStudyMaterialRequest(
        @NotNull @Valid StudyMaterialContent content, @Size(max = 20) List<@NotBlank @Size(max = 60) String> tags
) {}
