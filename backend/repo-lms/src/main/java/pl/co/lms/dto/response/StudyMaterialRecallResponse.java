package pl.co.lms.dto.response;

import java.util.List;

public record StudyMaterialRecallResponse(
        int score, int correct, int total, List<StudyMaterialRecallAnswerResponse> answers, StudyMaterialProgressResponse progress
) {}
