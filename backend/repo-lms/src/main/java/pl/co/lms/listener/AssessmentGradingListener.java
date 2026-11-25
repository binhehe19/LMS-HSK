package pl.co.lms.listener;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import pl.co.lms.config.AssessmentGradingKafkaConfig;
import pl.co.lms.service.grading.AssessmentGradingService;
import pl.co.lms.service.grading.ai.AssessmentAiGradingService;

// Hai hàng đợi chấm: cả bài (câu tự động chấm ngay) và từng câu AI (chậm, có giới hạn song song riêng).
@Slf4j
@Component
@RequiredArgsConstructor
public class AssessmentGradingListener {

    private final ObjectMapper objectMapper;
    private final AssessmentGradingService gradingService;
    private final AssessmentAiGradingService aiGradingService;

    @KafkaListener(
            topics = "${assessment.grading.attempt-topic:assessment.attempt.grade}",
            groupId = "${assessment.grading.attempt-group:lms-assessment-grading}",
            containerFactory = AssessmentGradingKafkaConfig.CONTAINER_FACTORY)
    public void onAttemptGrade(String message) throws Exception {
        String attemptId = field(message, "attemptId");
        if (attemptId != null) {
            gradingService.gradeAttempt(attemptId);
        }
    }

    @KafkaListener(
            topics = "${assessment.grading.ai-topic:assessment.answer.ai-grade}",
            groupId = "${assessment.grading.ai-group:lms-assessment-ai-grading}",
            concurrency = "${assessment.grading.ai.concurrency:2}",
            containerFactory = AssessmentGradingKafkaConfig.CONTAINER_FACTORY)
    public void onAiGrade(String message) throws Exception {
        String attemptId = field(message, "attemptId");
        String answerId = field(message, "answerId");
        if (attemptId != null && answerId != null) {
            aiGradingService.gradeAnswer(attemptId, answerId);
        }
    }

    private String field(String message, String name) throws Exception {
        if (message == null || message.isBlank()) return null;
        JsonNode node = objectMapper.readTree(message).get(name);
        return node == null || node.asText().isBlank() ? null : node.asText();
    }
}
