package pl.co.lms.dto.response;

import pl.co.lms.entity.json.VocabularyEnContent;

public record StudyMaterialWordResponse(
        String resourceId, String versionId, VocabularyEnContent content, boolean learned, boolean saved
) {}
