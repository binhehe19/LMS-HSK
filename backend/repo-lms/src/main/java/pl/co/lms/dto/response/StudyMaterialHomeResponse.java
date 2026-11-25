package pl.co.lms.dto.response;

import java.util.List;
import java.util.Map;

public record StudyMaterialHomeResponse(
        Map<String, Long> counts, List<StudyMaterialSummaryResponse> recent, List<StudyMaterialSummaryResponse> saved, List<StudyMaterialSummaryResponse> continuing
) {}
