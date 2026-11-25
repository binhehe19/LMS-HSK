package pl.co.lms.dto.response;

import com.fasterxml.jackson.databind.ObjectMapper;
import pl.co.lms.entity.LearningResource;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.LearningResourceVersion;

import java.time.Instant;

public record LearningResourceResponse(
        String id,
        LearningResourceType type,
        String draftVersionId,
        String publishedVersionId,
        Object content,
        boolean inLibrary,
        /** Loại phụ trong phạm vi type (ResourceSubTypes): QUIZ, PRACTICE_x, PLACEMENT_x của bài đánh giá; EN/ZH của từ vựng. */
        String subType,
        java.util.List<String> tags,
        Instant createdAt,
        Instant updatedAt,
        String skill,
        /** Học liệu nguồn mà bản sao này được tạo từ đó (null = không có nguồn, hoặc chính là bản gốc). */
        String sourceResourceId
) {
    public static LearningResourceResponse from(
            LearningResource r,
            LearningResourceVersion activeVersion,
            ObjectMapper objectMapper) {
        if (r == null) return null;
        Object content = null;
        if (activeVersion != null && objectMapper != null) {
            content = activeVersion.getContentAs(r.getType().contentClassOf(r.getSubType()), objectMapper);
        }
        return new LearningResourceResponse(
                r.getId(), r.getType(), r.getDraftVersionId(), r.getPublishedVersionId(),
                content, r.isInLibrary(), r.getSubType(),
                r.getTags() == null ? java.util.List.of() : new java.util.ArrayList<>(r.getTags()), r.getCreatedAt(), r.getUpdatedAt(),
                r.getSkill(), r.getSourceResourceId());
    }}
