package pl.co.lms.dto.response;

public record MatchGameLeaderboardResponse(int rank, String userId, String displayName, int score,
        int elapsedTenths, boolean isCurrentUser) {}
