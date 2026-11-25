package pl.co.lms.dto.response;

import java.time.Instant;

public record StudyMaterialProgressResponse(
        String versionId, double position, int percent, boolean completed,
                           Instant openedAt, Integer lastScore, Integer bestScore, int quizAttempts
) {}
