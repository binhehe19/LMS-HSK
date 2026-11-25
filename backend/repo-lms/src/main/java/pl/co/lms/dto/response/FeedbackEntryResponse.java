package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsFeedbackEntry;

public record FeedbackEntryResponse(
        String sessionId,
        Integer sessionNo,
        String feedbackId,
        String comment,
        Boolean isAnonymous
) {
    public static FeedbackEntryResponse from(CmsFeedbackEntry e) {
        return new FeedbackEntryResponse(e.getSessionId(), e.getSessionNo(), e.getFeedbackId(), e.getComment(), e.getIsAnonymous());
    }
}
