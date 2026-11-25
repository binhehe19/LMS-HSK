package pl.co.lms.dto.response;

import pl.co.lms.entity.json.StudyMaterialContent;
import java.util.List;

public record StudyMaterialDetailResponse(
        StudyMaterialSummaryResponse summary, StudyMaterialContent content, List<StudyMaterialWordResponse> vocabulary, List<StudyMaterialOccurrenceResponse> highlights
) {}
