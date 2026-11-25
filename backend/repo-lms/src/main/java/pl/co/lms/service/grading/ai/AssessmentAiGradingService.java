package pl.co.lms.service.grading.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import pl.co.lms.entity.AssessmentAnswer;
import pl.co.lms.entity.AssessmentAnswerGradingStatus;
import pl.co.lms.entity.AssessmentAttempt;
import pl.co.lms.entity.json.QuestionContent;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.entity.json.QuizQuestion;
import pl.co.lms.repository.AssessmentAnswerGradingHistoryRepository;
import pl.co.lms.repository.AssessmentAnswerRepository;
import pl.co.lms.repository.AssessmentAttemptRepository;
import pl.co.lms.service.AssessmentAttemptQuestionResolver;
import pl.co.lms.service.grading.AssessmentGradingService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

// Worker chấm một câu bằng AI.
@Slf4j
@Service
@RequiredArgsConstructor
public class AssessmentAiGradingService {

    private final AssessmentAttemptRepository attemptRepository;
    private final AssessmentAnswerRepository answerRepository;
    private final AssessmentAnswerGradingHistoryRepository historyRepository;
    private final AssessmentAttemptQuestionResolver questionResolver;
    private final AssessmentGradingService gradingService;
    private final ObjectProvider<AiGradingClient> aiClientProvider;
    private final TransactionTemplate transactionTemplate;

    @Value("${assessment.grading.ai.max-attempts:2}")
    private int maxAttempts;

    public void gradeAnswer(String attemptId, String answerId) {
        AiGradingClient.Request request = transactionTemplate.execute(s -> loadRequest(attemptId, answerId));
        if (request == null) {
            return;
        }

        AiGradingClient.Result result = null;
        String failureReason = null;
        AiGradingClient client = request.question() == null ? null : aiClientProvider.orderedStream()
                .filter(c -> c.supports(request.question())).findFirst().orElse(null);
        if (request.question() == null) {
            failureReason = "Không tìm thấy nội dung câu hỏi";
        } else if (client == null) {
            failureReason = "Chưa cấu hình dịch vụ chấm tự động";
        } else {
            for (int i = 0; i < Math.max(1, maxAttempts) && result == null; i++) {
                try {
                    result = client.grade(request);
                } catch (Exception e) {
                    failureReason = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
                    log.warn("AI grading failed (attempt {}) answerId={}: {}", i + 1, answerId, failureReason);
                }
            }
        }

        final AiGradingClient.Result finalResult = result;
        final String finalReason = failureReason;
        transactionTemplate.executeWithoutResult(s -> applyResult(attemptId, answerId, finalResult, finalReason));
    }

    private AiGradingClient.Request loadRequest(String attemptId, String answerId) {
        AssessmentAnswer answer = answerRepository.findByIdAndDeletedFalse(answerId).orElse(null);
        if (answer == null || !attemptId.equals(answer.getAttemptId())
                || answer.getGradingStatus() != AssessmentAnswerGradingStatus.AI_PENDING) {
            return null;
        }
        AssessmentAttempt attempt = attemptRepository.findByIdAndDeletedFalse(attemptId).orElse(null);
        if (attempt == null) {
            return null;
        }

        QuizContent quizContent = questionResolver.getQuizContent(attempt.getLearningResourceVersionId());
        QuestionContent question = null;
        if (quizContent != null && quizContent.getQuestions() != null) {
            for (QuizQuestion q : quizContent.getQuestions()) {
                if (answer.getQuestionId().equals(q.getQuestionId())) {
                    question = QuestionContent.from(q);
                    break;
                }
            }
        }
        return new AiGradingClient.Request(question, answer.getAnswerJson(), answer.getMaxPoints());
    }

    private void applyResult(String attemptId, String answerId, AiGradingClient.Result result, String failureReason) {
        AssessmentAttempt attempt = attemptRepository.findByIdForUpdate(attemptId).orElse(null);
        if (attempt == null) {
            return;
        }
        List<AssessmentAnswer> answers = answerRepository.findByAttemptIdAndDeletedFalse(attemptId);
        AssessmentAnswer answer = answers.stream().filter(a -> answerId.equals(a.getId())).findFirst().orElse(null);
        if (answer == null || answer.getGradingStatus() != AssessmentAnswerGradingStatus.AI_PENDING) {
            return;
        }

        Instant now = Instant.now();
        String comment;
        if (result != null && result.score() != null) {
            BigDecimal max = answer.getMaxPoints() == null ? BigDecimal.ZERO : answer.getMaxPoints();
            BigDecimal score = result.score().max(BigDecimal.ZERO).min(max).setScale(2, RoundingMode.HALF_UP);
            gradingService.markGraded(answer, score, AssessmentAnswerGradingStatus.AI_GRADED, now);
            answer.setGraderComment(result.feedback());
            if (result.rubric() != null) {
                // Điểm theo tiêu chí (VD 4 tiêu chí IELTS Writing): lưu ở câu dưới dạng JSON mờ.
                answer.setRubricScores(result.rubric());
                attempt.setGradingMethod("AI");
            }
            comment = result.feedback();
        } else {
            answer.setEarnedPoints(null);
            answer.setGradingStatus(AssessmentAnswerGradingStatus.MANUAL_PENDING);
            comment = "Chuyển chấm tay: " + (failureReason == null ? "không có kết quả" : failureReason);
        }
        answerRepository.save(answer);
        historyRepository.save(gradingService.newHistory(answer, null, null, null, comment, now));
        gradingService.recompute(attempt, answers);
    }
}
