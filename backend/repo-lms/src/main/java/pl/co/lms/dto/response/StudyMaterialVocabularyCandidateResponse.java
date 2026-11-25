package pl.co.lms.dto.response;

import java.util.List;

public record StudyMaterialVocabularyCandidateResponse(
        StudyMaterialWordResponse word, List<StudyMaterialOccurrenceResponse> occurrences
) {}
