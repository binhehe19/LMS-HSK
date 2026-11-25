package pl.co.lms.dto.response;

import pl.co.lms.entity.StudyMaterialCategory;
import java.time.Instant;

public record StudyMaterialSummaryResponse(
        String id, String versionId, StudyMaterialCategory category, String title, String subtitle,
                          String description, String imageUrl, String topic, String band, String source, String tier,
                          String skill, String part, Integer minutes, Integer durationSeconds,
                          Integer pageCount, String cefrLevel, Boolean academicWordList,
                          Instant updatedAt, StudyMaterialPersonalResponse personal,
                          String draftVersionId, String publishedVersionId
) {}
