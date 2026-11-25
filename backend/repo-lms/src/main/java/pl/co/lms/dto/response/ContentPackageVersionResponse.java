package pl.co.lms.dto.response;

import pl.co.lms.entity.ContentPackageVersion;
import pl.co.lms.entity.ContentPackageVersionStatus;

import java.time.Instant;

public record ContentPackageVersionResponse(
        String id,
        String packageId,
        int version,
        ContentPackageVersionStatus status,
        String title,
        String description,
        String level,
        String topic,
        Integer sessionCount,
        Instant createdAt,
        Instant updatedAt
) {
    public static ContentPackageVersionResponse from(ContentPackageVersion v) {
        if (v == null) return null;
        return new ContentPackageVersionResponse(
                v.getId(), v.getPackageId(), v.getVersion(), v.getStatus(),
                v.getTitle(), v.getDescription(), v.getLevel(), v.getTopic(),
                v.getSessionCount(), v.getCreatedAt(), v.getUpdatedAt());
    }
}
