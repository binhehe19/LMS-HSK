package pl.co.lms.service.grading;

import base.co.common.event.EventPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Map;

// Gửi sự kiện chấm điểm lên Kafka sau commit. Key = attemptId để mọi sự kiện của một bài cùng partition.
@Component
@RequiredArgsConstructor
public class AssessmentGradingEventPublisher {

    private final EventPublisher eventPublisher;

    @Value("${assessment.grading.attempt-topic:assessment.attempt.grade}")
    private String attemptTopic;

    @Value("${assessment.grading.ai-topic:assessment.answer.ai-grade}")
    private String aiTopic;

    public void publishAttemptGrade(String attemptId) {
        AfterCommit.run(() -> eventPublisher.publish(attemptTopic, attemptId, Map.of("attemptId", attemptId)));
    }

    public void publishAnswerAiGrade(String attemptId, String answerId) {
        AfterCommit.run(() -> eventPublisher.publish(
                aiTopic, attemptId, Map.of("attemptId", attemptId, "answerId", answerId)));
    }
}
