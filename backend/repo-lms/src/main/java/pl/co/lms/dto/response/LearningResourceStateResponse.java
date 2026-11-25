package pl.co.lms.dto.response;

import pl.co.lms.entity.FlashcardStatus;
import pl.co.lms.entity.LearningResourceState;
import pl.co.lms.entity.VocabularyComprehensionLevel;

import java.time.Instant;

public record LearningResourceStateResponse(
        String id,
        String userId,
        String learningResourceId,
        FlashcardStatus status,
        Instant lastReviewedAt,
        int reviewCount,
        Instant reviewAt,
        boolean saved,
        String note,
        VocabularyComprehensionLevel comprehensionLevel,
        Instant createdAt,
        Instant updatedAt
) {
    public static LearningResourceStateResponse from(LearningResourceState s) {
        if (s == null) return null;
        return new LearningResourceStateResponse(
                s.getId(),
                s.getUserId(),
                s.getLearningResourceId(),
                s.getStatus(),
                s.getLastReviewedAt(),
                s.getReviewCount(),
                s.getReviewAt(),
                s.isSaved(),
                s.getNote(),
                s.getComprehensionLevel(),
                s.getCreatedAt(),
                s.getUpdatedAt()
        );
    }
}
