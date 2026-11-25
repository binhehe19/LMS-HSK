package pl.co.lms.dto.request;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

// Nộp bài. answers: đáp án cuối cùng (tuỳ chọn — có thể đã lưu hết qua heartbeat/draft).
// Chỉ thành công một lần: gọi lại khi đã SUBMITTED trả 409 (ĐÃ_NỘP).
// Cửa sổ nộp muộn: chấp nhận answers mới trong 2 phút sau ends_at (grace period
// cho độ trễ mạng), sau đó bỏ qua answers nhưng vẫn cho phép submit.
// sessionToken: bắt buộc với bài trong lớp (khoá làm bài); tự luyện không có khoá nên để trống.
// revision/clientState (tự luyện): trạng thái giao diện cuối cùng, revision phải khớp nếu có gửi.
public record SubmitAssessmentAttemptRequest(
        String sessionToken,
        List<HeartbeatAssessmentAttemptRequest.AnswerItem> answers,
        Long revision,
        JsonNode clientState
) {
    public SubmitAssessmentAttemptRequest(String sessionToken, List<HeartbeatAssessmentAttemptRequest.AnswerItem> answers) {
        this(sessionToken, answers, null, null);
    }
}