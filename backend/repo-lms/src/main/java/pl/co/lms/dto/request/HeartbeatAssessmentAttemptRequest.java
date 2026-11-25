package pl.co.lms.dto.request;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

// Gửi mỗi 20 giây: gia hạn Redis lock + tiện thể lưu đáp án nếu có thay đổi.
// answers: null hoặc rỗng → chỉ gia hạn khóa, không lưu gì.
public record HeartbeatAssessmentAttemptRequest(
        @NotBlank String sessionToken,
        List<AnswerItem> answers
) {
    public record AnswerItem(
            String questionId,
            String answerJson
    ) {}
}
