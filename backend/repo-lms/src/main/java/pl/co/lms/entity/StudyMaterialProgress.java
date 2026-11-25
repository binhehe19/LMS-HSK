package pl.co.lms.entity;

import base.co.common.jpa.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Entity @Getter @Setter
@Table(name = "study_material_progress",
       uniqueConstraints = @UniqueConstraint(name = "uq_study_progress_owner", columnNames = {"user_id", "resource_id"}),
       indexes = @Index(name = "idx_study_progress_recent", columnList = "user_id,last_opened_at"))
public class StudyMaterialProgress extends BaseEntity {
    @Column(name = "user_id", nullable = false, length = 26) private String userId;
    @Column(name = "resource_id", nullable = false, length = 26) private String resourceId;
    @Column(name = "version_id", nullable = false, length = 26) private String versionId;
    @Column(nullable = false) private double position;
    @Column(nullable = false) private int percent;
    @Column(nullable = false) private boolean completed;
    @Column(name = "last_opened_at", nullable = false) private Instant lastOpenedAt;
    @Column(name = "last_score") private Integer lastScore;
    @Column(name = "best_score") private Integer bestScore;
    @Column(name = "quiz_attempts", nullable = false) private int quizAttempts;
    @Version private Long revision;
}
