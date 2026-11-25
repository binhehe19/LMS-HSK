package pl.co.lms.service;

import base.co.common.exception.ApiException;
import base.co.common.exception.ErrorCode;
import base.co.common.filter.principal.AuthPrincipal;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.dto.response.AssessmentAttemptResultResponse;
import pl.co.lms.dto.response.PartResult;
import pl.co.lms.entity.AssessmentAnswer;
import pl.co.lms.entity.AssessmentAnswerGradingStatus;
import pl.co.lms.entity.AssessmentAttempt;
import pl.co.lms.entity.AssessmentAttemptStatus;
import pl.co.lms.entity.AssessmentGradingStatus;
import pl.co.lms.entity.json.QuestionContent;
import pl.co.lms.entity.json.QuestionPublicContent;
import pl.co.lms.entity.json.QuizContent;
import pl.co.lms.entity.json.QuizQuestion;
import pl.co.lms.repository.AssessmentAnswerRepository;
import pl.co.lms.repository.AssessmentAttemptRepository;
import pl.co.lms.service.grading.QuestionAutoGrader;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AssessmentAttemptResultService {

    private static final long[] STEP_UPPER_BOUNDS_SECONDS = {5, 15, 30, 60};

    private final AssessmentAttemptRepository attemptRepository;
    private final AssessmentAnswerRepository answerRepository;
    private final AssessmentAttemptQuestionResolver questionResolver;
    private final QuestionAutoGrader autoGrader;

    @Value("${assessment.grading.result-poll-ms:1000,2000,3000,5000,15000}")
    private long[] pollMs;

    public record Outcome(String etag, AssessmentAttemptResultResponse body) {
        public boolean notModified() {
            return body == null;
        }
    }

    @Transactional(readOnly = true)
    public Outcome getResult(String attemptId, String ifNoneMatch) {
        String userId = currentUserId();
        AssessmentAttempt attempt = attemptRepository.findByIdAndDeletedFalse(attemptId)
                .orElseThrow(() -> new ApiException(ErrorCode.E227, "AssessmentAttempt không tồn tại"));
        if (!userId.equals(attempt.getUserId())) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Bạn không có quyền truy cập bài làm này");
        }
        if (attempt.getStatus() == AssessmentAttemptStatus.IN_PROGRESS
                || attempt.getGradingStatus() == AssessmentGradingStatus.NOT_SUBMITTED) {
            throw new ApiException(ErrorCode.E221, "Bài làm chưa được nộp");
        }

        Instant now = Instant.now();
        int step = pollStep(attempt, now);
        List<AssessmentAnswer> answers = answerRepository.findByAttemptIdAndDeletedFalse(attemptId);
        String etag = etag(attempt, answers, step);
        if (etag.equals(ifNoneMatch)) {
            return new Outcome(etag, null);
        }
        return new Outcome(etag, build(attempt, answers, step));
    }

    private AssessmentAttemptResultResponse build(AssessmentAttempt attempt, List<AssessmentAnswer> answers, int step) {
        Map<String, AssessmentAnswer> byQuestionId = new HashMap<>();
        for (AssessmentAnswer a : answers) byQuestionId.put(a.getQuestionId(), a);

        QuizContent quizContent = questionResolver.getQuizContent(attempt.getLearningResourceVersionId());
        List<QuizQuestion> questions = quizContent != null && quizContent.getQuestions() != null
                ? quizContent.getQuestions() : List.of();

        List<AssessmentAttemptResultResponse.QuestionResult> results = new ArrayList<>();
        int graded = 0;
        boolean provisional = false;
        int order = 1;
        for (QuizQuestion question : questions) {
            // Bản dành cho kết quả: đủ đáp án, lời giải, transcript nhưng không có referenceText/aiRubric (chỉ dùng phía server).
            QuestionContent full = QuestionContent.forResult(question);
            AssessmentAnswer answer = byQuestionId.get(question.getQuestionId());
            boolean hasScore = answer != null && answer.getEarnedPoints() != null;
            if (hasScore) graded++;
            boolean isProvisional = answer != null && answer.getGradingStatus() == AssessmentAnswerGradingStatus.AI_GRADED;
            provisional |= isProvisional;
            results.add(new AssessmentAttemptResultResponse.QuestionResult(
                    answer == null ? null : answer.getId(),
                    question.getQuestionId(),
                    order++,
                    hasScore ? full : QuestionPublicContent.from(question),
                    answer == null ? null : answer.getAnswerJson(),
                    answer == null ? AssessmentAnswerGradingStatus.UNGRADED : answer.getGradingStatus(),
                    answer == null ? null : answer.getEarnedPoints(),
                    answer == null ? null : answer.getMaxPoints(),
                    answer == null ? null : answer.getGraderComment(),
                    answer == null ? null : sourceOf(answer.getGradingStatus()),
                    isProvisional,
                    answer == null ? null : answer.getRubricScores(),
                    hasScore ? partsOf(full, answer.getAnswerJson()) : null));
        }

        // Bố cục sau khi nộp: có explanation (giải thích, transcript), vẫn không có grading; getResult đã chặn bài đang làm.
        JsonNode layout = quizContent == null ? null : LayoutFilter.forStudent(quizContent.getLayout(), true);

        BigDecimal total = attempt.getTotalPoints();
        BigDecimal percent = total != null && total.signum() > 0
                ? attempt.getEarnedPoints().multiply(BigDecimal.valueOf(100)).divide(total, 2, RoundingMode.HALF_UP)
                : null;
        return new AssessmentAttemptResultResponse(
                attempt.getId(),
                attempt.getStatus(),
                attempt.getGradingStatus(),
                attempt.getEarnedPoints(),
                total,
                percent,
                attempt.getSubmittedAt(),
                new AssessmentAttemptResultResponse.Progress(graded, results.size()),
                provisional,
                nextPollMs(attempt, step),
                results,
                attempt.getSubType(),
                attempt.getMode(),
                attempt.getCreatedAt(),
                layout,
                attempt.getClientState(),
                attempt.getLearningResourceId());
    }

    private List<PartResult> partsOf(QuestionContent question, String answerJson) {
        List<PartResult> parts = autoGrader.partResults(question, answerJson);
        return parts.isEmpty() ? null : parts;
    }

    private static String sourceOf(AssessmentAnswerGradingStatus status) {
        if (status == null) return null;
        return switch (status) {
            case AUTO_GRADED -> "AUTO";
            case AI_GRADED -> "AI";
            case MANUAL_GRADED, SCORE_UPDATED -> "MANUAL";
            default -> null;
        };
    }

    private Long nextPollMs(AssessmentAttempt attempt, int step) {
        if (attempt.getGradingStatus() == AssessmentGradingStatus.GRADED
                || attempt.getGradingStatus() == AssessmentGradingStatus.MANUAL_GRADING) {
            return null;
        }
        return pollMs[Math.min(step, pollMs.length - 1)];
    }

    private int pollStep(AssessmentAttempt attempt, Instant now) {
        Instant reference = attempt.getSubmittedAt() != null ? attempt.getSubmittedAt() : attempt.getUpdatedAt();
        long elapsed = Math.max(0, Duration.between(reference, now).getSeconds());
        int step = 0;
        while (step < STEP_UPPER_BOUNDS_SECONDS.length && elapsed >= STEP_UPPER_BOUNDS_SECONDS[step]) step++;
        return step;
    }

    private String etag(AssessmentAttempt attempt, List<AssessmentAnswer> answers, int step) {
        long latest = attempt.getUpdatedAt().toEpochMilli();
        for (AssessmentAnswer a : answers) latest = Math.max(latest, a.getUpdatedAt().toEpochMilli());
        return "\"" + attempt.getGradingStatus() + "-" + latest + "-" + answers.size() + "-" + step + "\"";
    }

    private String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof AuthPrincipal principal) {
            return principal.userId();
        }
        throw new ApiException(ErrorCode.UNAUTHORIZED, "Yêu cầu đăng nhập");
    }
}
