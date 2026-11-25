package pl.co.lms.dto.response;

public record MatchGameResultResponse(String sessionId, int score, int elapsedTenths, int matchedPairs,
        int mistakes, int bestScore, int bestElapsedTenths, boolean isNewBest) {}
