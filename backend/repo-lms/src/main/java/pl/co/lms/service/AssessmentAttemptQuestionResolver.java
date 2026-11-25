package pl.co.lms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.repository.LearningResourceVersionRepository;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;

@Component
@RequiredArgsConstructor
public class AssessmentAttemptQuestionResolver {

    private final LearningResourceVersionRepository versionRepository;
    private final ObjectMapper objectMapper;

    public QuizContent getQuizContent(String learningResourceVersionId) {
        var version = versionRepository.findByIdAndDeletedFalse(learningResourceVersionId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "LearningResourceVersion không tồn tại"));
        return version.getContentAs(QuizContent.class, objectMapper);
    }
}
