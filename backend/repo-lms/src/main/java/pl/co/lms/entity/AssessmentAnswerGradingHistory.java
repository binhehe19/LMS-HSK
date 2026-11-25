package pl.co.lms.entity;

import base.co.common.util.UlidGenerator;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

// Lịch sử mỗi lần chấm (tự động hoặc tay) cho 1 AssessmentAnswer — ghi thêm, không sửa/xoá.
@Entity
@Table(
    name = "assessment_answer_grading_histories",
    indexes = {
        @Index(name = "idx_assessment_answer_grading_histories_answer", columnList = "answer_id, created_at"),
        @Index(name = "idx_assessment_answer_grading_histories_attempt", columnList = "attempt_id, created_at")
    }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssessmentAnswerGradingHistory {

    @Id
    @Column(length = 26, nullable = false, updatable = false)
    private String id;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "answer_id", nullable = false, length = 26)
    private String answerId;

    @Column(name = "attempt_id", nullable = false, length = 26)
    private String attemptId;

    // Imported quiz questions may use UUIDs (36 chars) as well as ULIDs.
    @Column(name = "question_id", nullable = false, length = 64)
    private String questionId;

    @Column(name = "previous_earned_points", precision = 6, scale = 2)
    private BigDecimal previousEarnedPoints;

    @Column(name = "earned_points", precision = 6, scale = 2)
    private BigDecimal earnedPoints;

    @Column(name = "previous_grader_comment", columnDefinition = "text")
    private String previousGraderComment;

    @Column(name = "grader_comment", columnDefinition = "text")
    private String graderComment;

    @Column(name = "grader_id", length = 26)
    private String graderId;

    @Column(name = "graded_at")
    private Instant gradedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UlidGenerator.nextUlid();
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
