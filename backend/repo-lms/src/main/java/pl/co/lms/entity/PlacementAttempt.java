package pl.co.lms.entity;

import base.co.common.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

/** Server-owned membership: client settings cannot turn an ordinary practice attempt into a placement test. */
@Entity @Getter @Setter
@Table(name = "placement_attempts", uniqueConstraints = @UniqueConstraint(name = "uk_placement_assessment_attempt", columnNames = "assessment_attempt_id"),
        indexes = @Index(name = "idx_placement_attempt_user", columnList = "user_id, created_at"))
public class PlacementAttempt extends BaseEntity {
    @Column(nullable = false, length = 26) private String userId;
    // Id của đề (LearningResource). Giữ tên cột test_id từ thời bảng placement_tests để không phải đổi lược đồ.
    @Column(name = "test_id", nullable = false, length = 26) private String resourceId;
    @Column(name = "assessment_attempt_id", nullable = false, length = 26) private String assessmentAttemptId;
    @Column(length = 10) private String feedbackMethod;
    private Instant submittedAt;
}
