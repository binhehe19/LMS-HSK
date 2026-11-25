package pl.co.lms.dto.response;

import com.fasterxml.jackson.databind.ObjectMapper;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceVersion;

import java.time.Instant;

public record LearningResourceVersionResponse(
        String id,
        String resourceId,
        int version,
        Object content,
        Instant createdAt,
        Instant updatedAt
) {
    public static LearningResourceVersionResponse from(
            LearningResourceVersion v,
            LearningResource resource,
            ObjectMapper objectMapper) {
        if (v == null) return null;
        Object parsedContent = (resource != null && objectMapper != null)
                ? v.getContentAs(resource.getType().contentClassOf(resource.getSubType()), objectMapper)
                : v.getContent();
        return new LearningResourceVersionResponse(
                v.getId(),
                v.getResourceId(),
                v.getVersion(),
                parsedContent,
                v.getCreatedAt(),
                v.getUpdatedAt()
        );
    }
}
