package pl.co.lms.dto.response;

import com.fasterxml.jackson.databind.JsonNode;
import pl.co.lms.entity.AssessmentAnswerGradingStatus;
import pl.co.lms.entity.AssessmentAttemptStatus;
import pl.co.lms.entity.AssessmentContextType;
import pl.co.lms.entity.AssessmentGradingStatus;
import pl.co.lms.entity.json.QuestionContent;
import pl.co.lms.entity.json.QuizQuestion;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

// Chi tiết một bài để admin chấm: câu hỏi ĐẦY ĐỦ (có đáp án đúng), đáp án học sinh, điểm và nguồn chấm.
// provisional = true là điểm AI chưa được admin duyệt.
// subType + layout (bố cục đầy đủ, kể cả grading và explanation) phục vụ màn chấm;
// Item.rubricScores là điểm theo tiêu chí đang lưu của câu.
public record AssessmentGradingDetailResponse(
        String attemptId,
        String studentId,
        String sessionId,
        Integer sessionNo,
        AssessmentAttemptStatus status,
        AssessmentGradingStatus gradingStatus,
        BigDecimal earnedPoints,
        BigDecimal totalPoints,
        Instant submittedAt,
        List<Item> answers,
        String subType,
        AssessmentContextType contextType,
        String title,
        JsonNode layout,
        String studentName,
        String studentEmail,
        String studentCode
) {
    public record Item(
            String answerId,
            String questionId,
            int displayOrder,
            QuestionContent question,
            String answerJson,
            AssessmentAnswerGradingStatus gradingStatus,
            BigDecimal earnedPoints,
            BigDecimal maxPoints,
            String graderComment,
            String graderId,
            String scoreSource,
            boolean provisional,
            JsonNode rubricScores,
            // Tiêu chí chấm do người soạn đặt cho câu này (chỉ để tham khảo); null nếu câu không có.
            List<QuizQuestion.GradingCriterion> gradingCriteria,
            // Đúng/sai từng ý của câu nối / điền chỗ trống theo đáp án hệ thống (tính lúc đọc); null với câu loại khác.
            List<PartResult> parts
    ) {}
}