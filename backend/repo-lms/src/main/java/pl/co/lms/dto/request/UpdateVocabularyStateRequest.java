package pl.co.lms.dto.request;

import pl.co.lms.entity.VocabularyComprehensionLevel;

public record UpdateVocabularyStateRequest(
        Boolean saved,
        String note,
        VocabularyComprehensionLevel comprehensionLevel
) {}
