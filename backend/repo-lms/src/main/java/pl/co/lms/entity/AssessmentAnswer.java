package pl.co.lms.entity;

import base.co.common.jpa.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import com.fasterxml.jackson.databind.JsonNode;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;

// Đáp án học sinh trả lời cho 1 câu hỏi trong 1 AssessmentAttempt. questionId là khoá ổn định từ
// QuizQuestion.questionId trong JSON của LearningResourceVersion.
//
// Uniqueness (attempt_id, question_id) áp dụng qua PARTIAL unique index "WHERE deleted = false"
// (tạo trong DatabaseIndexInitializer).
@Entity
@Table(
    name = "assessment_answers",
    indexes = {
        @Index(name = "idx_assessment_answers_attempt_id", columnList = "attempt_id"),
        @Index(name = "idx_assessment_answers_question_id", columnList = "question_id")
    }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssessmentAnswer extends BaseEntity {

    @Column(name = "attempt_id", nullable = false, length = 26)
    private String attemptId;

    // Imported quiz questions may use UUIDs (36 chars) as well as ULIDs.
    @Column(name = "question_id", nullable = false, length = 64)
    private String questionId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "answer_json", columnDefinition = "jsonb")
    private String answerJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "grading_status", nullable = false, length = 20)
    private AssessmentAnswerGradingStatus gradingStatus;

    @Column(name = "earned_points", precision = 6, scale = 2)
    private BigDecimal earnedPoints;

    @Column(name = "max_points", precision = 6, scale = 2)
    private BigDecimal maxPoints;

    @Column(name = "grader_id", length = 26)
    private String graderId;

    @Column(name = "grader_comment", columnDefinition = "text")
    private String graderComment;

    @Column(name = "graded_at")
    private Instant gradedAt;

    // Điểm theo tiêu chí IELTS (Writing/Speaking); null với câu chấm theo điểm thường.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "rubric_scores", columnDefinition = "jsonb")
    private JsonNode rubricScores;
}
