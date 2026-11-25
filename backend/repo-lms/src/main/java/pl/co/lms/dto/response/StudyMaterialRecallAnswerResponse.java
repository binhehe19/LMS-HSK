package pl.co.lms.dto.response;


public record StudyMaterialRecallAnswerResponse(
        String resourceId, String word, boolean correct, String answer, String expected
) {}
