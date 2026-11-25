package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsScoreSummary;

public record ScoreSummaryResponse(
        Double scoreOnTen,
        Double percentage,
        Integer gradedItemCount,
        Integer totalItemCount
) {
    public static ScoreSummaryResponse from(CmsScoreSummary s) {
        if (s == null) return null;
        return new ScoreSummaryResponse(s.getScoreOnTen(), s.getPercentage(), s.getGradedItemCount(), s.getTotalItemCount());
    }
}
