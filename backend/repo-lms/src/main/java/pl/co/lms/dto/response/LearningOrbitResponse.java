package pl.co.lms.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record LearningOrbitResponse(
        Space space, Band band, Vocabulary vocabulary, Achievement achievement, Classes classes,
        Instant updatedAt) {
    public record Space(List<SpaceStep> steps, String recommendation, Instant assessedAt) { }
    public record SpaceStep(String key, String label, Integer level) { }
    // Raw scores deliberately use the existing frontend's score-display.ts to avoid two band conversion tables.
    public record Band(List<Skill> skills) { }
    public record Skill(String key, List<Score> results) { }
    public record Score(BigDecimal earned, BigDecimal total, String scoreDisplay, Instant submittedAt, boolean provisional) { }
    public record Vocabulary(long total, long known, long learning, long saved, long due) { }
    public record Achievement(BigDecimal earnedPoints, long completedAttempts, long submissionDays, int currentStreak) { }
    public record Classes(long revisedSubmissions, long approvedFeedback, long verifiedImprovements, int trackedSkills) { }
}
