package pl.co.lms.dto.response;

import java.util.List;

public record StudyMaterialVocabularyResponse(
        List<StudyMaterialWordResponse> words, List<StudyMaterialOccurrenceResponse> highlights
) {}
