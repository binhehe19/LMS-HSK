package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsFeedbackCheckpoint;

public record FeedbackCheckpointResponse(
        String sessionId,
        Integer sessionNo
) {
    public static FeedbackCheckpointResponse from(CmsFeedbackCheckpoint c) {
        return new FeedbackCheckpointResponse(c.getSessionId(), c.getSessionNo());
    }
}
