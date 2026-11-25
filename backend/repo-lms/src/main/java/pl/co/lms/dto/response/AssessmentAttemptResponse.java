package pl.co.lms.dto.response;

import com.fasterxml.jackson.databind.JsonNode;
import pl.co.lms.entity.AssessmentAttempt;
import pl.co.lms.entity.AssessmentContextType;
import pl.co.lms.entity.AssessmentAttemptStatus;
import pl.co.lms.entity.json.QuestionPublicContent;
import pl.co.lms.entity.json.QuizContent;

import java.time.Instant;
import java.util.List;

// Response cho POST /assessment-attempts (bắt đầu/tiếp tục làm bài).
// questions: danh sách câu hỏi, content là QuestionPublicContent (không có đáp án đúng).
// savedAnswers: đáp án đã lưu từ lần làm trước (để resume). keyed by questionId.
// remainingSeconds: null nếu không giới hạn giờ.
public record AssessmentAttemptResponse(
        String attemptId,
        String contentPackageVersionId,
        String learningResourceId,
        String sessionId,
        Integer sessionNo,
        AssessmentAttemptStatus status,
        Instant startedAt,
        Instant endsAt,
        Long remainingSeconds,
        Integer timeLimitSeconds,
        List<QuizQuestionItem> questions,
        List<SavedAnswerItem> savedAnswers,
        String subType,
        AssessmentContextType contextType,
        String mode,
        long revision,
        JsonNode settings,
        JsonNode clientState,
        JsonNode layout
) {

    public record QuizQuestionItem(
            String questionId,
            int displayOrder,
            QuestionPublicContent content
    ) {}

    public record SavedAnswerItem(
            String answerId,
            String questionId,
            String answerJson
    ) {}

    public static AssessmentAttemptResponse from(
            AssessmentAttempt attempt,
            QuizContent quizContent,
            List<QuizQuestionItem> questions,
            List<SavedAnswerItem> savedAnswers,
            JsonNode layout,
            Instant now) {

        Long remaining = null;
        if (attempt.getEndsAt() != null) {
            long secs = attempt.getEndsAt().getEpochSecond() - now.getEpochSecond();
            remaining = Math.max(0, secs);
        }

        AssessmentAttemptStatus status = attempt.effectiveStatus(now);

        // Giới hạn thời gian của chế độ mà lượt làm này đã chọn (null = không giới hạn).
        Integer timeLimitSeconds = quizContent != null ? quizContent.limitSeconds(attempt.getMode()) : null;

        return new AssessmentAttemptResponse(
                attempt.getId(),
                attempt.getContentPackageVersionId(),
                attempt.getLearningResourceId(),
                attempt.getSessionId(),
                attempt.getSessionNo(),
                status,
                attempt.getCreatedAt(),
                attempt.getEndsAt(),
                remaining,
                timeLimitSeconds,
                questions,
                savedAnswers,
                attempt.getSubType(),
                attempt.getContextType(),
                attempt.getMode(),
                attempt.getRevision(),
                attempt.getSettings(),
                attempt.getClientState(),
                layout
        );
    }
}
