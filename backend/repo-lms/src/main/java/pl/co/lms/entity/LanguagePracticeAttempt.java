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

import java.time.Instant;

/** Một lượt học độc lập của học viên cho đúng resource version và mode. */
@Entity
@Table(
        name = "language_practice_attempts",
        indexes = {
                @Index(name = "idx_lpa_user_resource_version", columnList = "created_by, resource_version_id"),
                @Index(name = "idx_lpa_resource_id", columnList = "resource_id")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LanguagePracticeAttempt extends BaseEntity {

    @Column(name = "resource_id", nullable = false, length = 26)
    private String resourceId;

    // Ghim version đã PUBLISHED lúc bắt đầu: lần publish mới không đổi transcript/đáp án của lượt cũ.
    @Column(name = "resource_version_id", nullable = false, length = 26)
    private String resourceVersionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LanguagePracticeMode mode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LanguagePracticeAttemptStatus status;

    @Column(name = "completed_at")
    private Instant completedAt;
}
