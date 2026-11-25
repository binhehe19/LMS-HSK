package pl.co.lms.dto.request;

import jakarta.validation.constraints.*;
import pl.co.lms.entity.json.StudyMaterialContent;
import java.util.List;
import java.util.Map;

public record DetectStudyMaterialVocabularyRequest(
        @NotNull @Size(min = 1, max = 500) List<StudyMaterialContent.Paragraph> paragraphs,
                         @Size(max = 500) Map<String, List<String>> variants,
        StudyMaterialContent.VocabularyUnit vocabularyUnit
) {}
