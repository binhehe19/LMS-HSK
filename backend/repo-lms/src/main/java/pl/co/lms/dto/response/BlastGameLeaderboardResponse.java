package pl.co.lms.dto.response;

public record BlastGameLeaderboardResponse(int rank, String userId, String displayName,
        int score, int elapsedMs, boolean isCurrentUser) {}
