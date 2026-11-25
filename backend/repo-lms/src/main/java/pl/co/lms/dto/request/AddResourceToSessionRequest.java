package pl.co.lms.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AddResourceToSessionRequest(
        @NotBlank(message = "learningResourceId is required")
        String learningResourceId,
        @NotBlank(message = "learningResourceVersionId is required")
        String learningResourceVersionId,
        @Min(value = 1, message = "sessionNo must be greater than or equal to 1")
        Integer sessionNo,
        @NotNull(message = "displayOrder is required")
        @Min(value = 0, message = "displayOrder must be greater than or equal to 0")
        Integer displayOrder,
        // Tùy chọn: chủ đề của buổi để gắn học liệu vào (null = không chủ đề).
        String topicId
) {}
