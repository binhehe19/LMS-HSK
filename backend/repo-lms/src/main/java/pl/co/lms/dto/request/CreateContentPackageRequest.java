package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotNull;
import pl.co.lms.entity.ContentPackageType;

public record CreateContentPackageRequest(
        @NotNull(message = "Package type is required")
        ContentPackageType type,
        String syllabusId,
        String syllabusVersionId,
        String title,
        String description,
        String level,
        String topic,
        Integer sessionCount
) {}
