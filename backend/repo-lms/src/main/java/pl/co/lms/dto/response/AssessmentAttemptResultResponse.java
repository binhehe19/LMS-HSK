package pl.co.lms.dto.response;

import com.fasterxml.jackson.databind.JsonNode;
import pl.co.lms.entity.AssessmentAnswerGradingStatus;
import pl.co.lms.entity.AssessmentAttemptStatus;
import pl.co.lms.entity.AssessmentGradingStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

// Kết quả bài làm cho học sinh (GET /assessment-attempts/{id}/result), trả từng phần theo tiến độ chấm.
// question: QuestionContent.forResult (có đáp án đúng, giải thích, transcript; không có referenceText/aiRubric) CHỈ khi câu đã có điểm; chưa có điểm thì là
// QuestionPublicContent (không lộ đáp án đúng).
// scoreSource/provisional/hasProvisionalScore phục vụ phía management; FE học sinh không hiển thị.
// nextPollMs: nhịp gọi lại do server quyết định; null khi không cần gọi thêm (GRADED hoặc chỉ còn chờ giáo viên).
public record AssessmentAttemptResultResponse(
        String attemptId,
        AssessmentAttemptStatus attemptStatus,
        AssessmentGradingStatus gradingStatus,
        BigDecimal earnedPoints,
        BigDecimal totalPoints,
        BigDecimal percent,
        Instant submittedAt,
        Progress progress,
        boolean hasProvisionalScore,
        Long nextPollMs,
        List<QuestionResult> questions,
        String subType,
        String mode,
        Instant startedAt,
        JsonNode layout,
        JsonNode clientState,
        String learningResourceId
) {

    public record Progress(int gradedQuestions, int totalQuestions) {}

    public record QuestionResult(
            String answerId,
            String questionId,
            int displayOrder,
            Object question,
            String answerJson,
            AssessmentAnswerGradingStatus gradingStatus,
            BigDecimal earnedPoints,
            BigDecimal maxPoints,
            String graderComment,
            String scoreSource,
            boolean provisional,
            JsonNode rubricScores,
            // Đúng/sai từng ý của câu nối / câu điền chỗ trống, tính lúc đọc từ bài làm và đáp án hệ thống (không lưu);
            // giáo viên chỉ sửa điểm câu nên dấu đúng/sai luôn theo đáp án. Null với câu loại khác hoặc chưa có điểm.
            List<PartResult> parts
    ) {}
}
