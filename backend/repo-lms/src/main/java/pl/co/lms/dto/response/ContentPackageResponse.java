package pl.co.lms.dto.response;

import pl.co.lms.entity.ContentPackage;
import pl.co.lms.entity.ContentPackageType;

import java.time.Instant;

public record ContentPackageResponse(
        String id,
        ContentPackageType type,
        String syllabusId,
        String syllabusVersionId,
        String draftVersionId,
        String publishedVersionId,
        long resourceCount,
        long sessionCount,
        ContentPackageVersionResponse draftVersion,
        ContentPackageVersionResponse publishedVersion,
        Instant createdAt,
        Instant updatedAt
) {
    public static ContentPackageResponse from(ContentPackage p) {
        if (p == null) return null;
        return new ContentPackageResponse(
                p.getId(), p.getType(), p.getSyllabusId(), p.getSyllabusVersionId(),
                p.getDraftVersionId(), p.getPublishedVersionId(),
                0, 0, null, null, p.getCreatedAt(), p.getUpdatedAt());
    }

    public static ContentPackageResponse from(
            ContentPackage p, long resourceCount, long sessionCount,
            ContentPackageVersionResponse draftVersion, ContentPackageVersionResponse publishedVersion) {
        if (p == null) return null;
        return new ContentPackageResponse(
                p.getId(), p.getType(), p.getSyllabusId(), p.getSyllabusVersionId(),
                p.getDraftVersionId(), p.getPublishedVersionId(),
                resourceCount, sessionCount, draftVersion, publishedVersion,
                p.getCreatedAt(), p.getUpdatedAt());
    }

    public static ContentPackageResponse from(
            ContentPackage p, long resourceCount,
            ContentPackageVersionResponse draftVersion, ContentPackageVersionResponse publishedVersion) {
        return from(p, resourceCount, 0, draftVersion, publishedVersion);
    }

    public static ContentPackageResponse from(
            ContentPackage p,
            ContentPackageVersionResponse draftVersion, ContentPackageVersionResponse publishedVersion) {
        return from(p, 0, 0, draftVersion, publishedVersion);
    }
}
