package pl.co.lms.dto.response;

import pl.co.lms.entity.BlastGameEndReason;

public record BlastGameResultResponse(String sessionId, int score, int elapsedMs, int answered, int totalWords,
        int mistakes, BlastGameEndReason reason, int bestScore, int bestElapsedMs, boolean isNewBest) {}
