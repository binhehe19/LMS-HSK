package pl.co.lms.service.grading;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.ObjectProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.entity.AssessmentAnswer;
import pl.co.lms.entity.ExerciseQuestionType;
import pl.co.lms.entity.AssessmentAnswerGradingHistory;
import pl.co.lms.entity.AssessmentAnswerGradingStatus;
import pl.co.lms.entity.AssessmentAttempt;
import pl.co.lms.entity.AssessmentAttemptStatus;
import pl.co.lms.entity.AssessmentContextType;
import pl.co.lms.entity.AssessmentGradingStatus;
import pl.co.lms.entity.json.QuestionContent;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.entity.json.QuizQuestion;
import pl.co.lms.repository.AssessmentAnswerGradingHistoryRepository;
import pl.co.lms.repository.AssessmentAnswerRepository;
import pl.co.lms.repository.AssessmentAttemptRepository;
import pl.co.lms.service.AssessmentAttemptQuestionResolver;
import pl.co.lms.service.grading.ai.AiGradingClient;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// Chấm cả attempt sau khi nộp/đóng bài (chạy ở worker Kafka, không nằm trong API submit).
@Slf4j
@Service
@RequiredArgsConstructor
public class AssessmentGradingService {

    private static final BigDecimal DEFAULT_POINTS = BigDecimal.ONE;

    private final AssessmentAttemptRepository attemptRepository;
    private final AssessmentAnswerRepository answerRepository;
    private final AssessmentAnswerGradingHistoryRepository historyRepository;
    private final AssessmentAttemptQuestionResolver questionResolver;
    private final QuestionAutoGrader autoGrader;
    private final AssessmentGradingEventPublisher eventPublisher;
    private final AssessmentGradingNotifier notifier;
    private final ObjectMapper mapper;
    private final ObjectProvider<AiGradingClient> aiClients;

    private enum Route { AUTO, AI, MANUAL }

    @Transactional
    public void gradeAttempt(String attemptId) {
        AssessmentAttempt attempt = attemptRepository.findByIdForUpdate(attemptId).orElse(null);
        if (attempt == null || attempt.getGradingStatus() != AssessmentGradingStatus.PENDING
                || attempt.getStatus() == AssessmentAttemptStatus.IN_PROGRESS) {
            return;
        }

        QuizContent quizContent = questionResolver.getQuizContent(attempt.getLearningResourceVersionId());
        List<QuizQuestion> questions = quizContent != null && quizContent.getQuestions() != null
                ? quizContent.getQuestions() : List.of();

        Map<String, AssessmentAnswer> answers = new LinkedHashMap<>();
        for (AssessmentAnswer a : answerRepository.findByAttemptIdAndDeletedFalse(attemptId)) {
            answers.putIfAbsent(a.getQuestionId(), a);
        }

        Instant now = Instant.now();

        List<AssessmentAnswer> gradedNow = new ArrayList<>();
        List<AssessmentAnswer> aiAnswers = new ArrayList<>();

        for (QuizQuestion question : questions) {
            QuestionContent q = QuestionContent.from(question);
            AssessmentAnswer answer = answers.computeIfAbsent(question.getQuestionId(), id -> AssessmentAnswer.builder()
                    .attemptId(attemptId)
                    .questionId(id)
                    .gradingStatus(AssessmentAnswerGradingStatus.UNGRADED)
                    .build());
            BigDecimal max = maxPointsOf(q);
            answer.setMaxPoints(max);

            boolean manualFeedback = "MANUAL".equals(attempt.getGradingMethod());
            boolean manualResponse = manualFeedback && (q.getQuestionType() == ExerciseQuestionType.ESSAY
                    || q.getQuestionType() == ExerciseQuestionType.AUDIO_RESPONSE
                    || q.getQuestionType() == ExerciseQuestionType.FILE_UPLOAD);
            if (!autoGrader.isAnswered(answer.getAnswerJson()) && !manualResponse) {
                markGraded(answer, BigDecimal.ZERO, AssessmentAnswerGradingStatus.AUTO_GRADED, now);
                gradedNow.add(answer);
                continue;
            }
            switch (routeOf(q, manualFeedback)) {
                case AUTO -> {
                    markGraded(answer, autoGrader.grade(q, answer.getAnswerJson(), max),
                            AssessmentAnswerGradingStatus.AUTO_GRADED, now);
                    gradedNow.add(answer);
                }
                case AI -> {
                    answer.setEarnedPoints(null);
                    answer.setGradingStatus(AssessmentAnswerGradingStatus.AI_PENDING);
                    aiAnswers.add(answer);
                }
                case MANUAL -> {
                    answer.setEarnedPoints(null);
                    answer.setGradingStatus(AssessmentAnswerGradingStatus.MANUAL_PENDING);
                }
            }
        }

        answerRepository.saveAll(answers.values());
        List<AssessmentAnswerGradingHistory> histories = new ArrayList<>();
        for (AssessmentAnswer graded : gradedNow) {
            histories.add(newHistory(graded, null, null, null, null, now));
        }
        historyRepository.saveAll(histories);

        recompute(attempt, answers.values());
        for (AssessmentAnswer ai : aiAnswers) {
            eventPublisher.publishAnswerAiGrade(attemptId, ai.getId());
        }
    }

    @Transactional
    public void recompute(AssessmentAttempt attempt, Collection<AssessmentAnswer> answers) {
        BigDecimal total = BigDecimal.ZERO;
        BigDecimal earned = BigDecimal.ZERO;
        boolean aiPending = false;
        boolean manualPending = false;
        for (AssessmentAnswer a : answers) {
            if (a.getMaxPoints() != null) total = total.add(a.getMaxPoints());
            if (a.getEarnedPoints() != null) earned = earned.add(a.getEarnedPoints());
            if (a.getGradingStatus() == AssessmentAnswerGradingStatus.AI_PENDING) aiPending = true;
            if (a.getGradingStatus() == AssessmentAnswerGradingStatus.MANUAL_PENDING) manualPending = true;
        }
        AssessmentGradingStatus previous = attempt.getGradingStatus();
        AssessmentGradingStatus next = aiPending ? AssessmentGradingStatus.GRADING
                : manualPending ? AssessmentGradingStatus.MANUAL_GRADING : AssessmentGradingStatus.GRADED;
        attempt.setTotalPoints(total);
        attempt.setEarnedPoints(earned);
        attempt.setGradingStatus(next);
        attemptRepository.save(attempt);
        // Tự luyện không gắn lớp/buổi nên không gửi thông báo "đã có điểm".
        if (previous != AssessmentGradingStatus.GRADED && next == AssessmentGradingStatus.GRADED
                && attempt.getContextType() == AssessmentContextType.CLASS_SESSION) {
            notifier.notifyGraded(attempt);
        }
    }

    public AssessmentAnswerGradingHistory newHistory(AssessmentAnswer answer, BigDecimal previousPoints,
            String previousComment, String graderId, String comment, Instant now) {
        return AssessmentAnswerGradingHistory.builder()
                .answerId(answer.getId())
                .attemptId(answer.getAttemptId())
                .questionId(answer.getQuestionId())
                .previousEarnedPoints(previousPoints)
                .earnedPoints(answer.getEarnedPoints())
                .previousGraderComment(previousComment)
                .graderComment(comment)
                .graderId(graderId)
                .gradedAt(now)
                .build();
    }

    public void markGraded(AssessmentAnswer answer, BigDecimal earned, AssessmentAnswerGradingStatus status, Instant now) {
        answer.setEarnedPoints(earned);
        answer.setGradingStatus(status);
        answer.setGradedAt(now);
        answer.setGraderId(null);
    }

    // Câu tự luận/ghi âm/nộp file đi chấm AI khi có client AI hỗ trợ đúng kỹ năng và loại câu hỏi; không thì chấm tay.
    private boolean aiSupports(QuestionContent q) {
        return aiClients.orderedStream().anyMatch(c -> c.supports(q));
    }

    private Route routeOf(QuestionContent q, boolean manualFeedback) {
        if (q.getQuestionType() == null) return Route.MANUAL;
        return switch (q.getQuestionType()) {
            case MULTIPLE_CHOICE, MULTIPLE_SELECT, MATCHING, FILL_IN_BLANK, SENTENCE_BUILDER ->
                    autoGrader.canAutoGrade(q) ? Route.AUTO : Route.MANUAL;
            case AUDIO_RESPONSE, ESSAY, FILE_UPLOAD -> !manualFeedback && aiSupports(q) ? Route.AI : Route.MANUAL;
        };
    }

    private BigDecimal maxPointsOf(QuestionContent q) {
        if (q.getPoints() == null || q.getPoints() <= 0) return DEFAULT_POINTS;
        return BigDecimal.valueOf(q.getPoints());
    }
}
