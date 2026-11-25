package pl.co.lms.dto.response;

import pl.co.lms.client.dto.CmsFeedbackStudent;

import java.util.List;

public record FeedbackStudentResponse(
        String studentId,
        List<FeedbackEntryResponse> feedbacks
) {
    public static FeedbackStudentResponse from(CmsFeedbackStudent s) {
        return new FeedbackStudentResponse(
                s.getStudentId(),
                s.getFeedbacks() == null ? List.of() : s.getFeedbacks().stream().map(FeedbackEntryResponse::from).toList());
    }
}
