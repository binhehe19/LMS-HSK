package pl.co.lms.dto.response;


public record StudyMaterialOccurrenceResponse(
        String resourceId, int paragraphIndex, String language, int start, int end, String surface
) {}
