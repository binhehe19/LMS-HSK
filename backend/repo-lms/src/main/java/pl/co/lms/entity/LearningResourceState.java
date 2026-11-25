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

@Entity
@Table(
    name = "learning_resource_states",
    indexes = {
        @Index(name = "idx_lrs_user_resource", columnList = "user_id, learning_resource_id")
    }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LearningResourceState extends BaseEntity {

    @Column(name = "user_id", nullable = false, length = 26)
    private String userId;

    @Column(name = "learning_resource_id", nullable = false, length = 26)
    private String learningResourceId;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private FlashcardStatus status;

    @Column(name = "last_reviewed_at")
    private Instant lastReviewedAt;

    @Builder.Default
    @Column(name = "review_count", nullable = false)
    private int reviewCount = 0;

    @Builder.Default
    @Column(nullable = false)
    private boolean saved = false;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(name = "comprehension_level", length = 20)
    private VocabularyComprehensionLevel comprehensionLevel;

    @Column(name = "review_at")
    private Instant reviewAt;
}
