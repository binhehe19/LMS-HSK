package pl.co.lms.dto.response;

import pl.co.lms.entity.ContentPackageVersionResource;
import pl.co.lms.entity.ContentPackageVersionTopic;
import pl.co.lms.entity.LearningResourceType;
import pl.co.lms.entity.json.PlacementSettings;

import java.time.Instant;

public record ContentPackageVersionResourceResponse(
        String id,
        String contentPackageVersionId,
        String learningResourceId,
        String learningResourceVersionId,
        int sessionNo,
        int displayOrder,
        LearningResourceType resourceType,
        Object resourceContent,
        Instant createdAt,
        PlacementSettings settings,
        String resourceTitle,
        String subType,
        String skill,
        // Chủ đề của học liệu trong buổi; cả ba null = không chủ đề.
        String topicId,
        String topicTitle,
        Integer topicOrder,
        // Bản sao lấy từ Kho (từ điển, ngữ pháp…): id tài nguyên gốc; null = học liệu tạo ngay trong học phần.
        String sourceResourceId
) {
    public ContentPackageVersionResourceResponse(
            String id, String contentPackageVersionId, String learningResourceId, String learningResourceVersionId,
            int sessionNo, int displayOrder, LearningResourceType resourceType, Object resourceContent, Instant createdAt) {
        this(id, contentPackageVersionId, learningResourceId, learningResourceVersionId, sessionNo, displayOrder,
                resourceType, resourceContent, createdAt, null);
    }

    // Compatibility constructor for existing producers; metadata is additive.
    public ContentPackageVersionResourceResponse(
            String id, String contentPackageVersionId, String learningResourceId, String learningResourceVersionId,
            int sessionNo, int displayOrder, LearningResourceType resourceType, Object resourceContent,
            Instant createdAt, PlacementSettings settings) {
        this(id, contentPackageVersionId, learningResourceId, learningResourceVersionId, sessionNo, displayOrder,
                resourceType, resourceContent, createdAt, settings, null, null, null);
    }

    public ContentPackageVersionResourceResponse(
            String id, String contentPackageVersionId, String learningResourceId, String learningResourceVersionId,
            int sessionNo, int displayOrder, LearningResourceType resourceType, Object resourceContent,
            Instant createdAt, PlacementSettings settings, String resourceTitle, String subType, String skill) {
        this(id, contentPackageVersionId, learningResourceId, learningResourceVersionId, sessionNo, displayOrder,
                resourceType, resourceContent, createdAt, settings, resourceTitle, subType, skill, null, null, null, null);
    }

    public ContentPackageVersionResourceResponse withMetadata(String title, String type) {
        return withMetadata(title, type, null);
    }

    public ContentPackageVersionResourceResponse withMetadata(String title, String type, String skill) {
        return new ContentPackageVersionResourceResponse(id, contentPackageVersionId, learningResourceId,
                learningResourceVersionId, sessionNo, displayOrder, resourceType, resourceContent,
                createdAt, settings, title, type, skill, topicId, topicTitle, topicOrder, sourceResourceId);
    }

    /** topic null = không chủ đề. */
    public ContentPackageVersionResourceResponse withTopic(ContentPackageVersionTopic topic) {
        return new ContentPackageVersionResourceResponse(id, contentPackageVersionId, learningResourceId,
                learningResourceVersionId, sessionNo, displayOrder, resourceType, resourceContent,
                createdAt, settings, resourceTitle, subType, skill,
                topic == null ? null : topic.getId(), topic == null ? null : topic.getTitle(), topic == null ? null : topic.getTopicOrder(),
                sourceResourceId);
    }

    public ContentPackageVersionResourceResponse withSourceResourceId(String source) {
        return new ContentPackageVersionResourceResponse(id, contentPackageVersionId, learningResourceId,
                learningResourceVersionId, sessionNo, displayOrder, resourceType, resourceContent,
                createdAt, settings, resourceTitle, subType, skill, topicId, topicTitle, topicOrder, source);
    }

    public static ContentPackageVersionResourceResponse from(
            ContentPackageVersionResource link,
            LearningResourceType type,
            Object content) {
        if (link == null) return null;
        return new ContentPackageVersionResourceResponse(
                link.getId(), link.getContentPackageVersionId(), link.getLearningResourceId(),
                link.getLearningResourceVersionId(), link.getSessionNo(), link.getDisplayOrder(),
                type, content, link.getCreatedAt(), link.getSettings());
    }

    public ContentPackageVersionResourceResponse withoutContent() {
        return new ContentPackageVersionResourceResponse(
                id, contentPackageVersionId, learningResourceId, learningResourceVersionId,
                sessionNo, displayOrder, resourceType, null, createdAt, null, resourceTitle, subType, skill,
                topicId, topicTitle, topicOrder, sourceResourceId);
    }
}
